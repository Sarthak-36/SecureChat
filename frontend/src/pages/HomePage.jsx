import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserFriends } from "../lib/api";
import { Link } from "react-router";
import { MessageSquareIcon, UsersIcon } from "lucide-react";
import FriendCard from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";
import SearchInput from "../components/SearchInput";
import usePresence from "../hooks/usePresence";

const NoRecentChats = () => (
  <div className="card bg-base-200 p-6 text-center">
    <h3 className="font-semibold text-lg mb-2">No recent chats yet</h3>
    <p className="text-base-content opacity-70">
      Start a conversation with a friend and it will appear here.
    </p>
  </div>
);

const HomePage = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    refetchInterval: 10000,
  });

  const recentChats = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return friends.filter((friend) => {
      if (!friend.lastMessageAt) return false;
      if (!normalizedSearchTerm) return true;

      return [friend.fullName, friend.email, friend.lastMessageText, friend.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
    });
  }, [friends, searchTerm]);

  const onlineUserIds = usePresence(recentChats.map((friend) => friend._id));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Recent Chats</h1>
            <p className="opacity-70">Friends you have already chatted with appear here.</p>
          </div>
          <div className="w-full lg:w-[34rem] xl:w-[38rem]">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search recent chats by name or last message"
              maxWidthClassName="max-w-none"
            />
          </div>
        </div>

        <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4">
          <Link to="/notifications" className="btn btn-outline btn-sm">
            <UsersIcon className="mr-2 size-4" />
            Friend Requests
          </Link>
          <Link to="/friends" className="btn btn-ghost btn-sm">
            <MessageSquareIcon className="mr-2 size-4" />
            View all friends
          </Link>
        </div>

        {loadingFriends ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : recentChats.length === 0 ? (
          <NoRecentChats />
        ) : (
          <div className="space-y-3">
            {recentChats.map((friend) => (
              <FriendCard
                key={friend._id}
                friend={friend}
                isOnline={onlineUserIds.has(friend._id)}
                showOnlineStatus
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
