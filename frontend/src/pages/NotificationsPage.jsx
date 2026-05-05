import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  acceptFriendRequest,
  clearAcceptedFriendRequestNotifications,
  getFriendRequests,
  hideAcceptedFriendRequestNotification,
  markNotificationsRead,
} from "../lib/api";
import { BellIcon, ClockIcon, MessageSquareIcon, Trash2Icon, UserCheckIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import AvatarImage from "../components/AvatarImage";
import NoNotificationsFound from "../components/NoNotificationsFound";
import SearchInput from "../components/SearchInput";

const getRelativeTimeLabel = (timestamp) => {
  const date = new Date(timestamp);
  const time = date.getTime();

  if (!timestamp || Number.isNaN(time)) return "Recently";

  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 45) return "Just now";
  if (minutes < 2) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 2) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (weeks < 2) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  if (months < 2) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  if (years < 2) return "1 year ago";

  return `${years} years ago`;
};

const getNotificationTimestamp = (notification) => notification.updatedAt || notification.createdAt;

const getReadableDateLabel = (timestamp) => {
  const date = new Date(timestamp);
  return timestamp && !Number.isNaN(date.getTime()) ? date.toLocaleString() : undefined;
};

const getConnectionUser = (notification) => notification.connection || notification.recipient || notification.sender;

const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: friendRequests, dataUpdatedAt, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
  });

  const { mutate: acceptRequestMutation, isPending } = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      toast.success("Friend request accepted");
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not accept friend request");
    },
  });

  const { mutate: hideConnectionNotification, isPending: isHidingNotification } = useMutation({
    mutationFn: hideAcceptedFriendRequestNotification,
    onSuccess: () => {
      toast.success("Notification deleted");
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not delete notification");
    },
  });

  const { mutate: clearConnectionNotifications, isPending: isClearingNotifications } = useMutation({
    mutationFn: clearAcceptedFriendRequestNotifications,
    onSuccess: () => {
      toast.success("Connection notifications cleared");
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not clear notifications");
    },
  });

  const { mutate: markVisibleNotificationsRead } = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    },
  });

  const incomingRequests = friendRequests?.incomingReqs || [];
  const acceptedRequests = friendRequests?.acceptedReqs || [];
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  useEffect(() => {
    if (!friendRequests) return;
    markVisibleNotificationsRead();
  }, [dataUpdatedAt, friendRequests, markVisibleNotificationsRead]);

  const filteredIncomingRequests = useMemo(
    () =>
      incomingRequests.filter((request) =>
        [request.sender.fullName, request.sender.location]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearchTerm))
      ),
    [incomingRequests, normalizedSearchTerm]
  );

  const filteredAcceptedRequests = useMemo(
    () =>
      acceptedRequests.filter((notification) => {
        const connection = getConnectionUser(notification);
        return [connection?.fullName, connection?.location]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearchTerm));
      }),
    [acceptedRequests, normalizedSearchTerm]
  );

  const unreadIncomingRequests = filteredIncomingRequests.filter((request) => !request.isRead);
  const earlierIncomingRequests = filteredIncomingRequests.filter((request) => request.isRead);
  const unreadAcceptedRequests = filteredAcceptedRequests.filter((notification) => !notification.isRead);
  const earlierAcceptedRequests = filteredAcceptedRequests.filter((notification) => notification.isRead);
  const unreadNotificationCount = unreadIncomingRequests.length + unreadAcceptedRequests.length;
  const earlierNotificationCount = earlierIncomingRequests.length + earlierAcceptedRequests.length;

  const renderIncomingRequests = (requests) => {
    if (requests.length === 0) return null;

    return (
      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request._id}
            className={`card bg-base-200 shadow-sm transition-shadow hover:shadow-md ${
              request.isRead ? "" : "border border-primary/20 bg-primary/5"
            }`}
          >
            <div className="card-body p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="avatar w-14 h-14 rounded-full bg-base-300">
                    <AvatarImage
                      src={request.sender.profilePic}
                      name={request.sender.fullName}
                      alt={request.sender.fullName}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{request.sender.fullName}</h3>
                    {request.sender.location ? (
                      <p className="mt-1 truncate text-sm opacity-70">{request.sender.location}</p>
                    ) : null}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm shrink-0"
                  onClick={() => acceptRequestMutation(request._id)}
                  disabled={isPending}
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderConnectionNotifications = (notifications) => {
    if (notifications.length === 0) return null;

    return (
      <div className="space-y-3">
        {notifications.map((notification) => {
          const notificationTimestamp = getNotificationTimestamp(notification);
          const readableDateLabel = getReadableDateLabel(notificationTimestamp);
          const connection = getConnectionUser(notification);
          const notificationText =
            notification.notificationText || `${connection?.fullName || "Someone"} accepted your friend request`;

          return (
            <div
              key={notification._id}
              className={`card bg-base-200 shadow-sm ${
                notification.isRead ? "" : "border border-success/20 bg-success/5"
              }`}
            >
              <div className="card-body p-4">
                <div className="flex items-start gap-3">
                  <div className="avatar mt-1 size-10 rounded-full">
                    <AvatarImage
                      src={connection?.profilePic}
                      name={connection?.fullName}
                      alt={connection?.fullName}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{connection?.fullName}</h3>
                    <p className="text-sm my-1">{notificationText}</p>
                    <p className="text-xs flex items-center opacity-70" title={readableDateLabel}>
                      <ClockIcon className="h-3 w-3 mr-1" />
                      {getRelativeTimeLabel(notificationTimestamp)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="badge badge-success hidden sm:inline-flex">
                      <MessageSquareIcon className="h-3 w-3 mr-1" />
                      New Friend
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:bg-error/10 hover:text-error"
                      onClick={() => hideConnectionNotification(notification._id)}
                      disabled={isHidingNotification}
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search notifications by name or location"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <>
            {unreadNotificationCount > 0 && (
              <section className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <BellIcon className="h-5 w-5 text-primary" />
                    Unread
                    <span className="badge badge-primary ml-1">{unreadNotificationCount}</span>
                  </h2>
                  {unreadAcceptedRequests.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm w-full justify-start text-error sm:w-auto"
                      onClick={() => clearConnectionNotifications()}
                      disabled={isClearingNotifications}
                    >
                      <Trash2Icon className="size-4" />
                      {isClearingNotifications ? "Clearing..." : "Clear connection notifications"}
                    </button>
                  ) : null}
                </div>

                {unreadIncomingRequests.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-70">
                      <UserCheckIcon className="h-4 w-4 text-primary" />
                      Friend Requests
                    </h3>
                    {renderIncomingRequests(unreadIncomingRequests)}
                  </div>
                ) : null}

                {unreadAcceptedRequests.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-70">
                      <MessageSquareIcon className="h-4 w-4 text-success" />
                      New Connections
                    </h3>
                    {renderConnectionNotifications(unreadAcceptedRequests)}
                  </div>
                ) : null}
              </section>
            )}

            {earlierNotificationCount > 0 && (
              <section className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <ClockIcon className="h-5 w-5 opacity-70" />
                    Earlier
                  </h2>
                  {earlierAcceptedRequests.length > 0 && unreadAcceptedRequests.length === 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm w-full justify-start text-error sm:w-auto"
                      onClick={() => clearConnectionNotifications()}
                      disabled={isClearingNotifications}
                    >
                      <Trash2Icon className="size-4" />
                      {isClearingNotifications ? "Clearing..." : "Clear connection notifications"}
                    </button>
                  ) : null}
                </div>

                {earlierIncomingRequests.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-70">
                      <UserCheckIcon className="h-4 w-4 text-primary" />
                      Friend Requests
                    </h3>
                    {renderIncomingRequests(earlierIncomingRequests)}
                  </div>
                ) : null}

                {earlierAcceptedRequests.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-70">
                      <MessageSquareIcon className="h-4 w-4 text-success" />
                      New Connections
                    </h3>
                    {renderConnectionNotifications(earlierAcceptedRequests)}
                  </div>
                ) : null}
              </section>
            )}

            {filteredIncomingRequests.length === 0 && filteredAcceptedRequests.length === 0 && (
              <NoNotificationsFound />
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default NotificationsPage;
