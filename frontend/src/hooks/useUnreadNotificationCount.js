import { useQuery } from "@tanstack/react-query";

import { getUnreadNotificationCount } from "../lib/api";

const useUnreadNotificationCount = () => {
  const { data } = useQuery({
    queryKey: ["notificationUnreadCount"],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 15000,
  });

  return Number(data?.unreadCount || 0);
};

export default useUnreadNotificationCount;
