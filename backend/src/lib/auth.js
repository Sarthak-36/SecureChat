import jwt from "jsonwebtoken";

const authSecret = process.env.JWT_SECRET_KEY;
const wsSecret = process.env.WS_JWT_SECRET_KEY || authSecret;

if (!authSecret) {
  console.error("JWT_SECRET_KEY is missing");
}

const parseBooleanEnv = (value, fallback) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const normalizeSameSite = (value) => {
  const normalizedValue = value?.toLowerCase();
  return ["strict", "lax", "none"].includes(normalizedValue) ? normalizedValue : "lax";
};

const cookieSecure = parseBooleanEnv(process.env.COOKIE_SECURE, false);
const cookieSameSite = normalizeSameSite(process.env.COOKIE_SAME_SITE);

export const cookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: cookieSameSite,
  secure: cookieSecure,
};

export const signAuthToken = (userId) =>
  jwt.sign({ userId }, authSecret, {
    expiresIn: "7d",
  });

export const verifyAuthToken = (token) => jwt.verify(token, authSecret);

export const signWebSocketToken = (userId) =>
  jwt.sign({ userId, type: "ws" }, wsSecret, {
    expiresIn: "12h",
  });

export const verifyWebSocketToken = (token) => {
  const decoded = jwt.verify(token, wsSecret);

  if (decoded.type !== "ws") {
    throw new Error("Invalid websocket token");
  }

  return decoded;
};

export const parseCookies = (cookieHeader = "") =>
  !cookieHeader
    ? {}
    : Object.fromEntries(
        cookieHeader
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const separatorIndex = part.indexOf("=");
            const key = part.slice(0, separatorIndex);
            const value = part.slice(separatorIndex + 1);
            return [key, decodeURIComponent(value)];
          })
      );
