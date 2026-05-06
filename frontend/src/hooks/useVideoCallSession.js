import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import useAuthUser from "./useAuthUser";
import { getChatToken, getUserFriends } from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const outgoingCallTimeoutMs = 32_000;
const CALL_STATUS = {
  ANSWERED_CONNECTING: "Answered. Connecting...",
  CONNECTED: "Connected",
  CONNECTING: "Connecting...",
  CONNECTION_FAILED: "Connection failed",
  DECLINED: "Call declined",
  DEVICE_ACCESS_FAILED: "Device access failed",
  JOINING: "Joining the call...",
  NO_ANSWER: "No answer",
  OFFLINE_WAITING: "The other person is offline. Waiting for timeout...",
  PEER_DISCONNECTED: "Peer disconnected",
  PEER_LEFT: "The other person left the call",
  PREPARING: "Preparing your devices...",
  RINGING: "Ringing...",
  SIGNALING_CLOSED: "Call signaling closed",
  SIGNALING_FAILED: "Call signaling failed",
  UNAVAILABLE: "The other person is unavailable",
  USER_BUSY: "The other person is busy",
};

const getInitialCallStatus = (callMode) =>
  callMode === "outgoing" ? CALL_STATUS.RINGING : CALL_STATUS.JOINING;

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

const useVideoCallSession = ({ callId, locationSearch }) => {
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
  const isCallEndingRef = useRef(false);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [statusText, setStatusText] = useState(CALL_STATUS.PREPARING);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [deviceError, setDeviceError] = useState(null);
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [hasCallInviteAnswered, setHasCallInviteAnswered] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch]);
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
  const isConnected = statusText === CALL_STATUS.CONNECTED;
  const remoteLabel = peerId ? peerName : "Waiting for participant";
  const callDurationLabel = formatCallDuration(elapsedSeconds);
  const hasDeviceError = Boolean(deviceError);
  const connectionLabel = isConnected ? CALL_STATUS.CONNECTED : statusText;

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

  const clearOutgoingCallTimeout = useCallback(() => {
    if (outgoingTimeoutRef.current) {
      window.clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }
  }, []);

  const sendLeaveCall = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({ type: "leave_call", callId }));
    socketRef.current.close();
  }, [callId]);

  const finishCallAndReturn = useCallback(
    (nextStatusText, delayMs = 1200) => {
      isCallEndingRef.current = true;
      clearOutgoingCallTimeout();
      setStatusText(nextStatusText);

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteStreamRef.current = new MediaStream();

      scheduleReturnFromCall(delayMs);
    },
    [clearOutgoingCallTimeout, scheduleReturnFromCall]
  );

  const retryDeviceAccess = () => {
    isCallEndingRef.current = false;
    setDeviceError(null);
    setStatusText(CALL_STATUS.PREPARING);
    setIsInitializing(true);
    setSetupAttempt((currentAttempt) => currentAttempt + 1);
  };

  useEffect(() => {
    isCallEndingRef.current = false;
    setHasCallInviteAnswered(false);
    clearOutgoingCallTimeout();
  }, [callId, clearOutgoingCallTimeout]);

  useEffect(() => {
    if (callMode !== "outgoing" || isConnected || hasDeviceError || hasCallInviteAnswered) {
      clearOutgoingCallTimeout();
      return undefined;
    }

    clearOutgoingCallTimeout();

    outgoingTimeoutRef.current = window.setTimeout(() => {
      toast.error("No one answered the call");
      finishCallAndReturn(CALL_STATUS.NO_ANSWER);
    }, outgoingCallTimeoutMs);

    return () => {
      clearOutgoingCallTimeout();
    };
  }, [
    callMode,
    clearOutgoingCallTimeout,
    hasCallInviteAnswered,
    hasDeviceError,
    finishCallAndReturn,
    isConnected,
  ]);

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
    if (!authUser || !tokenData?.token || !callId || isCallEndingRef.current) return;

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
        if (isCallEndingRef.current) return;

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
        setStatusText(CALL_STATUS.CONNECTED);
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
        if (isCallEndingRef.current) return;

        const state = peerConnection.connectionState;
        if (state === "connected") {
          setStatusText(CALL_STATUS.CONNECTED);
        } else if (state === "connecting") {
          setStatusText(CALL_STATUS.CONNECTING);
        } else if (state === "failed") {
          setStatusText(CALL_STATUS.CONNECTION_FAILED);
        } else if (state === "disconnected") {
          setStatusText(CALL_STATUS.PEER_DISCONNECTED);
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
          if (isCallEndingRef.current) {
            socket.close();
            return;
          }

          setStatusText(getInitialCallStatus(callMode));
          socket.send(JSON.stringify({ type: "join_call", callId }));
          setIsInitializing(false);
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(event.data);

          if (payload.userId === authUser._id) return;
          if (isCallEndingRef.current) return;

          if (payload.type === "peer_joined") {
            setStatusText(CALL_STATUS.CONNECTING);
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
            finishCallAndReturn(CALL_STATUS.PEER_LEFT);
          }

          if (payload.type === "call_invite_response" && payload.callId === callId) {
            if (payload.accepted) {
              setHasCallInviteAnswered(true);
              clearOutgoingCallTimeout();
              setStatusText(CALL_STATUS.ANSWERED_CONNECTING);
            } else if (payload.reason === "declined") {
              toast.error(`${payload.responderName || "The other person"} declined the call`);
              finishCallAndReturn(CALL_STATUS.DECLINED);
            } else if (payload.reason === "busy") {
              toast.error(`${payload.responderName || "The other person"} is already on a call`);
              finishCallAndReturn(CALL_STATUS.USER_BUSY);
            } else if (payload.reason === "unavailable") {
              toast.error("The other person is not available for a call right now");
              finishCallAndReturn(CALL_STATUS.UNAVAILABLE);
            }
          }

          if (payload.type === "call_invite_pending_offline" && payload.callId === callId) {
            setStatusText(CALL_STATUS.OFFLINE_WAITING);
          }

          if (payload.type === "call_invite_timeout" && payload.callId === callId) {
            toast.error("No one answered the call");
            finishCallAndReturn(CALL_STATUS.NO_ANSWER);
          }

          if (payload.type === "error") {
            toast.error(payload.message);
          }
        });

        socket.addEventListener("error", () => {
          toast.error("Could not connect to call signaling");
          setStatusText(CALL_STATUS.SIGNALING_FAILED);
          setIsInitializing(false);
        });

        socket.addEventListener("close", () => {
          if (!isCancelled && !isCallEndingRef.current) {
            setStatusText(CALL_STATUS.SIGNALING_CLOSED);
          }
        });
      } catch (error) {
        console.error("Error initializing call", error);
        toast.error("Camera or microphone access failed.");
        setDeviceError(error);
        setStatusText(CALL_STATUS.DEVICE_ACCESS_FAILED);
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
    const remoteVideoElement = remoteVideoRef.current;

    return () => {
      isCancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilitySync);
      window.removeEventListener("focus", handleVisibilitySync);
      window.removeEventListener("pageshow", handleVisibilitySync);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }

      clearOutgoingCallTimeout();

      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      pendingIceCandidatesRef.current = [];

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }

      if (remoteVideoElement) {
        remoteVideoElement.srcObject = null;
      }
      remoteStreamRef.current = null;
    };
  }, [
    authUser,
    tokenData?.token,
    callId,
    callMode,
    clearOutgoingCallTimeout,
    finishCallAndReturn,
    setupAttempt,
  ]);

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
    isCallEndingRef.current = true;
    sendLeaveCall();
    returnFromCall();
  };

  return {
    callDurationLabel,
    connectionLabel,
    hasDeviceError,
    isCameraOff,
    isConnected,
    isInitializing,
    isLoading,
    isMuted,
    leaveCall,
    localVideoRef,
    peerName,
    peerProfilePic,
    remoteLabel,
    remoteVideoRef,
    retryDeviceAccess,
    statusText,
    toggleCamera,
    toggleMute,
  };
};

export default useVideoCallSession;
