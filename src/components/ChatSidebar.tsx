import { useMemo, useState } from 'react';
import {
  BellOff,
  Moon,
  Pin,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type {
  Chat,
  ChatFilter,
  ChatMembership,
  PublicUser,
} from '../types/messenger';
import {
  formatChatListTime,
  isUserOnline,
  timestampToMillis,
} from '../utils/formatters';
import { Avatar } from './Avatar';

interface ChatSidebarProps {
  currentUser: PublicUser;
  chats: Chat[];
  usersById: Record<string, PublicUser>;
  membershipsByChatId: Record<string, ChatMembership>;
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartDirectChat: (peer: PublicUser) => Promise<void>;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenProfile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function ChatSidebar({
  currentUser,
  chats,
  usersById,
  membershipsByChatId,
  activeChatId,
  onSelectChat,
  onStartDirectChat,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenProfile,
  theme,
  onToggleTheme,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  const getChatDisplayInfo = (chat: Chat) => {
    if (chat.type === 'saved') {
      return {
        title: 'Избранное',
        photo: '',
        kind: 'saved' as const,
        isOnline: false,
        peer: null as PublicUser | null,
      };
    }
    if (chat.type === 'public') {
      return {
        title: chat.title || 'Общий чат',
        photo: '',
        kind: 'public' as const,
        isOnline: false,
        peer: null as PublicUser | null,
      };
    }
    if (chat.type === 'direct') {
      const peerId = chat.memberIds.find((id) => id !== currentUser.uid) || currentUser.uid;
      const peer = usersById[peerId] || null;
      return {
        title: peer?.displayName || 'Личный диалог',
        photo: peer?.photoURL || '',
        kind: 'user' as const,
        isOnline: isUserOnline(peer),
        peer,
      };
    }
    return {
      title: chat.title || 'Групповой чат',
      photo: '',
      kind: 'group' as const,
      isOnline: false,
      peer: null as PublicUser | null,
    };
  };

  const sortedAndFilteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = chats.filter((chat) => {
      const membership = membershipsByChatId[chat.id];
      if (filter === 'direct' && chat.type !== 'direct' && chat.type !== 'saved') {
        return false;
      }
      if (filter === 'group' && chat.type !== 'group' && chat.type !== 'public') {
        return false;
      }
      if (filter === 'pinned' && !membership?.pinned) {
        return false;
      }

      if (!q) return true;
      const info = getChatDisplayInfo(chat);
      const matchTitle = info.title.toLowerCase().includes(q);
      const matchUsername = info.peer?.username.toLowerCase().includes(q) ?? false;
      const matchLastMsg = chat.lastMessageText.toLowerCase().includes(q);
      return matchTitle || matchUsername || matchLastMsg;
    });

    return [...filtered].sort((a, b) => {
      const pinA = membershipsByChatId[a.id]?.pinned ? 1 : 0;
      const pinB = membershipsByChatId[b.id]?.pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return timestampToMillis(b.lastMessageAt) - timestampToMillis(a.lastMessageAt);
    });
  }, [chats, filter, membershipsByChatId, searchQuery, usersById, currentUser.uid]);

  // Directory people matching search query that user might want to message directly
  const matchingPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return Object.values(usersById)
      .filter(
        (u) =>
          u.uid !== currentUser.uid &&
          (u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [searchQuery, usersById, currentUser.uid]);

  const filterTabs: { id: ChatFilter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'direct', label: 'Личные' },
    { id: 'group', label: 'Группы' },
    { id: 'pinned', label: 'Важные' },
  ];

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:w-80 lg:w-[340px] shrink-0">
      {/* Top Bar */}
      <div className="px-4 pt-4 pb-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h1
            title="супер скрытный мессенджер"
            className="truncate text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            супер скрытный мессенджер
          </h1>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenProfile}
              title="Настройки профиля"
              aria-label="Настройки профиля"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex min-w-0 items-center gap-2 rounded-lg py-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            title="Профиль и настройки"
          >
            <Avatar
              name={currentUser.displayName}
              src={currentUser.photoURL}
              size="xs"
              isOnline
            />
            <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
              {currentUser.displayName}
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onOpenNewChat}
              title="Новый диалог"
              aria-label="Новый диалог"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Диалог</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewGroup}
              title="Создать группу"
              aria-label="Создать группу"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Группа</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск чатов и людей..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-950"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить поиск"
              className="absolute right-2.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Segmented Tabs */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="messenger-scroll flex-1 overflow-y-auto px-2 pb-4">
        {sortedAndFilteredChats.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {searchQuery ? 'Чаты не найдены' : 'Список чатов пуст'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {searchQuery
                ? 'Попробуйте изменить запрос или выберите человека ниже.'
                : 'Начните личный диалог или создайте групповой чат.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onOpenNewChat}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Начать диалог
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedAndFilteredChats.map((chat) => {
              const info = getChatDisplayInfo(chat);
              const membership = membershipsByChatId[chat.id];
              const isActive = chat.id === activeChatId;

              const lastMsgMs = timestampToMillis(chat.lastMessageAt);
              const lastReadMs = timestampToMillis(membership?.lastReadAt);
              const hasUnread =
                !isActive &&
                Boolean(chat.lastMessageSenderId) &&
                chat.lastMessageSenderId !== currentUser.uid &&
                lastMsgMs > lastReadMs;

              const senderPrefix =
                chat.lastMessageSenderId === currentUser.uid
                  ? 'Вы: '
                  : (chat.type === 'group' || chat.type === 'public') &&
                      chat.lastMessageSenderName
                    ? `${chat.lastMessageSenderName.split(' ')[0]}: `
                    : '';

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Avatar
                    name={info.title}
                    src={info.photo}
                    size="md"
                    kind={info.kind}
                    isOnline={info.isOnline}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {info.title}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                        {formatChatListTime(chat.lastMessageAt)}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-xs ${
                          hasUnread
                            ? 'font-medium text-slate-900 dark:text-slate-100'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {senderPrefix}
                        {chat.lastMessageText || 'Нет сообщений'}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {membership?.muted && (
                          <BellOff className="h-3 w-3 text-slate-400" />
                        )}
                        {membership?.pinned && (
                          <Pin className="h-3 w-3 text-slate-400" />
                        )}
                        {hasUnread && (
                          <span
                            aria-label="Есть непрочитанные сообщения"
                            className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Directory search results */}
        {matchingPeople.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="px-3 pb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Пользователи
            </p>
            <div className="space-y-0.5">
              {matchingPeople.map((person) => (
                <button
                  key={person.uid}
                  type="button"
                  onClick={() => {
                    void onStartDirectChat(person);
                    setSearchQuery('');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <Avatar
                    name={person.displayName}
                    src={person.photoURL}
                    size="sm"
                    isOnline={isUserOnline(person)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {person.displayName}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      @{person.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
