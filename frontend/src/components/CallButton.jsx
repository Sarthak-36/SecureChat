import { VideoIcon } from "lucide-react";

function CallButton({ handleVideoCall }) {
  return (
    <button onClick={handleVideoCall} className="btn btn-sm btn-whatsapp">
      <VideoIcon className="size-5" />
    </button>
  );
}

export default CallButton;
