import { useLocation, useParams } from "react-router";
import {
  AlertTriangleIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  RefreshCwIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";

import AvatarImage from "../components/AvatarImage";
import PageLoader from "../components/PageLoader";
import useVideoCallSession from "../hooks/useVideoCallSession";

const CallPage = () => {
  const { id: callId } = useParams();
  const location = useLocation();
  const {
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
  } = useVideoCallSession({ callId, locationSearch: location.search });

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
