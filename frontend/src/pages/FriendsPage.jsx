import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import FriendCard from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";
import SearchInput from "../components/SearchInput";
import { getUserFriends } from "../lib/api";

const matchesFriend = (friend, searchTerm) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (!normalizedSearchTerm) return true;

  return [friend.fullName, friend.email, friend.bio, friend.location]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
};

const FriendsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    refetchInterval: 10000,
  });

  const filteredFriends = useMemo(
    () => friends.filter((friend) => matchesFriend(friend, searchTerm)),
    [friends, searchTerm]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">All Friends</h1>
            <p className="opacity-70">Everyone you are connected with in SecureChat.</p>
          </div>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search friends by name, email, or location"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : filteredFriends.length === 0 ? (
          <NoFriendsFound />
        ) : (
          <div className="space-y-3">
            {filteredFriends.map((friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
