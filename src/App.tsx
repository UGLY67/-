import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  createGroupChat,
  deleteGroupChat,
  deleteMessage,
  editMessage,
  openOrCreateDirectChat,
  sendMessage,
  setTypingStatus,
  syncUserOnSignIn,
  toggleReaction,
  updateGroupInfo,
  updateGroupMembers,
  updateMembershipPrefs,
  updatePresence,
  updatePrivatePreferences,
  updateUserProfile,
  usernameToAuthEmail,
} from './services/messengerService';
import type {
  Chat,
  ChatMembership,
  Message,
  PrivateUser,
  PublicUser,
  Reaction,
  TypingStatus,
} from './types/messenger';
import { AuthScreen } from './components/AuthScreen';
import { ChatDetailsDrawer } from './components/ChatDetailsDrawer';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatViewport } from './components/ChatViewport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NewChatModal, ProfileModal } from './components/Modals';

function MessengerApp() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('kontur_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [privateUser, setPrivateUser] = useState<PrivateUser | null>(null);
  const [memberChats, setMemberChats] = useState<Chat[]>([]);
  const [publicChats, setPublicChats] = useState<Chat[]>([]);
  const [memberships, setMemberships] = useState<ChatMembership[]>([]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingStatus[]>([]);

  const [newChatModal, setNewChatModal] = useState<'direct' | 'group' | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const typingActiveRef = useRef(false);
  const pendingRegRef = useRef<{ displayName: string; username: string } | null>(null);

  // Sync theme to <html> class & localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kontur_theme', theme);
  }, [theme]);

  // Helper to surface Firestore snapshot errors cleanly to ErrorBoundary
  const reportSnapshotError = useCallback(
    (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
    []
  );

  // Auth listener & initial profile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setPrivateUser(null);
        setMemberChats([]);
        setPublicChats([]);
        setMemberships([]);
        setMessages([]);
        setActiveChatId(null);
        setAuthReady(true);
        return;
      }

      const isPasswordProvider = user.providerData.some(
        (p) => p.providerId === 'password'
      );
      if (!user.emailVerified && !isPasswordProvider) {
        setAuthError('Для входа необходим подтверждённый Google-аккаунт.');
        setFirebaseUser(null);
        setAuthReady(true);
        return;
      }

      try {
        const regOverrides = pendingRegRef.current ?? undefined;
        pendingRegRef.current = null;
        await syncUserOnSignIn(user, regOverrides);
        setFirebaseUser(user);
        setAuthError(null);
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Не удалось синхронизировать профиль.'
        );
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  const uid = firebaseUser?.uid ?? null;

  // Subscribe to public users, private user prefs, chats, and memberships
  useEffect(() => {
    if (!uid) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users_public'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as PublicUser);
        setUsers(list);
      },
      (err) => reportSnapshotError(err, OperationType.LIST, 'users_public')
    );

    const unsubPrivate = onSnapshot(
      doc(db, 'users_private', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PrivateUser;
          setPrivateUser(data);
          if (data.theme === 'dark' || data.theme === 'light') {
            setTheme(data.theme);
          }
        }
      },
      (err) => reportSnapshotError(err, OperationType.GET, `users_private/${uid}`)
    );

    const memberChatsQuery = query(
      collection(db, 'chats'),
      where('memberIds', 'array-contains', uid)
    );
    const unsubMemberChats = onSnapshot(
      memberChatsQuery,
      (snap) => {
        setMemberChats(snap.docs.map((d) => d.data() as Chat));
      },
      (err) => reportSnapshotError(err, OperationType.LIST, 'chats')
    );

    const publicChatsQuery = query(
      collection(db, 'chats'),
      where('type', '==', 'public')
    );
    const unsubPublicChats = onSnapshot(
      publicChatsQuery,
      (snap) => {
        setPublicChats(snap.docs.map((d) => d.data() as Chat));
      },
      (err) => reportSnapshotError(err, OperationType.LIST, 'chats')
    );

    const membershipsQuery = query(
      collection(db, 'chat_memberships'),
      where('uid', '==', uid)
    );
    const unsubMemberships = onSnapshot(
      membershipsQuery,
      (snap) => {
        setMemberships(snap.docs.map((d) => d.data() as ChatMembership));
      },
      (err) => reportSnapshotError(err, OperationType.LIST, 'chat_memberships')
    );

    return () => {
      unsubUsers();
      unsubPrivate();
      unsubMemberChats();
      unsubPublicChats();
      unsubMemberships();
    };
  }, [uid, reportSnapshotError]);

  const usersById = useMemo(() => {
    const map: Record<string, PublicUser> = {};
    for (const u of users) map[u.uid] = u;
    return map;
  }, [users]);

  const currentUser: PublicUser | null = useMemo(() => {
    if (!uid) return null;
    if (usersById[uid]) return usersById[uid];
    return {
      uid,
      displayName: firebaseUser?.displayName || 'Пользователь',
      username: 'user',
      bio: '',
      photoURL: firebaseUser?.photoURL || '',
      isOnline: true,
      lastSeenAt: null,
      updatedAt: null,
    };
  }, [uid, usersById, firebaseUser]);

  const chats = useMemo(() => {
    const map = new Map<string, Chat>();
    for (const c of publicChats) map.set(c.id, c);
    for (const c of memberChats) map.set(c.id, c);
    return Array.from(map.values());
  }, [publicChats, memberChats]);

  const membershipsByChatId = useMemo(() => {
    const map: Record<string, ChatMembership> = {};
    for (const m of memberships) map[m.chatId] = m;
    return map;
  }, [memberships]);

  // Select default chat automatically on first load (desktop)
  useEffect(() => {
    if (!uid || chats.length === 0) return;
    if (!activeChatId || !chats.some((c) => c.id === activeChatId)) {
      const publicChat = chats.find((c) => c.id === 'public_general');
      setActiveChatId(publicChat ? publicChat.id : chats[0].id);
    }
  }, [uid, chats, activeChatId]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  // Presence heartbeat
  const currentUserRef = useRef<PublicUser | null>(null);
  currentUserRef.current = currentUser;

  useEffect(() => {
    if (!uid) return;
    const heartbeat = window.setInterval(() => {
      if (currentUserRef.current && document.visibilityState === 'visible') {
        void updatePresence(currentUserRef.current, true).catch(() => {});
      }
    }, 60_000);

    const handleVisibility = () => {
      if (!currentUserRef.current) return;
      void updatePresence(
        currentUserRef.current,
        document.visibilityState === 'visible'
      ).catch(() => {});
    };

    const handleBeforeUnload = () => {
      if (currentUserRef.current) {
        void updatePresence(currentUserRef.current, false).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [uid]);

  // Subscribe to active chat messages, reactions, and typing indicators
  useEffect(() => {
    if (!uid || !activeChatId) {
      setMessages([]);
      setReactions([]);
      setTypingUsers([]);
      return;
    }

    setLoadingMessages(true);
    const messagesQuery = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(200)
    );

    const unsubMessages = onSnapshot(
      messagesQuery,
      (snap) => {
        setMessages(snap.docs.map((d) => d.data() as Message));
        setLoadingMessages(false);
      },
      (err) => {
        setLoadingMessages(false);
        reportSnapshotError(err, OperationType.LIST, `chats/${activeChatId}/messages`);
      }
    );

    const unsubReactions = onSnapshot(
      collection(db, 'chats', activeChatId, 'reactions'),
      (snap) => {
        setReactions(snap.docs.map((d) => d.data() as Reaction));
      },
      (err) =>
        reportSnapshotError(err, OperationType.LIST, `chats/${activeChatId}/reactions`)
    );

    const unsubTyping = onSnapshot(
      collection(db, 'chats', activeChatId, 'typing'),
      (snap) => {
        setTypingUsers(snap.docs.map((d) => d.data() as TypingStatus));
      },
      (err) =>
        reportSnapshotError(err, OperationType.LIST, `chats/${activeChatId}/typing`)
    );

    return () => {
      unsubMessages();
      unsubReactions();
      unsubTyping();
      if (typingActiveRef.current && currentUserRef.current) {
        typingActiveRef.current = false;
        void setTypingStatus(activeChatId, currentUserRef.current, false);
      }
    };
  }, [uid, activeChatId, reportSnapshotError]);

  // Mark active chat as read whenever messages arrive while viewing
  useEffect(() => {
    if (!uid || !activeChatId || messages.length === 0) return;
    const currentMem = membershipsByChatId[activeChatId];
    void updateMembershipPrefs(activeChatId, uid, currentMem, { markRead: true }).catch(
      () => {}
    );
  }, [uid, activeChatId, messages.length]);

  const mapCredentialsAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/operation-not-allowed') {
      return 'Вход по логину и паролю ещё не включён в Firebase Console (Authentication → Sign-in method → Email/Password). Включите его или войдите через Google.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'Неверный никнейм или пароль.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Пользователь с таким никнеймом уже зарегистрирован.';
    }
    if (code === 'auth/weak-password') {
      return 'Пароль слишком простой. Используйте минимум 6 символов.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Слишком много попыток входа. Подождите немного и попробуйте снова.';
    }
    return 'Не удалось выполнить вход. Проверьте данные и соединение.';
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка авторизации';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Не удалось войти через Google. Попробуйте ещё раз.');
      }
    }
  };

  const handleCredentialsSignIn = async (username: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
    } catch (err) {
      setAuthError(mapCredentialsAuthError(err));
    }
  };

  const handleCredentialsRegister = async ({
    username,
    password,
    displayName,
  }: {
    username: string;
    password: string;
    displayName: string;
  }) => {
    setAuthError(null);
    pendingRegRef.current = { displayName, username };
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        usernameToAuthEmail(username),
        password
      );
      await updateProfile(cred.user, { displayName });
    } catch (err) {
      pendingRegRef.current = null;
      setAuthError(mapCredentialsAuthError(err));
    }
  };

  const handleSignOut = async () => {
    if (currentUser) {
      await updatePresence(currentUser, false).catch(() => {});
    }
    setProfileOpen(false);
    await signOut(auth);
  };

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (uid && privateUser) {
      void updatePrivatePreferences(
        uid,
        privateUser.email,
        next,
        privateUser.notificationsEnabled
      ).catch(() => {});
    }
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileShowChat(true);
    if (uid) {
      void updateMembershipPrefs(chatId, uid, membershipsByChatId[chatId], {
        markRead: true,
      }).catch(() => {});
    }
  };

  const handleStartDirectChat = async (peer: PublicUser) => {
    if (!uid) return;
    const chatId = await openOrCreateDirectChat(uid, peer);
    setActiveChatId(chatId);
    setMobileShowChat(true);
  };

  const handleCreateGroup = async (
    title: string,
    description: string,
    memberUids: string[]
  ) => {
    if (!uid) return;
    const chatId = await createGroupChat(uid, title, description, memberUids);
    setActiveChatId(chatId);
    setMobileShowChat(true);
  };

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      if (!activeChatId || !currentUserRef.current) return;
      if (typingActiveRef.current === isTyping) return;
      typingActiveRef.current = isTyping;
      void setTypingStatus(activeChatId, currentUserRef.current, isTyping);
    },
    [activeChatId]
  );

  if (fatalError) {
    throw fatalError;
  }

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Загрузка мессенджера...
          </span>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !currentUser) {
    return (
      <AuthScreen
        onGoogleSignIn={handleGoogleSignIn}
        onCredentialsSignIn={handleCredentialsSignIn}
        onCredentialsRegister={handleCredentialsRegister}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        authError={authError}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar: visible on desktop always, on mobile only when mobileShowChat is false */}
      <div
        className={`${
          mobileShowChat ? 'hidden md:flex' : 'flex w-full md:w-auto'
        } h-full shrink-0`}
      >
        <ChatSidebar
          currentUser={currentUser}
          chats={chats}
          usersById={usersById}
          membershipsByChatId={membershipsByChatId}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onStartDirectChat={handleStartDirectChat}
          onOpenNewChat={() => setNewChatModal('direct')}
          onOpenNewGroup={() => setNewChatModal('group')}
          onOpenProfile={() => setProfileOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      </div>

      {/* Active Chat Viewport */}
      <div
        className={`${
          mobileShowChat ? 'flex' : 'hidden md:flex'
        } h-full min-w-0 flex-1`}
      >
        <ChatViewport
          currentUser={currentUser}
          chat={activeChat}
          messages={messages}
          reactions={reactions}
          typingUsers={typingUsers}
          usersById={usersById}
          loadingMessages={loadingMessages}
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails((prev) => !prev)}
          onBackMobile={() => setMobileShowChat(false)}
          onSendMessage={async (text, replyTo, attachmentUrl) => {
            if (!activeChat) return;
            await sendMessage(activeChat, currentUser, text, replyTo, attachmentUrl);
          }}
          onEditMessage={async (messageId, newText) => {
            if (!activeChat) return;
            await editMessage(activeChat.id, messageId, newText);
          }}
          onDeleteMessage={async (messageId) => {
            if (!activeChat) return;
            await deleteMessage(activeChat.id, messageId);
          }}
          onToggleReaction={async (messageId, emoji, currentUserEmoji) => {
            if (!activeChat) return;
            await toggleReaction(
              activeChat.id,
              messageId,
              currentUser.uid,
              emoji,
              currentUserEmoji
            );
          }}
          onTypingChange={handleTypingChange}
        />
      </div>

      {/* Collapsible Details Drawer */}
      {showDetails && activeChat && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 md:static md:inset-auto md:z-auto md:bg-transparent">
          <ChatDetailsDrawer
            chat={activeChat}
            currentUser={currentUser}
            usersById={usersById}
            membership={membershipsByChatId[activeChat.id]}
            messages={messages}
            onClose={() => setShowDetails(false)}
            onTogglePin={async () => {
              const cur = membershipsByChatId[activeChat.id];
              await updateMembershipPrefs(activeChat.id, currentUser.uid, cur, {
                pinned: !(cur?.pinned ?? false),
              });
            }}
            onToggleMute={async () => {
              const cur = membershipsByChatId[activeChat.id];
              await updateMembershipPrefs(activeChat.id, currentUser.uid, cur, {
                muted: !(cur?.muted ?? false),
              });
            }}
            onUpdateGroupInfo={async (title, description) => {
              await updateGroupInfo(activeChat.id, title, description);
            }}
            onUpdateGroupMembers={async (memberIds) => {
              await updateGroupMembers(activeChat.id, memberIds);
            }}
            onLeaveGroup={async () => {
              await updateGroupMembers(
                activeChat.id,
                activeChat.memberIds.filter((id) => id !== currentUser.uid)
              );
              setShowDetails(false);
              setActiveChatId(null);
              setMobileShowChat(false);
            }}
            onDeleteGroup={async () => {
              await deleteGroupChat(activeChat.id);
              setShowDetails(false);
              setActiveChatId(null);
              setMobileShowChat(false);
            }}
            onStartDirectChat={handleStartDirectChat}
          />
        </div>
      )}

      {/* Modals */}
      {newChatModal && (
        <NewChatModal
          initialMode={newChatModal}
          currentUser={currentUser}
          users={users}
          onClose={() => setNewChatModal(null)}
          onStartDirectChat={handleStartDirectChat}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {profileOpen && (
        <ProfileModal
          currentUser={currentUser}
          privateUser={privateUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSaveProfile={async (updates) => {
            await updateUserProfile(currentUser, updates);
          }}
          onSignOut={handleSignOut}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MessengerApp />
    </ErrorBoundary>
  );
}
