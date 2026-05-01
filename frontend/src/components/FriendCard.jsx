import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import AvatarImage from "./AvatarImage";
import ToggleDropdown from "./ToggleDropdown";
import { removeFriend } from "../lib/api";

const FriendCard = ({ friend, isOnline = false, showOnlineStatus = false }) => {
  const subtitle = friend.lastMessageText || friend.bio || friend.location || "Start chatting";
  const queryClient = useQueryClient();

  const { mutate: removeFriendMutation, isPending: isRemovingFriend } = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      toast.success(`${friend.fullName} removed from your friend list`);
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not remove friend");
    },
  });

  const handleRemoveFriend = () => {
    if (!window.confirm(`Remove ${friend.fullName} from your friend list?`)) {
      return;
    }

    removeFriendMutation(friend._id);
  };

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex flex-1 items-center gap-3 overflow-hidden">
          <ToggleDropdown
            contentClassName="w-56 rounded-2xl border border-base-300 bg-base-100 p-3 shadow-xl"
            renderTrigger={({ toggle }) => (
              <button type="button" className="avatar cursor-pointer" onClick={toggle}>
                <div className="w-12 rounded-full">
                  <AvatarImage src={friend.profilePic} name={friend.fullName} alt={friend.fullName} />
                </div>
              </button>
            )}
          >
            {({ close }) => (
              <button
                type="button"
                className="btn btn-error btn-outline btn-sm w-full"
                onClick={() => {
                  handleRemoveFriend();
                  close();
                }}
                disabled={isRemovingFriend}
              >
                {isRemovingFriend ? "Removing..." : "Remove from friend list"}
              </button>
            )}
          </ToggleDropdown>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-semibold">{friend.fullName}</h3>
              {showOnlineStatus ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 text-xs ${isOnline ? "text-success" : "opacity-50"}`}
                >
                  <span className={`size-2 rounded-full ${isOnline ? "bg-success" : "bg-base-content/30"}`} />
                  {isOnline ? "Online" : "Offline"}
                </span>
              ) : null}
              {friend.unreadCount > 0 ? (
                <span className="badge badge-primary badge-sm shrink-0">{friend.unreadCount}</span>
              ) : null}
            </div>
            <p
              className="mt-0.5 overflow-hidden text-sm leading-5 opacity-70"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
              title={subtitle}
            >
              {subtitle}
            </p>
          </div>
        </div>

        <Link to={`/chat/${friend._id}`} className="btn btn-outline btn-sm shrink-0">
          Message
        </Link>
      </div>
    </div>
  );
};
export default FriendCard;
