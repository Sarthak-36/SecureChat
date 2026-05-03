import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MicIcon, MicOffIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import toast from "react-hot-toast";

import PageLoader from "../components/PageLoader";
import useAuthUser from "../hooks/useAuthUser";
import { getChatToken } from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];

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

const getStatusTone = (statusText) => {
  const normalized = statusText.toLowerCase();

  if (normalized.includes("connected")) {
    return "badge-success";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("declined") ||
    normalized.includes("offline") ||
    normalized.includes("busy") ||
    normalized.includes("unavailable") ||
    normalized.includes("no answer")
  ) {
    return "badge-warning";
  }

  if (normalized.includes("preparing") || normalized.includes("joining") || normalized.includes("ringing")) {
    return "badge-info";
  }

  return "badge-ghost";
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

  const [isInitializing, setIsInitializing] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [statusText, setStatusText] = useState("Preparing your devices...");

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const callMode = searchParams.get("mode");
  const peerId = searchParams.get("peer");

  const { authUser, isLoading } = useAuthUser();
  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });

  const statusTone = useMemo(() => getStatusTone(statusText), [statusText]);
  const isConnected = statusText === "Connected";
  const remoteLabel = peerId ? "Remote participant" : "Waiting for participant";

  const syncLocalMediaState = () => {
    if (!localStreamRef.current) return;

    for (const audioTrack of localStreamRef.current.getAudioTracks()) {
      audioTrack.enabled = !isMutedRef.current;
    }

    for (const videoTrack of localStreamRef.current.getVideoTracks()) {
      videoTrack.enabled = !isCameraOffRef.current;
    }
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
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

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
          }

          if (payload.type === "call_invite_pending_offline" && payload.callId === callId) {
            setStatusText("The other person is offline. Waiting for timeout...");
          }

          if (payload.type === "call_invite_timeout" && payload.callId === callId) {
            setStatusText("No answer");
            toast.error("No one answered the call");
            window.setTimeout(() => {
              navigate(peerId ? `/chat/${peerId}` : "/");
            }, 1200);
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
        setStatusText("Device access failed");
        setIsInitializing(false);
      }
    };

    setupCall();

    const handleVisibilitySync = () => {
      syncLocalMediaState();
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
  }, [authUser, tokenData?.token, callId, callMode, navigate, peerId]);

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
  }, [isCameraOff, isMuted]);

  const leaveCall = () => {
    navigate("/");
  };

  if (isLoading || isInitializing) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-base-300 px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-[28px] border border-base-300 bg-base-100/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">Video Call</h1>
                <span className={`badge ${statusTone}`}>{statusText}</span>
              </div>
              <p className="mt-2 max-w-2xl text-sm opacity-70">
                {callMode === "outgoing"
                  ? "Stay here while we connect your call. Your preview stays available so you can quickly check mic and camera."
                  : "You are in the call room. Use the controls below to manage your mic and camera."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="badge badge-outline">{isMuted ? "Mic off" : "Mic on"}</div>
              <div className="badge badge-outline">{isCameraOff ? "Camera off" : "Camera on"}</div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[32px] border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 via-black/25 to-transparent px-4 py-4">
            <div>
              <p className="text-sm font-medium text-white/90">{remoteLabel}</p>
              <p className="text-xs text-white/65">{isConnected ? "Live video is active" : statusText}</p>
            </div>
            <span className={`badge border-none px-3 py-3 text-white ${statusTone}`}>
              {isConnected ? "Live" : "Connecting"}
            </span>
          </div>

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-[52vh] w-full bg-neutral object-cover sm:h-[64vh] xl:h-[72vh]"
          />

          {!isConnected ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
              <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-5 text-center shadow-lg backdrop-blur-md">
                <p className="text-lg font-semibold text-white">{statusText}</p>
                <p className="mt-2 text-sm text-white/70">
                  Keep this screen open while the call invite is being handled.
                </p>
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
              <p className="text-sm opacity-65">Mute audio, pause camera, or leave the call.</p>
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
