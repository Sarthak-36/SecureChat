import { PhoneIcon, PhoneOffIcon } from "lucide-react";

import AvatarImage from "./AvatarImage";

const IncomingCallDialog = ({ incomingCall, onAccept, onDecline }) => {
  if (!incomingCall) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center p-4">
      <div className="pointer-events-auto mt-6 w-full max-w-sm rounded-3xl border border-base-300 bg-base-100 p-5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="avatar">
            <div className="w-14 rounded-full">
              <AvatarImage
                src={incomingCall.fromUserProfilePic}
                name={incomingCall.fromUserName}
                alt={incomingCall.fromUserName}
              />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm opacity-70">Incoming call</p>
            <h3 className="truncate text-lg font-semibold">{incomingCall.fromUserName}</h3>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onDecline}>
            <PhoneOffIcon className="size-4" />
            Decline
          </button>
          <button type="button" className="btn btn-whatsapp" onClick={onAccept}>
            <PhoneIcon className="size-4" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallDialog;
