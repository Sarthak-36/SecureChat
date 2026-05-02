import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import useAuthUser from "../hooks/useAuthUser";
import useRingtone from "../hooks/useRingtone";
import { getChatToken } from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";
import IncomingCallDialog from "./IncomingCallDialog";

const IncomingCallManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });

  const { stopRingtone } = useRingtone(Boolean(incomingCall));

  useEffect(() => {
    if (!authUser || !tokenData?.token) return;

    const socket = new WebSocket(getWebSocketUrl(tokenData.token));
    socketRef.current = socket;

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "incoming_call_invite") {
        if (location.pathname.startsWith("/call/")) {
          socket.send(
            JSON.stringify({
              type: "call_invite_response",
              callId: payload.callId,
              recipientId: payload.fromUserId,
              accepted: false,
              reason: "busy",
            })
          );
          return;
        }

        setIncomingCall(payload);
      }

      if (payload.type === "call_invite_timeout") {
        setIncomingCall((currentCall) => {
          if (currentCall?.callId === payload.callId) {
            stopRingtone();
            toast("Call timed out");
            return null;
          }

          return currentCall;
        });
      }

      if (payload.type === "call_invite_cancelled") {
        setIncomingCall((currentCall) => {
          if (currentCall?.callId === payload.callId) {
            stopRingtone();
            return null;
          }

          return currentCall;
        });
      }

      if (payload.type === "call_invite_response" && !payload.accepted && !location.pathname.startsWith("/call/")) {
        if (payload.reason === "busy") {
          toast.error(`${payload.responderName || "The other person"} is already on a call`);
        } else if (payload.reason === "declined") {
          toast.error(`${payload.responderName || "The other person"} declined the call`);
        } else if (payload.reason === "unavailable") {
          toast.error("The other person is not available for a call right now");
        }
      }
    });

    return () => {
      stopRingtone();
      socket.close();
    };
  }, [authUser, tokenData?.token, location.pathname, stopRingtone]);

  const handleAccept = () => {
    if (!incomingCall || !socketRef.current) return;

    stopRingtone();
    socketRef.current.send(
      JSON.stringify({
        type: "call_invite_response",
        callId: incomingCall.callId,
        recipientId: incomingCall.fromUserId,
        accepted: true,
      })
    );
    const acceptedCall = incomingCall;
    setIncomingCall(null);
    navigate(`/call/${acceptedCall.callId}?mode=incoming&peer=${acceptedCall.fromUserId}`);
  };

  const handleDecline = () => {
    if (!incomingCall || !socketRef.current) return;

    stopRingtone();
    socketRef.current.send(
      JSON.stringify({
        type: "call_invite_response",
        callId: incomingCall.callId,
        recipientId: incomingCall.fromUserId,
        accepted: false,
        reason: "declined",
      })
    );
    setIncomingCall(null);
  };

  return (
    <IncomingCallDialog incomingCall={incomingCall} onAccept={handleAccept} onDecline={handleDecline} />
  );
};

export default IncomingCallManager;
