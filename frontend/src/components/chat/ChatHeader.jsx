import { ChevronDownIcon, ChevronUpIcon, SearchIcon, UserMinusIcon, XIcon } from "lucide-react";

import AvatarImage from "../AvatarImage";
import CallButton from "../CallButton";
import ToggleDropdown from "../ToggleDropdown";

const ChatHeader = ({
  handleVideoCall,
  activeSearchMatchIndex,
  isClearingConversation,
  isRemovingFriend,
  isTargetUserOnline,
  isSearchExpanded,
  matchingMessageCount,
  messageSearch,
  normalizedMessageSearch,
  onChangeSearch,
  onClearConversation,
  onCollapseSearch,
  onExpandSearch,
  onJumpToNextSearchMatch,
  onJumpToPreviousSearchMatch,
  onRemoveFriend,
  socketReady,
  targetUser,
}) => (
  <div className="border-b border-base-300">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex items-center gap-3">
        <ToggleDropdown
          contentClassName="w-56 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
          renderTrigger={({ toggle }) => (
            <button type="button" className="avatar cursor-pointer" onClick={toggle}>
              <div className="w-12 rounded-full">
                <AvatarImage
                  src={targetUser?.profilePic}
                  name={targetUser?.fullName}
                  alt={targetUser?.fullName || "Friend"}
                />
              </div>
            </button>
          )}
        >
          {({ close }) => (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => {
                  onClearConversation();
                  close();
                }}
                disabled={isClearingConversation}
              >
                {isClearingConversation ? "Clearing..." : "Clear chat"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full justify-start text-error"
                onClick={() => {
                  onRemoveFriend();
                  close();
                }}
                disabled={isRemovingFriend}
              >
                <UserMinusIcon className="size-4" />
                {isRemovingFriend ? "Removing..." : "Remove from friend list"}
              </button>
            </>
          )}
        </ToggleDropdown>
        <div>
          <h1 className="font-semibold text-lg">{targetUser?.fullName || "Conversation"}</h1>
          <div className="flex items-center gap-2 text-sm opacity-70">
            <span className={`size-2 rounded-full ${isTargetUserOnline ? "bg-success" : "bg-base-content/30"}`} />
            <p>{socketReady ? (isTargetUserOnline ? "Online" : "Offline") : "Connecting..."}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isSearchExpanded ? (
          <>
            <label className="input input-bordered input-sm flex items-center gap-2">
              <SearchIcon className="size-4 opacity-70" />
              <input
                type="text"
                value={messageSearch}
                onChange={onChangeSearch}
                placeholder="Search messages"
                className="w-40 bg-transparent"
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-sm"
              onClick={onJumpToPreviousSearchMatch}
              disabled={!matchingMessageCount}
            >
              <ChevronUpIcon className="size-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-sm"
              onClick={onJumpToNextSearchMatch}
              disabled={!matchingMessageCount}
            >
              <ChevronDownIcon className="size-4" />
            </button>
            <button type="button" className="btn btn-ghost btn-circle btn-sm" onClick={onCollapseSearch}>
              <XIcon className="size-4" />
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-circle btn-sm" onClick={onExpandSearch}>
            <SearchIcon className="size-4" />
          </button>
        )}
        <CallButton handleVideoCall={handleVideoCall} />
      </div>
    </div>
    {isSearchExpanded && normalizedMessageSearch ? (
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pb-3 text-sm opacity-70">
        <span>
          {matchingMessageCount === 0
            ? "0 messages found"
            : `${activeSearchMatchIndex + 1} of ${matchingMessageCount} matches`}
        </span>
        {matchingMessageCount === 0 ? <span>No matches for this search</span> : null}
      </div>
    ) : null}
  </div>
);

export default ChatHeader;
