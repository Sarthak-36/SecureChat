// const API_BASE_URL =
//   import.meta.env.MODE === "development" ? "http://localhost:5001" : window.location.origin;

// export const getWebSocketUrl = (token) => {
//   const url = new URL("/ws", API_BASE_URL);
//   url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

//   if (token) {
//     url.searchParams.set("token", token);
//   }

//   return url.toString();
// };

const API_BASE_URL = import.meta.env.VITE_API_URL;

export const getWebSocketUrl = (token) => {
  const url = new URL("/ws", API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
};