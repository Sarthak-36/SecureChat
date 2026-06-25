const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development" ? "http://localhost:5001" : window.location.origin);

export const getWebSocketUrl = (token) => {
  const url = new URL("/ws", API_ORIGIN);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
};
