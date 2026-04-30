import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, MapPinIcon, UserPlusIcon } from "lucide-react";
import toast from "react-hot-toast";

import AvatarImage from "../components/AvatarImage";
import SearchInput from "../components/SearchInput";
import { getOutgoingFriendReqs, getRecommendedUsers, sendFriendRequest } from "../lib/api";

const matchesUser = (user, searchTerm) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (!normalizedSearchTerm) return true;

  return [user.fullName, user.email, user.location]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
};

const DiscoverPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());

  const { data: recommendedUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      toast.success("Friend request sent");
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not send friend request");
    },
  });

  useEffect(() => {
    const outgoingIds = new Set();
    for (const request of outgoingFriendReqs || []) {
      outgoingIds.add(request.recipient._id);
    }
    setOutgoingRequestsIds(outgoingIds);
  }, [outgoingFriendReqs]);

  const filteredUsers = useMemo(
    () => recommendedUsers.filter((user) => matchesUser(user, searchTerm)),
    [recommendedUsers, searchTerm]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Discover People</h1>
            <p className="opacity-70">Find new people, send requests, and start chatting.</p>
          </div>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search people by name, email, or location"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="card bg-base-200 p-6 text-center">
            <h3 className="font-semibold text-lg mb-2">No recommendations available</h3>
            <p className="text-base-content opacity-70">
              Try a different search or check back later for more people to meet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const hasRequestBeenSent = outgoingRequestsIds.has(user._id);

              return (
                <div
                  key={user._id}
                  className="rounded-2xl bg-base-200 p-4 shadow-sm transition-all duration-300 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="avatar">
                        <div className="w-12 rounded-full">
                          <AvatarImage src={user.profilePic} name={user.fullName} alt={user.fullName} />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-lg">{user.fullName}</h3>
                        <p className="truncate text-xs opacity-70">{user.email}</p>
                        {user.location ? (
                          <div className="mt-1 flex items-center text-xs opacity-70">
                            <MapPinIcon className="mr-1 size-3" />
                            {user.location}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <button
                      className={`btn btn-sm shrink-0 ${hasRequestBeenSent ? "btn-disabled" : "btn-primary"}`}
                      onClick={() => sendRequestMutation(user._id)}
                      disabled={hasRequestBeenSent || isPending}
                    >
                      {hasRequestBeenSent ? (
                        <>
                          <CheckCircleIcon className="size-4 mr-2" />
                          Request Sent
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="size-4 mr-2" />
                          Send Friend Request
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
