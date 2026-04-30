import defaultAvatar from "../assets/default-avatar.svg";

export const buildFallbackAvatar = () => defaultAvatar;

export const getAvatarUrl = (profilePic, fullName) => {
  const normalizedProfilePic = typeof profilePic === "string" ? profilePic.trim() : "";

  if (
    !normalizedProfilePic ||
    normalizedProfilePic === "null" ||
    normalizedProfilePic === "undefined"
  ) {
    return buildFallbackAvatar(fullName);
  }

  return normalizedProfilePic;
};
