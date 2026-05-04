import axios from "axios";

const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development" ? "http://localhost:5001" : window.location.origin);
const BASE_URL = new URL("/api", API_ORIGIN).toString().replace(/\/$/, "");

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
