export const serializeUser = (row) => ({
  _id: row.id,
  email: row.email,
  fullName: row.full_name,
  bio: row.bio,
  profilePic: row.profile_pic,
  location: row.location,
  isOnboarded: row.is_onboarded,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const serializeFriendRequestRow = (row, prefix) => ({
  _id: row.id,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  [prefix]: {
    _id: row[`${prefix}_id`],
    fullName: row[`${prefix}_full_name`],
    profilePic: row[`${prefix}_profile_pic`],
    location: row[`${prefix}_location`],
  },
});

export const serializeMessage = (row) => ({
  _id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  text: row.text,
  messageType: row.message_type,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  readAt: row.recipient_read_at || null,
});

export const serializeFriendSummary = (row) => ({
  _id: row.id,
  email: row.email,
  fullName: row.full_name,
  bio: row.bio,
  profilePic: row.profile_pic,
  location: row.location,
  isOnboarded: row.is_onboarded,
  conversationId: row.conversation_id,
  unreadCount: Number(row.unread_count || 0),
  lastMessageText: row.last_message_text || "",
  lastMessageAt: row.last_message_created_at,
});
