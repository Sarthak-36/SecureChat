import { axiosInstance } from "./axios";

export const signup = async (signupData) => {
  const response = await axiosInstance.post("/auth/signup", signupData);
  return response.data;
};

export const login = async (loginData) => {
  const response = await axiosInstance.post("/auth/login", loginData);
  return response.data;
};
export const logout = async () => {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
};

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch (error) {
    console.log("Error in getAuthUser:", error);
    return null;
  }
};

export const completeOnboarding = async (userData) => {
  const response = await axiosInstance.post("/auth/onboarding", userData);
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await axiosInstance.put("/auth/profile", profileData);
  return response.data;
};

export const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosInstance.post("/auth/profile-picture", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const deleteAccount = async () => {
  const response = await axiosInstance.delete("/auth/account");
  return response.data;
};

export async function getUserFriends() {
  const response = await axiosInstance.get("/users/friends");
  return response.data;
}

export async function removeFriend(friendId) {
  const response = await axiosInstance.delete(`/users/friends/${friendId}`);
  return response.data;
}

export async function getRecommendedUsers() {
  const response = await axiosInstance.get("/users");
  return response.data;
}

export async function getOutgoingFriendReqs() {
  const response = await axiosInstance.get("/users/outgoing-friend-requests");
  return response.data;
}

export async function sendFriendRequest(userId) {
  const response = await axiosInstance.post(`/users/friend-request/${userId}`);
  return response.data;
}

export async function getFriendRequests() {
  const response = await axiosInstance.get("/users/friend-requests");
  return response.data;
}

export async function acceptFriendRequest(requestId) {
  const response = await axiosInstance.put(`/users/friend-request/${requestId}/accept`);
  return response.data;
}

export async function getChatToken() {
  const response = await axiosInstance.get("/chat/token");
  return response.data;
}

export async function getMessages(userId) {
  const response = await axiosInstance.get(`/chat/messages/${userId}`);
  return response.data;
}

export async function deleteMessage(messageId) {
  const response = await axiosInstance.delete(`/chat/messages/${messageId}`);
  return response.data;
}

export async function hideMessageForMe(messageId) {
  const response = await axiosInstance.post(`/chat/messages/${messageId}/hide`);
  return response.data;
}

export async function clearConversation(targetUserId) {
  const response = await axiosInstance.post(`/chat/conversations/${targetUserId}/clear`);
  return response.data;
}

export async function uploadChatAttachment(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosInstance.post("/chat/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export async function detectImageMessage(messageId, options = {}) {
  const response = await axiosInstance.post(`/ai/messages/${messageId}/detect-image`, {
    force: Boolean(options.force),
  });
  return response.data;
}

export async function detectTextMessage(messageId, options = {}) {
  const response = await axiosInstance.post(`/ai/messages/${messageId}/detect-text`, {
    force: Boolean(options.force),
  });
  return response.data;
}

export async function detectLinkMessage(messageId, options = {}) {
  const response = await axiosInstance.post(`/ai/messages/${messageId}/detect-link`, {
    force: Boolean(options.force),
  });
  return response.data;
}
