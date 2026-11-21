import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  VALIDATION_LIMITS,
  type Chat,
  type Message,
  type PublicUser,
} from '../types/messenger';
import {
  generateDefaultUsername,
  isValidAvatarUrl,
  isValidHttpUrl,
} from '../utils/formatters';

export const AUTH_SYNTHETIC_DOMAIN = '@kontur.auth.local';

export function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}${AUTH_SYNTHETIC_DOMAIN}`;
}

export function isSyntheticAuthEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(AUTH_SYNTHETIC_DOMAIN));
}

function clamp(str: string, max: number): string {
  return str.trim().slice(0, max);
}

export async function syncUserOnSignIn(
  user: User,
  overrides?: { displayName?: string; username?: string }
): Promise<void> {
  const uid = user.uid;
  const publicRef = doc(db, 'users_public', uid);
  const privateRef = doc(db, 'users_private', uid);

  let existingPublic: PublicUser | null = null;
  try {
    const snap = await getDoc(publicRef);
    if (snap.exists()) {
      existingPublic = snap.data() as PublicUser;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users_public/${uid}`);
  }

  const syntheticUsername = isSyntheticAuthEmail(user.email)
    ? user.email!.slice(0, -AUTH_SYNTHETIC_DOMAIN.length).toLowerCase()
    : '';

  const safeUsername =
    overrides?.username && VALIDATION_LIMITS.USERNAME_REGEX.test(overrides.username)
      ? overrides.username
      : existingPublic?.username && VALIDATION_LIMITS.USERNAME_REGEX.test(existingPublic.username)
        ? existingPublic.username
        : syntheticUsername && VALIDATION_LIMITS.USERNAME_REGEX.test(syntheticUsername)
          ? syntheticUsername
          : generateDefaultUsername(user.displayName, user.email, uid);

  const safeDisplayName = clamp(
    overrides?.displayName ||
      existingPublic?.displayName ||
      user.displayName ||
      syntheticUsername ||
      user.email?.split('@')[0] ||
      'Пользователь',
    VALIDATION_LIMITS.DISPLAY_NAME_MAX
  );

  const rawPhoto = existingPublic ? existingPublic.photoURL : (user.photoURL || '');
  const safePhoto = isValidAvatarUrl(rawPhoto)
    ? rawPhoto.trim().slice(0, VALIDATION_LIMITS.PHOTO_URL_MAX)
    : '';
  const safeBio = clamp(existingPublic?.bio || '', VALIDATION_LIMITS.BIO_MAX);

  try {
    await setDoc(publicRef, {
      uid,
      displayName: safeDisplayName,
      username: safeUsername,
      bio: safeBio,
      photoURL: safePhoto,
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users_public/${uid}`);
  }

  let existingPrivateTheme: 'light' | 'dark' = 'light';
  let existingNotif = true;
  try {
    const privSnap = await getDoc(privateRef);
    if (privSnap.exists()) {
      const data = privSnap.data();
      if (data.theme === 'dark' || data.theme === 'light') {
        existingPrivateTheme = data.theme;
      }
      if (typeof data.notificationsEnabled === 'boolean') {
        existingNotif = data.notificationsEnabled;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users_private/${uid}`);
  }

  try {
    await setDoc(privateRef, {
      uid,
      email: clamp(user.email || `${uid}@kon.local`, 160),
      theme: existingPrivateTheme,
      notificationsEnabled: existingNotif,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users_private/${uid}`);
  }

  // Ensure personal Saved Messages chat exists
  const savedChatId = `saved_${uid}`;
  const savedRef = doc(db, 'chats', savedChatId);
  let savedExists = false;
  try {
    const savedSnap = await getDoc(savedRef);
    savedExists = savedSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `chats/${savedChatId}`);
  }

  if (!savedExists) {
    try {
      await setDoc(savedRef, {
        id: savedChatId,
        type: 'saved',
        title: 'Избранное',
        description: 'Личные заметки, ссылки и сохранённые сообщения',
        ownerId: uid,
        memberIds: [uid],
        directKey: '',
        lastMessageText: 'Заметки и сохранённые сообщения',
        lastMessageSenderId: '',
        lastMessageSenderName: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${savedChatId}`);
    }
  }

  // Ensure public community chat exists
  const publicChatId = 'public_general';
  const publicChatRef = doc(db, 'chats', publicChatId);
  let pubExists = false;
  try {
    const pubChatSnap = await getDoc(publicChatRef);
    pubExists = pubChatSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `chats/${publicChatId}`);
  }

  if (!pubExists) {
    try {
      await setDoc(publicChatRef, {
        id: publicChatId,
        type: 'public',
        title: 'Общий чат',
        description: 'Открытое пространство для общения всех участников',
        ownerId: uid,
        memberIds: [uid],
        directKey: '',
        lastMessageText: 'Добро пожаловать в Общий чат!',
        lastMessageSenderId: '',
        lastMessageSenderName: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${publicChatId}`);
    }
  }
}

export async function updatePresence(
  user: PublicUser,
  isOnline: boolean
): Promise<void> {
  const path = `users_public/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users_public', user.uid), {
      displayName: user.displayName,
      username: user.username,
      bio: user.bio,
      photoURL: user.photoURL,
      isOnline,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfile(
  user: PublicUser,
  updates: { displayName: string; username: string; bio: string; photoURL?: string }
): Promise<void> {
  const cleanName = clamp(updates.displayName, VALIDATION_LIMITS.DISPLAY_NAME_MAX);
  const cleanUsername = updates.username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, VALIDATION_LIMITS.USERNAME_MAX);
  const cleanBio = clamp(updates.bio, VALIDATION_LIMITS.BIO_MAX);
  const nextPhoto = updates.photoURL !== undefined ? updates.photoURL.trim() : user.photoURL;

  if (!cleanName) {
    throw new Error('Имя не может быть пустым.');
  }
  if (cleanUsername.length < VALIDATION_LIMITS.USERNAME_MIN) {
    throw new Error('Никнейм должен содержать минимум 2 символа (a-z, 0-9, _).');
  }
  if (!isValidAvatarUrl(nextPhoto)) {
    throw new Error('Некорректный формат или слишком большой размер аватарки.');
  }

  const path = `users_public/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users_public', user.uid), {
      displayName: cleanName,
      username: cleanUsername,
      bio: cleanBio,
      photoURL: nextPhoto.slice(0, VALIDATION_LIMITS.PHOTO_URL_MAX),
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePrivatePreferences(
  uid: string,
  email: string,
  theme: 'light' | 'dark',
  notificationsEnabled: boolean
): Promise<void> {
  const path = `users_private/${uid}`;
  try {
    await updateDoc(doc(db, 'users_private', uid), {
      email: clamp(email, 160),
      theme,
      notificationsEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function openOrCreateDirectChat(
  currentUid: string,
  peer: PublicUser
): Promise<string> {
  if (peer.uid === currentUid) {
    return `saved_${currentUid}`;
  }
  const sorted = [currentUid, peer.uid].sort();
  const chatId = `dm_${sorted[0]}_${sorted[1]}`;
  const chatRef = doc(db, 'chats', chatId);

  let exists = false;
  try {
    const snap = await getDoc(chatRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
  }

  if (!exists) {
    try {
      await setDoc(chatRef, {
        id: chatId,
        type: 'direct',
        title: '',
        description: '',
        ownerId: currentUid,
        memberIds: sorted,
        directKey: `${sorted[0]}_${sorted[1]}`,
        lastMessageText: 'Диалог создан',
        lastMessageSenderId: '',
        lastMessageSenderName: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}`);
    }
  }
  return chatId;
}

export async function createGroupChat(
  currentUid: string,
  title: string,
  description: string,
  memberUids: string[]
): Promise<string> {
  const cleanTitle = clamp(title, VALIDATION_LIMITS.CHAT_TITLE_MAX);
  const cleanDesc = clamp(description, VALIDATION_LIMITS.CHAT_DESC_MAX);
  if (!cleanTitle) {
    throw new Error('Укажите название группы.');
  }
  const uniqueMembers = Array.from(new Set([currentUid, ...memberUids])).slice(
    0,
    VALIDATION_LIMITS.CHAT_MAX_MEMBERS
  );

  const chatRef = doc(collection(db, 'chats'));
  const chatId = chatRef.id;

  try {
    await setDoc(chatRef, {
      id: chatId,
      type: 'group',
      title: cleanTitle,
      description: cleanDesc,
      ownerId: currentUid,
      memberIds: uniqueMembers,
      directKey: '',
      lastMessageText: 'Группа создана',
      lastMessageSenderId: '',
      lastMessageSenderName: '',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}`);
  }
  return chatId;
}

export async function updateGroupInfo(
  chatId: string,
  title: string,
  description: string
): Promise<void> {
  const cleanTitle = clamp(title, VALIDATION_LIMITS.CHAT_TITLE_MAX);
  const cleanDesc = clamp(description, VALIDATION_LIMITS.CHAT_DESC_MAX);
  if (!cleanTitle) {
    throw new Error('Название группы не может быть пустым.');
  }
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      title: cleanTitle,
      description: cleanDesc,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function updateGroupMembers(
  chatId: string,
  memberIds: string[]
): Promise<void> {
  const bounded = Array.from(new Set(memberIds)).slice(0, VALIDATION_LIMITS.CHAT_MAX_MEMBERS);
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      memberIds: bounded,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function deleteGroupChat(chatId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'chats', chatId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}`);
  }
}

export async function sendMessage(
  chat: Chat,
  sender: PublicUser,
  rawText: string,
  replyTo?: Message | null,
  rawAttachmentUrl?: string
): Promise<void> {
  const cleanText = rawText.trim().slice(0, VALIDATION_LIMITS.MESSAGE_TEXT_MAX);
  const cleanUrl = rawAttachmentUrl?.trim() || '';
  const validAttachment =
    cleanUrl && isValidHttpUrl(cleanUrl)
      ? cleanUrl.slice(0, VALIDATION_LIMITS.ATTACHMENT_URL_MAX)
      : '';

  if (!cleanText && !validAttachment) return;

  const finalText = cleanText || validAttachment;
  const messagesCol = collection(db, 'chats', chat.id, 'messages');
  const newMsgRef = doc(messagesCol);
  const batch = writeBatch(db);

  batch.set(newMsgRef, {
    id: newMsgRef.id,
    chatId: chat.id,
    senderId: sender.uid,
    senderName: clamp(sender.displayName, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
    senderPhoto: sender.photoURL.startsWith('data:')
      ? ''
      : clamp(sender.photoURL, VALIDATION_LIMITS.MESSAGE_PHOTO_MAX),
    text: finalText,
    replyToId: replyTo ? replyTo.id : '',
    replyToSenderName: replyTo
      ? clamp(replyTo.senderName, VALIDATION_LIMITS.DISPLAY_NAME_MAX)
      : '',
    replyToText: replyTo
      ? clamp(replyTo.text, VALIDATION_LIMITS.REPLY_TEXT_MAX)
      : '',
    attachmentUrl: validAttachment,
    edited: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const previewText = clamp(
    finalText.replace(/\s+/g, ' '),
    VALIDATION_LIMITS.LAST_MESSAGE_TEXT_MAX
  );

  batch.update(doc(db, 'chats', chat.id), {
    lastMessageText: previewText,
    lastMessageSenderId: sender.uid,
    lastMessageSenderName: clamp(sender.displayName, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `chats/${chat.id}/messages/${newMsgRef.id}`
    );
  }
}

export async function editMessage(
  chatId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const cleanText = newText.trim().slice(0, VALIDATION_LIMITS.MESSAGE_TEXT_MAX);
  if (!cleanText) return;
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      text: cleanText,
      edited: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMessage(
  chatId: string,
  messageId: string
): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleReaction(
  chatId: string,
  messageId: string,
  uid: string,
  emoji: string,
  currentUserEmoji?: string
): Promise<void> {
  const reactionId = `${messageId}_${uid}`;
  const path = `chats/${chatId}/reactions/${reactionId}`;
  const ref = doc(db, 'chats', chatId, 'reactions', reactionId);

  try {
    if (currentUserEmoji === emoji) {
      await deleteDoc(ref);
    } else if (currentUserEmoji) {
      await updateDoc(ref, {
        emoji: emoji.slice(0, VALIDATION_LIMITS.EMOJI_MAX),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: reactionId,
        chatId,
        messageId,
        uid,
        emoji: emoji.slice(0, VALIDATION_LIMITS.EMOJI_MAX),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function setTypingStatus(
  chatId: string,
  user: PublicUser,
  isTyping: boolean
): Promise<void> {
  const path = `chats/${chatId}/typing/${user.uid}`;
  const ref = doc(db, 'chats', chatId, 'typing', user.uid);
  try {
    if (!isTyping) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clamp(user.displayName, VALIDATION_LIMITS.DISPLAY_NAME_MAX),
        isTyping: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Typing indicator errors should not crash the composer flow
  }
}

export async function updateMembershipPrefs(
  chatId: string,
  uid: string,
  current: { pinned?: boolean; muted?: boolean } | undefined,
  patch: { pinned?: boolean; muted?: boolean; markRead?: boolean }
): Promise<void> {
  const membershipId = `${chatId}_${uid}`;
  const path = `chat_memberships/${membershipId}`;
  const ref = doc(db, 'chat_memberships', membershipId);
  try {
    await setDoc(
      ref,
      {
        id: membershipId,
        chatId,
        uid,
        pinned: patch.pinned ?? current?.pinned ?? false,
        muted: patch.muted ?? current?.muted ?? false,
        lastReadAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
