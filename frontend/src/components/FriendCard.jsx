import { Link } from "react-router";
import AvatarImage from "./AvatarImage";

const FriendCard = ({ friend }) => {
  const subtitle = friend.lastMessageText || friend.bio || friend.location || "Start chatting";

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <div className="avatar">
            <div className="w-12 rounded-full">
              <AvatarImage src={friend.profilePic} name={friend.fullName} alt={friend.fullName} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{friend.fullName}</h3>
              {friend.unreadCount > 0 ? (
                <span className="badge badge-primary badge-sm shrink-0">{friend.unreadCount}</span>
              ) : null}
            </div>
            <p className="truncate text-sm opacity-70">{subtitle}</p>
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
