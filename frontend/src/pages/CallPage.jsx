import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MicIcon, MicOffIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import toast from "react-hot-toast";

import PageLoader from "../components/PageLoader";
import useAuthUser from "../hooks/useAuthUser";
import { getChatToken } from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CallPage = () => {
  const { id: callId } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [statusText, setStatusText] = useState("Preparing your devices...");

  const { authUser, isLoading } = useAuthUser();
  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    if (!authUser || !tokenData?.token || !callId) return;

    let isCancelled = false;

    const ensurePeerConnection = () => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const peerConnection = new RTCPeerConnection(rtcConfig);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          peerConnection.addTrack(track, localStreamRef.current);
        }
      }

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
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

        if (isCancelled) return;

        localStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        const socket = new WebSocket(getWebSocketUrl(tokenData.token));
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          setStatusText("Waiting for the other person...");
          socket.send(JSON.stringify({ type: "join_call", callId }));
          setIsInitializing(false);
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(event.data);

          if (payload.userId === authUser._id) return;

          if (payload.type === "peer_joined") {
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
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(payload.signal.candidate));
              } catch (error) {
                console.error("Error adding ICE candidate", error);
              }
            }
          }

          if (payload.type === "peer_left") {
            setStatusText("The other person left the call");
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = null;
            }
          }

          if (payload.type === "error") {
            toast.error(payload.message);
          }
        });

        socket.addEventListener("error", () => {
          toast.error("Could not connect to call signaling");
          setIsInitializing(false);
        });
      } catch (error) {
        console.error("Error initializing call", error);
        toast.error("Camera or microphone access failed.");
        setStatusText("Device access failed");
        setIsInitializing(false);
      }
    };

    setupCall();

    return () => {
      isCancelled = true;

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "leave_call", callId }));
        socketRef.current.close();
      }

      peerConnectionRef.current?.close();

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, [authUser, tokenData?.token, callId]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;

    const nextMuted = !isMuted;
    for (const audioTrack of localStreamRef.current.getAudioTracks()) {
      audioTrack.enabled = !nextMuted;
    }
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    const nextCameraOff = !isCameraOff;
    for (const videoTrack of localStreamRef.current.getVideoTracks()) {
      videoTrack.enabled = !nextCameraOff;
    }
    setIsCameraOff(nextCameraOff);
  };

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
