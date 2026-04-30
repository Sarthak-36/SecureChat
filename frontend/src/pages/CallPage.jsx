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

  const { authUser, isLoading } = useAuthUser();
  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });

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

          if (payload.type === "call_invite_response" && payload.callId === callId && !payload.accepted) {
            if (payload.reason === "declined") {
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
  }, [authUser, tokenData?.token, callId, callMode]);

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
    <div className="min-h-screen bg-base-300 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Video Call</h1>
            <p className="text-sm opacity-70">{statusText}</p>
          </div>
          <div className="badge badge-outline">Room {callId.slice(0, 8)}</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-neutral text-neutral-content overflow-hidden shadow-xl">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-[40vh] w-full object-cover" />
            <div className="p-4 text-sm opacity-80">You</div>
          </div>

          <div className="rounded-3xl bg-neutral text-neutral-content overflow-hidden shadow-xl">
            <video ref={remoteVideoRef} autoPlay playsInline className="h-[40vh] w-full object-cover" />
            <div className="p-4 text-sm opacity-80">Remote participant</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button className="btn btn-circle" onClick={toggleMute} type="button">
            {isMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
          </button>
          <button className="btn btn-circle" onClick={toggleCamera} type="button">
            {isCameraOff ? <VideoOffIcon className="size-5" /> : <VideoIcon className="size-5" />}
          </button>
          <button className="btn btn-error btn-circle" onClick={leaveCall} type="button">
            <PhoneOffIcon className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallPage;
