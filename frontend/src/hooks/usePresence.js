import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import useAuthUser from "./useAuthUser";
import { getChatToken } from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const usePresence = (userIds = []) => {
  const { authUser } = useAuthUser();
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  const normalizedUserIds = useMemo(
    () => [...new Set(userIds.filter((userId) => typeof userId === "string" && userId))],
    [userIds]
  );
  const normalizedUserIdsKey = useMemo(() => normalizedUserIds.join("|"), [normalizedUserIds]);

  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    if (!authUser || !tokenData?.token) return;

    if (normalizedUserIds.length === 0) {
      setOnlineUserIds(new Set());
      return;
    }

    const socket = new WebSocket(getWebSocketUrl(tokenData.token));

    const subscribeToPresence = () => {
      socket.send(
        JSON.stringify({
          type: "subscribe_presence",
          userIds: normalizedUserIds,
        })
      );
    };

    socket.addEventListener("open", subscribeToPresence);

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "presence_snapshot") {
        setOnlineUserIds(new Set(payload.onlineUserIds || []));
      }

      if (payload.type === "presence_updated" && typeof payload.userId === "string") {
        setOnlineUserIds((currentUserIds) => {
          const nextUserIds = new Set(currentUserIds);

          if (payload.isOnline) {
            nextUserIds.add(payload.userId);
          } else {
            nextUserIds.delete(payload.userId);
          }

          return nextUserIds;
        });
      }
    });

    return () => {
      socket.close();
    };
  }, [authUser?._id, normalizedUserIdsKey, tokenData?.token]);

  return onlineUserIds;
};

export default usePresence;
