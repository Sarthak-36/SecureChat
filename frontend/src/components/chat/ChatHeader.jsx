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
  searchInputRef,
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
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
      <div className="min-w-0 flex-1 items-center gap-3 flex">
        <ToggleDropdown
          contentClassName="w-56 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
          renderTrigger={({ toggle }) => (
            <button type="button" className="avatar cursor-pointer" onClick={toggle}>
              <div className="w-10 rounded-full sm:w-12">
                <AvatarImage
                  src={targetUser?.profilePic}
                  name={targetUser?.fullName}
                  alt={targetUser?.fullName || "Friend"}
                  className="h-full w-full object-cover"
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
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {targetUser?.fullName || "Conversation"}
          </h1>
          <div className="flex min-w-0 items-center gap-2 text-xs opacity-70 sm:text-sm">
            <span className={`size-2 rounded-full ${isTargetUserOnline ? "bg-success" : "bg-base-content/30"}`} />
            <p className="truncate">{socketReady ? (isTargetUserOnline ? "Online" : "Offline") : "Connecting..."}</p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        <div
          className={`overflow-hidden transition-[width,opacity] duration-200 ease-out ${
            isSearchExpanded ? "w-44 opacity-100 sm:w-72 md:w-80" : "w-0 opacity-0"
          }`}
        >
          <label className="input input-bordered input-sm flex min-w-0 items-center gap-2">
            <SearchIcon className="size-4 shrink-0 opacity-70" />
            <input
              ref={searchInputRef}
              type="text"
              value={messageSearch}
              onChange={onChangeSearch}
              placeholder="Search messages"
              className="min-w-0 flex-1 bg-transparent"
            />
          </label>
        </div>

        {isSearchExpanded ? (
          <>
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
        <span className="inline-flex">
          <CallButton handleVideoCall={handleVideoCall} />
        </span>
      </div>
    </div>
    {isSearchExpanded && normalizedMessageSearch ? (
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pb-3 text-sm opacity-70">
        <span>
          {matchingMessageCount === 0
            ? "0 messages found"
            : `${activeSearchMatchIndex + 1} of ${matchingMessageCount} matches from bottom`}
        </span>
        {matchingMessageCount === 0 ? <span>No matches for this search</span> : null}
      </div>
    ) : null}
  </div>
);

export default ChatHeader;
