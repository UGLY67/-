import type { Timestamp } from 'firebase/firestore';

export const VALIDATION_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  USERNAME_MIN: 2,
  USERNAME_MAX: 40,
  USERNAME_REGEX: /^[a-z0-9_]+$/,
  BIO_MAX: 200,
  PHOTO_URL_MAX: 35000,
  MESSAGE_PHOTO_MAX: 500,
  PASSWORD_MIN: 6,
  PASSWORD_MAX: 128,
  CHAT_TITLE_MAX: 100,
  CHAT_DESC_MAX: 300,
  CHAT_MAX_MEMBERS: 50,
  MESSAGE_TEXT_MAX: 4000,
  LAST_MESSAGE_TEXT_MAX: 300,
  REPLY_TEXT_MAX: 200,
  ATTACHMENT_URL_MAX: 500,
  EMOJI_MAX: 16,
} as const;

export type ChatType = 'saved' | 'direct' | 'group' | 'public';

export interface PublicUser {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  isOnline: boolean;
  lastSeenAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PrivateUser {
  uid: string;
  email: string;
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
  updatedAt: Timestamp | null;
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  directKey: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ChatMembership {
  id: string;
  chatId: string;
  uid: string;
  pinned: boolean;
  muted: boolean;
  lastReadAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  replyToId: string;
  replyToSenderName: string;
  replyToText: string;
  attachmentUrl: string;
  edited: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Reaction {
  id: string;
  chatId: string;
  messageId: string;
  uid: string;
  emoji: string;
  updatedAt: Timestamp | null;
}

export interface TypingStatus {
  uid: string;
  displayName: string;
  isTyping: boolean;
  updatedAt: Timestamp | null;
}

export type ChatFilter = 'all' | 'direct' | 'group' | 'pinned';
