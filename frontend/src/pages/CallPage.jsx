import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  RefreshCwIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import AvatarImage from "../components/AvatarImage";
import PageLoader from "../components/PageLoader";
import useAuthUser from "../hooks/useAuthUser";
import { getChatToken, getUserFriends } from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const outgoingCallTimeoutMs = 32_000;

const parseIceServers = () => {
  const rawIceServers = import.meta.env.VITE_ICE_SERVERS;

  if (!rawIceServers) {
    return defaultIceServers;
  }

  try {
    const parsedIceServers = JSON.parse(rawIceServers);
    return Array.isArray(parsedIceServers) && parsedIceServers.length > 0
      ? parsedIceServers
      : defaultIceServers;
  } catch (error) {
    console.error("Invalid VITE_ICE_SERVERS configuration", error);
    return defaultIceServers;
  }
};

const rtcConfig = {
  iceServers: parseIceServers(),
};

const formatCallDuration = (durationSeconds = 0) => {
  const safeDuration = Math.max(0, durationSeconds);
  const hours = Math.floor(safeDuration / 3600);
  const minutes = Math.floor((safeDuration % 3600) / 60);
  const seconds = safeDuration % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getSafeReturnPath = (returnTo, peerId) => {
  const fallbackPath = peerId ? `/chat/${peerId}` : "/";

  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return fallbackPath;
  }

  if (returnTo.startsWith("/call/")) {
    return fallbackPath;
  }

  return returnTo;
};

const CallPage = () => {
  const { id: callId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const isMutedRef = useRef(false);
  const isCameraOffRef = useRef(false);
  const hasSentConnectedRef = useRef(false);
  const returnTimerRef = useRef(null);
  const outgoingTimeoutRef = useRef(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [statusText, setStatusText] = useState("Preparing your devices...");
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [deviceError, setDeviceError] = useState(null);
  const [setupAttempt, setSetupAttempt] = useState(0);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const callMode = searchParams.get("mode");
  const peerId = searchParams.get("peer");
  const peerNameFromParams = searchParams.get("peerName");
  const peerPicFromParams = searchParams.get("peerPic");
  const returnPath = useMemo(
    () => getSafeReturnPath(searchParams.get("returnTo"), peerId),
    [peerId, searchParams]
  );

  const { authUser, isLoading } = useAuthUser();
  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });
  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser && !!peerId,
  });

  const peerUser = useMemo(
    () => friends.find((friend) => friend._id === peerId),
    [friends, peerId]
  );
  const peerName = peerUser?.fullName || peerNameFromParams || "Remote participant";
  const peerProfilePic = peerUser?.profilePic || peerPicFromParams || "/default-avatar.svg";

  const isConnected = statusText === "Connected";
  const remoteLabel = peerId ? peerName : "Waiting for participant";
  const callDurationLabel = formatCallDuration(elapsedSeconds);
  const hasDeviceError = Boolean(deviceError);
  const connectionLabel = isConnected ? "Connected" : statusText;
  const returnFromCall = useCallback(() => {
    if (returnTimerRef.current) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }

    navigate(returnPath, { replace: true });
  }, [navigate, returnPath]);
  const scheduleReturnFromCall = useCallback(
    (delayMs = 1200) => {
      if (returnTimerRef.current) {
        window.clearTimeout(returnTimerRef.current);
      }

      returnTimerRef.current = window.setTimeout(returnFromCall, delayMs);
    },
    [returnFromCall]
  );
  const retryDeviceAccess = () => {
    setDeviceError(null);
    setStatusText("Preparing your devices...");
    setIsInitializing(true);
    setSetupAttempt((currentAttempt) => currentAttempt + 1);
  };

  useEffect(() => {
    if (callMode !== "outgoing" || isConnected || hasDeviceError) return undefined;

    if (outgoingTimeoutRef.current) {
      window.clearTimeout(outgoingTimeoutRef.current);
    }

    outgoingTimeoutRef.current = window.setTimeout(() => {
      setStatusText("No answer");
      toast.error("No one answered the call");
      scheduleReturnFromCall();
    }, outgoingCallTimeoutMs);

    return () => {
      if (outgoingTimeoutRef.current) {
        window.clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
    };
  }, [callMode, hasDeviceError, isConnected, scheduleReturnFromCall]);

  useEffect(() => {
    if (!isConnected) return;

    setCallStartedAt((currentStartedAt) => currentStartedAt || Date.now());

    if (!hasSentConnectedRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
      hasSentConnectedRef.current = true;
      socketRef.current.send(
        JSON.stringify({
          type: "call_connected",
          callId,
        })
      );
    }
  }, [callId, isConnected]);

  useEffect(() => {
    if (!callStartedAt) {
      setElapsedSeconds(0);
      return undefined;
    }

    const updateElapsedSeconds = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    };

    updateElapsedSeconds();
    const intervalId = window.setInterval(updateElapsedSeconds, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [callStartedAt]);

  const syncLocalMediaState = () => {
    if (!localStreamRef.current) return;

    for (const audioTrack of localStreamRef.current.getAudioTracks()) {
      audioTrack.enabled = !isMutedRef.current;
    }

    for (const videoTrack of localStreamRef.current.getVideoTracks()) {
      videoTrack.enabled = !isCameraOffRef.current;
    }
  };

  const attachLocalPreview = () => {
    if (!localVideoRef.current || !localStreamRef.current) return;

    if (localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    localVideoRef.current
      .play()
      .catch((error) => console.error("Local video playback was blocked", error));
  };

  useEffect(() => {
    if (!authUser || !tokenData?.token || !callId) return;

    let isCancelled = false;

    const flushPendingIceCandidates = async (peerConnection) => {
      if (!peerConnection.remoteDescription) return;

      while (pendingIceCandidatesRef.current.length > 0) {
        const candidate = pendingIceCandidatesRef.current.shift();

        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding queued ICE candidate", error);
        }
      }
    };

    const ensurePeerConnection = () => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const peerConnection = new RTCPeerConnection(rtcConfig);
      const remoteStream = remoteStreamRef.current || new MediaStream();
      remoteStreamRef.current = remoteStream;

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          peerConnection.addTrack(track, localStreamRef.current);
        }
      }

      peerConnection.ontrack = (event) => {
        for (const track of event.streams[0]?.getTracks() || [event.track]) {
          const alreadyAdded = remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id);
          if (!alreadyAdded) {
            remoteStream.addTrack(track);
          }
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current
            .play()
            .catch((error) => console.error("Remote video playback was blocked", error));
        }
        setStatusText("Connected");
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: "call_signal",
              callId,
              signal: { candidate: event.candidate },
            })
          );
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === "connected") {
          setStatusText("Connected");
        } else if (state === "connecting") {
          setStatusText("Connecting...");
        } else if (state === "failed") {
          setStatusText("Connection failed");
        } else if (state === "disconnected") {
          setStatusText("Peer disconnected");
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    };

    const setupCall = async () => {
      try {
        setDeviceError(null);
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (isCancelled) {
          for (const track of localStream.getTracks()) {
            track.stop();
          }
          return;
        }

        localStreamRef.current = localStream;
        syncLocalMediaState();
        attachLocalPreview();

        const socket = new WebSocket(getWebSocketUrl(tokenData.token));
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          setStatusText(callMode === "outgoing" ? "Ringing..." : "Joining the call...");
          socket.send(JSON.stringify({ type: "join_call", callId }));
          setIsInitializing(false);
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(event.data);

          if (payload.userId === authUser._id) return;

          if (payload.type === "peer_joined") {
            setStatusText("Connecting...");
            const peerConnection = ensurePeerConnection();
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.send(
              JSON.stringify({
                type: "call_signal",
                callId,
                signal: { description: peerConnection.localDescription },
              })
            );
          }

          if (payload.type === "call_signal") {
            const peerConnection = ensurePeerConnection();

            if (payload.signal.description) {
              const description = new RTCSessionDescription(payload.signal.description);
              await peerConnection.setRemoteDescription(description);
              await flushPendingIceCandidates(peerConnection);

              if (description.type === "offer") {
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.send(
                  JSON.stringify({
                    type: "call_signal",
                    callId,
                    signal: { description: peerConnection.localDescription },
                  })
                );
              }
            }

            if (payload.signal.candidate) {
              if (peerConnection.remoteDescription) {
                try {
                  await peerConnection.addIceCandidate(new RTCIceCandidate(payload.signal.candidate));
                } catch (error) {
                  console.error("Error adding ICE candidate", error);
                }
              } else {
                pendingIceCandidatesRef.current.push(payload.signal.candidate);
              }
            }
          }

          if (payload.type === "peer_left") {
            setStatusText("The other person left the call");
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = null;
            }
            remoteStreamRef.current = new MediaStream();
            scheduleReturnFromCall();
          }

          if (payload.type === "call_invite_response" && payload.callId === callId) {
            if (payload.accepted) {
              setStatusText("Answered. Connecting...");
            } else if (payload.reason === "declined") {
              setStatusText("Call declined");
              toast.error(`${payload.responderName || "The other person"} declined the call`);
            } else if (payload.reason === "busy") {
              setStatusText("The other person is busy");
              toast.error(`${payload.responderName || "The other person"} is already on a call`);
            } else if (payload.reason === "unavailable") {
              setStatusText("The other person is unavailable");
              toast.error("The other person is not available for a call right now");
            }

            if (!payload.accepted) {
              scheduleReturnFromCall();
            }
          }

          if (payload.type === "call_invite_pending_offline" && payload.callId === callId) {
            setStatusText("The other person is offline. Waiting for timeout...");
          }

          if (payload.type === "call_invite_timeout" && payload.callId === callId) {
            setStatusText("No answer");
            toast.error("No one answered the call");
            scheduleReturnFromCall();
          }

          if (payload.type === "error") {
            toast.error(payload.message);
          }
        });

        socket.addEventListener("error", () => {
          toast.error("Could not connect to call signaling");
          setStatusText("Call signaling failed");
          setIsInitializing(false);
        });

        socket.addEventListener("close", () => {
          if (!isCancelled) {
            setStatusText("Call signaling closed");
          }
        });
      } catch (error) {
        console.error("Error initializing call", error);
        toast.error("Camera or microphone access failed.");
        setDeviceError(error);
        setStatusText("Device access failed");
        setIsInitializing(false);
      }
    };

    setupCall();

    const handleVisibilitySync = () => {
      syncLocalMediaState();
      attachLocalPreview();
    };

    document.addEventListener("visibilitychange", handleVisibilitySync);
    window.addEventListener("focus", handleVisibilitySync);
    window.addEventListener("pageshow", handleVisibilitySync);

    return () => {
      isCancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilitySync);
      window.removeEventListener("focus", handleVisibilitySync);
      window.removeEventListener("pageshow", handleVisibilitySync);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "leave_call", callId }));
        socketRef.current.close();
      }

      if (returnTimerRef.current) {
        window.clearTimeout(returnTimerRef.current);
        returnTimerRef.current = null;
      }

      if (outgoingTimeoutRef.current) {
        window.clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }

      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      pendingIceCandidatesRef.current = [];

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteStreamRef.current = null;
    };
  }, [authUser, tokenData?.token, callId, callMode, scheduleReturnFromCall, setupAttempt]);

  useEffect(() => {
    if (!isInitializing) {
      attachLocalPreview();
    }
  }, [isInitializing]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;

    const nextMuted = !isMuted;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    const nextCameraOff = !isCameraOff;
    isCameraOffRef.current = nextCameraOff;
    setIsCameraOff(nextCameraOff);
  };

  useEffect(() => {
    isMutedRef.current = isMuted;
    isCameraOffRef.current = isCameraOff;
    syncLocalMediaState();
    attachLocalPreview();
  }, [isCameraOff, isMuted]);

  const leaveCall = () => {
    returnFromCall();
  };

  if (isLoading || isInitializing) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-base-300 px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="relative overflow-hidden rounded-[32px] border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/60 via-black/25 to-transparent">
            <div className="absolute left-4 top-4 flex max-w-[48%] min-w-0 items-center gap-3 sm:max-w-[60%]">
              <div className="avatar">
                <div className="w-10 rounded-full ring ring-white/20">
                  <AvatarImage
                    src={peerProfilePic}
                    name={peerName}
                    alt={peerName}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium leading-tight text-white/90">{remoteLabel}</p>
                <p className="text-xs leading-tight text-white/65">Video call</p>
              </div>
            </div>
            <div className="absolute right-4 top-5 flex h-9 min-w-0 max-w-[48%] items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 text-xs leading-tight text-white/85 shadow-lg backdrop-blur sm:max-w-none">
              <span
                className={`size-2 shrink-0 rounded-full ${
                  isConnected ? "bg-success" : hasDeviceError ? "bg-warning" : "bg-info"
                }`}
              />
              <span className="min-w-0 truncate font-medium">{connectionLabel}</span>
              <span className="text-white/35">|</span>
              <span className="font-mono">{callDurationLabel}</span>
              <span className="hidden text-white/35 sm:inline">|</span>
              <span className="hidden sm:inline">{isMuted ? "Mic off" : "Mic on"}</span>
              <span className="hidden text-white/35 sm:inline">|</span>
              <span className="hidden sm:inline">{isCameraOff ? "Camera off" : "Camera on"}</span>
            </div>
          </div>

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-[52vh] w-full bg-neutral object-cover sm:h-[64vh] xl:h-[72vh]"
          />

          {!isConnected ? (
            <div
              className={`absolute inset-0 flex items-center justify-center px-6 ${
                hasDeviceError ? "" : "pointer-events-none"
              }`}
            >
              <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-5 text-center shadow-lg backdrop-blur-md">
                {hasDeviceError ? (
                  <>
                    <AlertTriangleIcon className="mx-auto mb-3 size-8 text-warning" />
                    <p className="text-lg font-semibold text-white">Camera or microphone blocked</p>
                    <p className="mt-2 max-w-sm text-sm text-white/70">
                      Check browser permissions for this site, then try joining again.
                    </p>
                    <button
                      type="button"
                      className="btn btn-warning btn-sm mt-4 gap-2 rounded-full"
                      onClick={retryDeviceAccess}
                    >
                      <RefreshCwIcon className="size-4" />
                      Retry
                    </button>
                  </>
                ) : (
                  <>
                    <div className="avatar mb-3">
                      <div className="w-16 rounded-full ring ring-white/20">
                        <AvatarImage
                          src={peerProfilePic}
                          name={peerName}
                          alt={peerName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-white">{statusText}</p>
                    <p className="mt-2 text-sm text-white/70">
                      Keep this screen open while the call invite is being handled.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-4 right-4 z-10 w-36 overflow-hidden rounded-3xl border border-white/15 bg-black/45 shadow-2xl backdrop-blur sm:w-44">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-24 w-full bg-neutral object-cover sm:h-28"
            />
            <div className="flex items-center justify-between px-3 py-2 text-xs text-white/80">
              <span>You</span>
              <span>{isCameraOff ? "Camera off" : "Live preview"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-base-300 bg-base-100/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Call controls</p>
              <p className="text-sm opacity-65">
                {isConnected ? `Call time ${callDurationLabel}` : "Mute audio, pause camera, or leave the call."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                className={`btn gap-2 rounded-2xl px-5 ${isMuted ? "btn-warning" : "btn-outline"}`}
                onClick={toggleMute}
                type="button"
              >
                {isMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button
                className={`btn gap-2 rounded-2xl px-5 ${isCameraOff ? "btn-warning" : "btn-outline"}`}
                onClick={toggleCamera}
                type="button"
              >
                {isCameraOff ? <VideoOffIcon className="size-5" /> : <VideoIcon className="size-5" />}
                {isCameraOff ? "Turn camera on" : "Turn camera off"}
              </button>
              <button className="btn btn-error gap-2 rounded-2xl px-6" onClick={leaveCall} type="button">
                <PhoneOffIcon className="size-5" />
                End call
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallPage;
