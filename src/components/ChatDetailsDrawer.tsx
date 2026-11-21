import { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  ExternalLink,
  LogOut,
  Pin,
  PinOff,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  Chat,
  ChatMembership,
  Message,
  PublicUser,
} from '../types/messenger';
import { VALIDATION_LIMITS } from '../types/messenger';
import {
  formatLastSeen,
  isUserOnline,
  isValidHttpUrl,
  pluralizeMembers,
} from '../utils/formatters';
import { Avatar } from './Avatar';

interface ChatDetailsDrawerProps {
  chat: Chat;
  currentUser: PublicUser;
  usersById: Record<string, PublicUser>;
  membership?: ChatMembership;
  messages: Message[];
  onClose: () => void;
  onTogglePin: () => Promise<void>;
  onToggleMute: () => Promise<void>;
  onUpdateGroupInfo: (title: string, description: string) => Promise<void>;
  onUpdateGroupMembers: (memberIds: string[]) => Promise<void>;
  onLeaveGroup: () => Promise<void>;
  onDeleteGroup: () => Promise<void>;
  onStartDirectChat: (peer: PublicUser) => Promise<void>;
}

export function ChatDetailsDrawer({
  chat,
  currentUser,
  usersById,
  membership,
  messages,
  onClose,
  onTogglePin,
  onToggleMute,
  onUpdateGroupInfo,
  onUpdateGroupMembers,
  onLeaveGroup,
  onDeleteGroup,
  onStartDirectChat,
}: ChatDetailsDrawerProps) {
  const isOwner = chat.ownerId === currentUser.uid;
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState(chat.title);
  const [groupDesc, setGroupDesc] = useState(chat.description);
  const [addingMember, setAddingMember] = useState(false);
  const [saving, setSaving] = useState(false);

  const peerId =
    chat.type === 'direct'
      ? chat.memberIds.find((id) => id !== currentUser.uid) || currentUser.uid
      : null;
  const peer = peerId ? usersById[peerId] : null;

  const title =
    chat.type === 'saved'
      ? 'Избранное'
      : chat.type === 'public'
        ? chat.title || 'Общий чат'
        : chat.type === 'direct'
          ? peer?.displayName || 'Личный диалог'
          : chat.title;

  const description =
    chat.type === 'direct'
      ? peer?.bio || ''
      : chat.description || '';

  const sharedLinks = useMemo(() => {
    const urls = new Set<string>();
    for (const m of messages) {
      if (m.attachmentUrl && isValidHttpUrl(m.attachmentUrl)) {
        urls.add(m.attachmentUrl);
      }
      const matches = m.text.match(/https?:\/\/[^\s<]+/g);
      if (matches) {
        for (const u of matches) urls.add(u);
      }
    }
    return Array.from(urls).slice(-12).reverse();
  }, [messages]);

  const candidatesToAdd = useMemo(() => {
    return Object.values(usersById).filter(
      (u) => !chat.memberIds.includes(u.uid)
    );
  }, [usersById, chat.memberIds]);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    setSaving(true);
    try {
      await onUpdateGroupInfo(groupTitle, groupDesc);
      setEditingGroup(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:w-80 shrink-0">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Информация
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть панель"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="messenger-scroll flex-1 overflow-y-auto p-5 space-y-6">
        {/* Header Profile */}
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={title}
            src={peer?.photoURL}
            size="xl"
            kind={
              chat.type === 'saved'
                ? 'saved'
                : chat.type === 'public'
                  ? 'public'
                  : chat.type === 'direct'
                    ? 'user'
                    : 'group'
            }
            isOnline={chat.type === 'direct' ? isUserOnline(peer) : false}
          />
          <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h4>
          {chat.type === 'direct' && peer && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              @{peer.username} · {formatLastSeen(peer)}
            </p>
          )}
          {chat.type === 'group' && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {pluralizeMembers(chat.memberIds.length)}
            </p>
          )}
          {description && (
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>

        {/* Pin & Mute Controls */}
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => void onTogglePin()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              membership?.pinned
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {membership?.pinned ? (
              <>
                <PinOff className="h-3.5 w-3.5" />
                Открепить
              </>
            ) : (
              <>
                <Pin className="h-3.5 w-3.5" />
                Закрепить
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void onToggleMute()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              membership?.muted
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {membership?.muted ? (
              <>
                <Bell className="h-3.5 w-3.5" />
                Вкл. звук
              </>
            ) : (
              <>
                <BellOff className="h-3.5 w-3.5" />
                Без звука
              </>
            )}
          </button>
        </div>

        {/* Group Edit Form (Owner only) */}
        {chat.type === 'group' && isOwner && (
          <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
            {!editingGroup ? (
              <button
                type="button"
                onClick={() => {
                  setGroupTitle(chat.title);
                  setGroupDesc(chat.description);
                  setEditingGroup(true);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Изменить название и описание
              </button>
            ) : (
              <form onSubmit={handleSaveGroup} className="space-y-3">
                <input
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  maxLength={VALIDATION_LIMITS.CHAT_TITLE_MAX}
                  placeholder="Название группы"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
                <textarea
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  maxLength={VALIDATION_LIMITS.CHAT_DESC_MAX}
                  placeholder="Описание группы"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving || !groupTitle.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGroup(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Group Participants */}
        {chat.type === 'group' && (
          <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Участники · {chat.memberIds.length}
              </span>
              {isOwner && candidatesToAdd.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddingMember((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Добавить
                </button>
              )}
            </div>

            {addingMember && isOwner && (
              <div className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                {candidatesToAdd.map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={async () => {
                      await onUpdateGroupMembers([...chat.memberIds, u.uid]);
                      setAddingMember(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white dark:hover:bg-slate-900"
                  >
                    <Avatar name={u.displayName} src={u.photoURL} size="xs" />
                    <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {u.displayName}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {chat.memberIds.map((uid) => {
                const member = usersById[uid];
                const memberName = member?.displayName || 'Участник';
                const memberOnline = isUserOnline(member);
                const isMemberOwner = uid === chat.ownerId;

                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <button
                      type="button"
                      disabled={!member || uid === currentUser.uid}
                      onClick={() => {
                        if (member && uid !== currentUser.uid) {
                          void onStartDirectChat(member);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
                    >
                      <Avatar
                        name={memberName}
                        src={member?.photoURL}
                        size="xs"
                        isOnline={memberOnline}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                          {memberName}
                          {uid === currentUser.uid && ' (Вы)'}
                        </div>
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {isMemberOwner ? 'Создатель' : 'Участник'}
                          {member ? ` · ${formatLastSeen(member)}` : ''}
                        </div>
                      </div>
                    </button>

                    {isOwner && uid !== currentUser.uid && (
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateGroupMembers(
                            chat.memberIds.filter((id) => id !== uid)
                          )
                        }
                        title="Удалить из группы"
                        aria-label="Удалить из группы"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 shrink-0"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared Links */}
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <h4 className="mb-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
            Ссылки в чате · {sharedLinks.length}
          </h4>
          {sharedLinks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Отправленные ссылки появятся здесь автоматически.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sharedLinks.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-blue-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-slate-800/60"
                >
                  <span className="truncate">{url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Group Leave / Delete */}
        {chat.type === 'group' && (
          <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
            {isOwner ? (
              <button
                type="button"
                onClick={() => void onDeleteGroup()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Удалить группу
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onLeaveGroup()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                <LogOut className="h-3.5 w-3.5" />
                Покинуть группу
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
