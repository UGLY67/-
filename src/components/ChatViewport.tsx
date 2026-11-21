import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Edit3,
  ExternalLink,
  Link2,
  MessageSquare,
  PanelRight,
  Paperclip,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Chat,
  Message,
  PublicUser,
  Reaction,
  TypingStatus,
} from '../types/messenger';
import { VALIDATION_LIMITS } from '../types/messenger';
import {
  formatDateDivider,
  formatLastSeen,
  formatMessageTime,
  getDateKey,
  isLikelyImageUrl,
  isUserOnline,
  isValidHttpUrl,
  pluralizeMembers,
  timestampToMillis,
} from '../utils/formatters';
import { Avatar } from './Avatar';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '👏', '😮'];
const COMPOSER_EMOJIS = [
  '😊', '😂', '🔥', '👍', '❤️', '👏', '🎉', '✨',
  '🤔', '😅', '🙏', '👀', '💡', '✅', '🚀', '📌',
  '☕', '🌿', '💬', '🎧', '📎', '⚡', '🫶', '👌',
];

interface ChatViewportProps {
  currentUser: PublicUser;
  chat: Chat | null;
  messages: Message[];
  reactions: Reaction[];
  typingUsers: TypingStatus[];
  usersById: Record<string, PublicUser>;
  loadingMessages: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
  onBackMobile: () => void;
  onSendMessage: (
    text: string,
    replyTo?: Message | null,
    attachmentUrl?: string
  ) => Promise<void>;
  onEditMessage: (messageId: string, newText: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleReaction: (
    messageId: string,
    emoji: string,
    currentUserEmoji?: string
  ) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
}

function renderMessageTextWithLinks(text: string, isOwn: boolean) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, idx) => {
    if (part.match(/^https?:\/\/[^\s<]+$/)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 break-all ${
            isOwn
              ? 'text-blue-100 hover:text-white'
              : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
          }`}
        >
          {part}
        </a>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

function AttachmentPreview({
  url,
  isOwn,
}: {
  url: string;
  isOwn: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  if (!url || !isValidHttpUrl(url)) return null;

  if (isLikelyImageUrl(url) && !imgErr) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
      >
        <img
          src={url}
          alt="Вложенное изображение"
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="max-h-64 w-full object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
        isOwn
          ? 'border-blue-400/40 bg-blue-700/40 text-white hover:bg-blue-700/60'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <Link2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate flex-1">{url}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  );
}

export function ChatViewport({
  currentUser,
  chat,
  messages,
  reactions,
  typingUsers,
  usersById,
  loadingMessages,
  showDetails,
  onToggleDetails,
  onBackMobile,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onTypingChange,
}: ChatViewportProps) {
  const [draft, setDraft] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Reset composer state when chat changes
  useEffect(() => {
    setReplyTo(null);
    setEditingMsg(null);
    setDraft('');
    setAttachmentUrl('');
    setShowAttachmentInput(false);
    setShowEmojiPicker(false);
    setSearchOpen(false);
    setSearchQuery('');
    setIsAtBottom(true);
  }, [chat?.id]);

  // Auto-scroll to bottom on new messages when user is near bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isAtBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, chat?.id, isAtBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [draft]);

  const reactionsByMessageId = useMemo(() => {
    const map: Record<string, Reaction[]> = {};
    for (const r of reactions) {
      if (!map[r.messageId]) map[r.messageId] = [];
      map[r.messageId].push(r);
    }
    return map;
  }, [reactions]);

  const activeTypers = useMemo(() => {
    const now = Date.now();
    return typingUsers.filter(
      (t) =>
        t.uid !== currentUser.uid &&
        t.isTyping &&
        now - timestampToMillis(t.updatedAt) < 8000
    );
  }, [typingUsers, currentUser.uid]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => m.text.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  const jumpToMessage = (messageId: string) => {
    const node = msgRefs.current[messageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMsgId(messageId);
    window.setTimeout(() => {
      setHighlightedMsgId((prev) => (prev === messageId ? null : prev));
    }, 1800);
  };

  useEffect(() => {
    if (searchMatches.length > 0) {
      const clamped = Math.min(activeMatchIdx, searchMatches.length - 1);
      jumpToMessage(searchMatches[clamped]);
    }
  }, [activeMatchIdx, searchMatches.length]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom < 80);
  };

  const scrollToBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setIsAtBottom(true);
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!chat || editingMsg) return;

    if (val.trim().length > 0) {
      onTypingChange(true);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        onTypingChange(false);
      }, 3000);
    } else {
      onTypingChange(false);
    }
  };

  const handleSubmit = async () => {
    if (!chat || sending) return;
    const trimmed = draft.trim();
    const cleanUrl = attachmentUrl.trim();

    if (editingMsg) {
      if (!trimmed) return;
      setSending(true);
      try {
        await onEditMessage(editingMsg.id, trimmed);
        setEditingMsg(null);
        setDraft('');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmed && !isValidHttpUrl(cleanUrl)) return;

    setSending(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    onTypingChange(false);

    try {
      await onSendMessage(trimmed, replyTo, cleanUrl);
      setDraft('');
      setReplyTo(null);
      setAttachmentUrl('');
      setShowAttachmentInput(false);
      setShowEmojiPicker(false);
      setIsAtBottom(true);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    } else if (e.key === 'Escape') {
      setReplyTo(null);
      setEditingMsg(null);
    }
  };

  const handleCopy = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  if (!chat) {
    return (
      <main className="hidden flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center md:flex dark:bg-slate-950">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-400">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Выберите чат для общения
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Откройте существующую беседу слева или начните новый личный диалог.
        </p>
      </main>
    );
  }

  // Compute chat header display details
  let chatTitle = chat.title;
  let chatPhoto = '';
  let chatKind: 'user' | 'saved' | 'group' | 'public' = 'group';
  let peerOnline = false;
  let subtitle = '';

  if (chat.type === 'saved') {
    chatTitle = 'Избранное';
    chatKind = 'saved';
    subtitle = 'Личное хранилище заметок';
  } else if (chat.type === 'public') {
    chatTitle = chat.title || 'Общий чат';
    chatKind = 'public';
    subtitle = 'Открытая комната для всех пользователей';
  } else if (chat.type === 'direct') {
    const peerId = chat.memberIds.find((id) => id !== currentUser.uid) || currentUser.uid;
    const peer = usersById[peerId];
    chatTitle = peer?.displayName || 'Личный диалог';
    chatPhoto = peer?.photoURL || '';
    chatKind = 'user';
    peerOnline = isUserOnline(peer);
    subtitle = peer ? formatLastSeen(peer) : 'Личный диалог';
  } else {
    chatKind = 'group';
    const onlineCount = chat.memberIds.filter((uid) => isUserOnline(usersById[uid])).length;
    subtitle =
      onlineCount > 0
        ? `${pluralizeMembers(chat.memberIds.length)} · ${onlineCount} в сети`
        : pluralizeMembers(chat.memberIds.length);
  }

  if (activeTypers.length > 0) {
    const names = activeTypers.map((t) => t.displayName.split(' ')[0]).join(', ');
    subtitle =
      activeTypers.length === 1 ? `${names} печатает...` : `${names} печатают...`;
  }

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      {/* Chat Header */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Назад к списку чатов"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onToggleDetails}
            className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded-lg"
          >
            <Avatar
              name={chatTitle}
              src={chatPhoto}
              size="sm"
              kind={chatKind}
              isOnline={peerOnline}
            />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {chatTitle}
              </h2>
              <p
                className={`truncate text-xs ${
                  activeTypers.length > 0 || peerOnline
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {subtitle}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((prev) => !prev);
              setSearchQuery('');
              setActiveMatchIdx(0);
            }}
            title="Поиск по сообщениям"
            aria-label="Поиск по сообщениям"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              searchOpen
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleDetails}
            title="Информация о чате"
            aria-label="Информация о чате"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              showDetails
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* In-chat Search Bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveMatchIdx(0);
            }}
            placeholder="Поиск в этом чате..."
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          {searchQuery && (
            <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400 shrink-0">
              {searchMatches.length > 0
                ? `${activeMatchIdx + 1} из ${searchMatches.length}`
                : '0 совпадений'}
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={() =>
                setActiveMatchIdx((prev) =>
                  prev > 0 ? prev - 1 : searchMatches.length - 1
                )
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
              aria-label="Предыдущее совпадение"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={() =>
                setActiveMatchIdx((prev) =>
                  prev < searchMatches.length - 1 ? prev + 1 : 0
                )
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
              aria-label="Следующее совпадение"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Закрыть поиск"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="messenger-scroll relative flex-1 overflow-y-auto px-4 py-5 lg:px-8"
      >
        {loadingMessages ? (
          <div className="mx-auto max-w-3xl space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
              >
                <div className="h-14 w-64 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
            <Avatar name={chatTitle} src={chatPhoto} size="lg" kind={chatKind} />
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
              {chatTitle}
            </h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {chat.type === 'saved'
                ? 'Сохраняйте здесь важные заметки, ссылки и фрагменты текста — доступ есть только у вас.'
                : 'Сообщений пока нет. Напишите первое сообщение, чтобы начать диалог.'}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1">
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isOwn = msg.senderId === currentUser.uid;
              const showDateDivider =
                !prevMsg || getDateKey(prevMsg.createdAt) !== getDateKey(msg.createdAt);

              const timeDiffMs =
                prevMsg && msg.createdAt && prevMsg.createdAt
                  ? timestampToMillis(msg.createdAt) -
                    timestampToMillis(prevMsg.createdAt)
                  : 999_999;

              const isGroupedWithPrev =
                !showDateDivider &&
                prevMsg?.senderId === msg.senderId &&
                timeDiffMs < 180_000;

              const msgReactions = reactionsByMessageId[msg.id] || [];
              const groupedReactions = msgReactions.reduce<
                Record<string, { count: number; byMe: boolean }>
              >((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, byMe: false };
                acc[r.emoji].count += 1;
                if (r.uid === currentUser.uid) acc[r.emoji].byMe = true;
                return acc;
              }, {});
              const myCurrentReaction = msgReactions.find(
                (r) => r.uid === currentUser.uid
              )?.emoji;

              const senderUser = usersById[msg.senderId];
              const displaySenderName = senderUser?.displayName || msg.senderName;
              const displaySenderPhoto = senderUser?.photoURL || msg.senderPhoto;
              const isHighlighted = highlightedMsgId === msg.id;

              return (
                <Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center py-4">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatDateDivider(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div
                    ref={(el) => {
                      msgRefs.current[msg.id] = el;
                    }}
                    className={`group flex items-end gap-2.5 transition-colors duration-300 ${
                      isOwn ? 'justify-end' : 'justify-start'
                    } ${isGroupedWithPrev ? 'mt-0.5' : 'mt-3'} ${
                      isHighlighted
                        ? 'rounded-xl bg-blue-100/70 p-1 dark:bg-blue-900/30'
                        : ''
                    }`}
                  >
                    {/* Left avatar for incoming group/public messages */}
                    {!isOwn && (chat.type === 'group' || chat.type === 'public') && (
                      <div className="w-7 shrink-0">
                        {!isGroupedWithPrev && (
                          <Avatar
                            name={displaySenderName}
                            src={displaySenderPhoto}
                            size="xs"
                          />
                        )}
                      </div>
                    )}

                    <div
                      className={`relative flex max-w-[82%] flex-col sm:max-w-[70%] ${
                        isOwn ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* Sender Name for group/public chats */}
                      {!isOwn &&
                        !isGroupedWithPrev &&
                        (chat.type === 'group' || chat.type === 'public') && (
                          <span className="mb-1 ml-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {displaySenderName}
                          </span>
                        )}

                      <div className="relative flex items-center gap-1.5">
                        {/* Hover Actions for own messages (appear on left) */}
                        {isOwn && (
                          <div className="hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 opacity-0 shadow-xs transition-opacity group-hover:flex group-hover:opacity-100 dark:border-slate-800 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => setReplyTo(msg)}
                              title="Ответить"
                              aria-label="Ответить"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMsg(msg);
                                setReplyTo(null);
                                setDraft(msg.text);
                                textareaRef.current?.focus();
                              }}
                              title="Редактировать"
                              aria-label="Редактировать"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopy(msg)}
                              title="Копировать"
                              aria-label="Копировать"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              {copiedId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteMessage(msg.id)}
                              title="Удалить"
                              aria-label="Удалить"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            isOwn
                              ? 'rounded-br-md bg-blue-600 text-white'
                              : 'rounded-bl-md border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {/* Reply quote */}
                          {msg.replyToId && (
                            <button
                              type="button"
                              onClick={() => jumpToMessage(msg.replyToId)}
                              className={`mb-2 block w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                                isOwn
                                  ? 'bg-blue-700/60 text-blue-100 hover:bg-blue-700/80'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                              }`}
                            >
                              <div className="font-semibold truncate">
                                {msg.replyToSenderName}
                              </div>
                              <div className="truncate opacity-85">{msg.replyToText}</div>
                            </button>
                          )}

                          {/* Text content */}
                          <p className="whitespace-pre-wrap break-words">
                            {renderMessageTextWithLinks(msg.text, isOwn)}
                          </p>

                          {/* Optional attachment preview */}
                          {msg.attachmentUrl && (
                            <AttachmentPreview url={msg.attachmentUrl} isOwn={isOwn} />
                          )}

                          {/* Timestamp & metadata */}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${
                              isOwn
                                ? 'text-blue-100/90'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {msg.edited && <span>изм.</span>}
                            <span className="font-mono-tabular">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {isOwn && (
                              <CheckCheck className="h-3.5 w-3.5 opacity-90" />
                            )}
                          </div>
                        </div>

                        {/* Hover Actions for incoming messages */}
                        {!isOwn && (
                          <div className="hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 opacity-0 shadow-xs transition-opacity group-hover:flex group-hover:opacity-100 dark:border-slate-800 dark:bg-slate-900">
                            {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  void onToggleReaction(msg.id, emoji, myCurrentReaction)
                                }
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setReplyTo(msg)}
                              title="Ответить"
                              aria-label="Ответить"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopy(msg)}
                              title="Копировать"
                              aria-label="Копировать"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              {copiedId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Reactions row */}
                      {Object.keys(groupedReactions).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(groupedReactions).map(([emoji, info]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() =>
                                void onToggleReaction(msg.id, emoji, myCurrentReaction)
                              }
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs transition-colors ${
                                info.byMe
                                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-mono-tabular text-[11px]">
                                {info.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        {/* Scroll-to-bottom button */}
        {!isAtBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Прокрутить вниз"
            className="sticky bottom-3 left-full ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Composer */}
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Reply / Edit Banner */}
          {(replyTo || editingMsg) && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {editingMsg
                    ? 'Редактирование сообщения'
                    : `Ответ пользователю ${replyTo?.senderName}`}
                </div>
                <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                  {editingMsg ? editingMsg.text : replyTo?.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setEditingMsg(null);
                  if (editingMsg) setDraft('');
                }}
                aria-label="Отменить"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Optional Attachment URL Bar */}
          {showAttachmentInput && !editingMsg && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="Вставьте ссылку на изображение или сайт (https://...)"
                maxLength={VALIDATION_LIMITS.ATTACHMENT_URL_MAX}
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => {
                  setAttachmentUrl('');
                  setShowAttachmentInput(false);
                }}
                aria-label="Убрать ссылку"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div className="mb-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
                {COMPOSER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setDraft((prev) => prev + emoji)}
                    className="flex h-8 w-full items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            {!editingMsg && (
              <button
                type="button"
                onClick={() => setShowAttachmentInput((prev) => !prev)}
                title="Прикрепить ссылку или изображение"
                aria-label="Прикрепить ссылку или изображение"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors shrink-0 ${
                  showAttachmentInput || attachmentUrl
                    ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Paperclip className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              title="Эмодзи"
              aria-label="Эмодзи"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors shrink-0 ${
                showEmojiPicker
                  ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Smile className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={VALIDATION_LIMITS.MESSAGE_TEXT_MAX}
              placeholder="Написать сообщение..."
              className="max-h-36 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-950"
            />

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                sending ||
                (!draft.trim() && (!attachmentUrl.trim() || !isValidHttpUrl(attachmentUrl)))
              }
              aria-label="Отправить"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
