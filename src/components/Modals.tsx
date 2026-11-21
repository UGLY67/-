import { useMemo, useRef, useState } from 'react';
import {
  Check,
  Link2,
  LogOut,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { PrivateUser, PublicUser } from '../types/messenger';
import { VALIDATION_LIMITS } from '../types/messenger';
import { isSyntheticAuthEmail } from '../services/messengerService';
import {
  compressAvatarImage,
  isUserOnline,
  isValidHttpUrl,
} from '../utils/formatters';
import { Avatar } from './Avatar';

interface NewChatModalProps {
  initialMode: 'direct' | 'group';
  currentUser: PublicUser;
  users: PublicUser[];
  onClose: () => void;
  onStartDirectChat: (peer: PublicUser) => Promise<void>;
  onCreateGroup: (
    title: string,
    description: string,
    memberUids: string[]
  ) => Promise<void>;
}

export function NewChatModal({
  initialMode,
  currentUser,
  users,
  onClose,
  onStartDirectChat,
  onCreateGroup,
}: NewChatModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>(initialMode);
  const [query, setQuery] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherUsers = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    return users
      .filter((u) => u.uid !== currentUser.uid)
      .filter(
        (u) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      );
  }, [users, currentUser.uid, query]);

  const toggleUser = (uid: string) => {
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!groupTitle.trim()) {
      setError('Введите название группы.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreateGroup(groupTitle, groupDesc, selectedIds);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать группу');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {mode === 'direct' ? 'Новый диалог' : 'Создать группу'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'direct'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Личный диалог
            </button>
            <button
              type="button"
              onClick={() => setMode('group')}
              className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'group'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Групповой чат
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateGroup} className="flex min-h-0 flex-1 flex-col">
          {mode === 'group' && (
            <div className="space-y-3 px-5 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Название группы
                </label>
                <input
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  maxLength={VALIDATION_LIMITS.CHAT_TITLE_MAX}
                  placeholder="Например: Проектная команда"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Описание (необязательно)
                </label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  maxLength={VALIDATION_LIMITS.CHAT_DESC_MAX}
                  placeholder="Тема обсуждения..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="px-5 pt-4 pb-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти по имени или @username..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="messenger-scroll flex-1 overflow-y-auto px-3 pb-4">
            {otherUsers.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Других пользователей пока нет
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Пригласите коллег или откройте мессенджер в другом аккаунте. Вы также можете писать в «Избранное» или «Общий чат».
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {otherUsers.map((u) => {
                  const selected = selectedIds.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={async () => {
                        if (mode === 'direct') {
                          await onStartDirectChat(u);
                          onClose();
                        } else {
                          toggleUser(u.uid);
                        }
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                        selected && mode === 'group'
                          ? 'bg-blue-50 dark:bg-blue-950/50'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          name={u.displayName}
                          src={u.photoURL}
                          size="sm"
                          isOnline={isUserOnline(u)}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {u.displayName}
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            @{u.username}
                          </div>
                        </div>
                      </div>

                      {mode === 'group' && (
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            selected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="px-5 pb-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {mode === 'group' && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Выбрано участников: {selectedIds.length}
              </span>
              <button
                type="submit"
                disabled={submitting || !groupTitle.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {submitting ? 'Создание...' : 'Создать группу'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

interface ProfileModalProps {
  currentUser: PublicUser;
  privateUser: PrivateUser | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSaveProfile: (updates: {
    displayName: string;
    username: string;
    bio: string;
    photoURL: string;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

export function ProfileModal({
  currentUser,
  privateUser,
  theme,
  onToggleTheme,
  onSaveProfile,
  onSignOut,
  onClose,
}: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setProcessingAvatar(true);
    try {
      const compressed = await compressAvatarImage(file);
      setPhotoURL(compressed);
      setShowUrlInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото.');
    } finally {
      setProcessingAvatar(false);
    }
  };

  const handleApplyUrl = () => {
    setError(null);
    const trimmed = urlDraft.trim();
    if (!isValidHttpUrl(trimmed) || trimmed.length > 500) {
      setError('Укажите корректную ссылку, начинающуюся с https:// или http:// (до 500 символов).');
      return;
    }
    setPhotoURL(trimmed);
    setShowUrlInput(false);
    setUrlDraft('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);

    const cleanUsername = username.trim().toLowerCase();
    if (!displayName.trim()) {
      setError('Имя не может быть пустым.');
      return;
    }
    if (
      cleanUsername.length < VALIDATION_LIMITS.USERNAME_MIN ||
      !VALIDATION_LIMITS.USERNAME_REGEX.test(cleanUsername)
    ) {
      setError(
        'Никнейм может содержать только латинские буквы (a-z), цифры и _ (минимум 2 символа).'
      );
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile({
        displayName,
        username: cleanUsername,
        bio,
        photoURL,
      });
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения профиля');
    } finally {
      setSaving(false);
    }
  };

  const visibleSubtitle =
    privateUser?.email && !isSyntheticAuthEmail(privateUser.email)
      ? privateUser.email
      : `@${currentUser.username}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Профиль и настройки
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName || currentUser.displayName}
                src={photoURL}
                size="lg"
                isOnline
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {displayName || currentUser.displayName}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {visibleSubtitle}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFilePick}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={processingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{processingAvatar ? 'Сжатие...' : 'Загрузить фото'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUrlInput((prev) => !prev);
                      setUrlDraft(photoURL.startsWith('http') ? photoURL : '');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Ссылка URL</span>
                  </button>
                  {photoURL && (
                    <button
                      type="button"
                      onClick={() => setPhotoURL('')}
                      title="Удалить аватарку"
                      aria-label="Удалить аватарку"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showUrlInput && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="min-w-0 flex-1 bg-transparent px-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Применить
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Отображаемое имя
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={VALIDATION_LIMITS.DISPLAY_NAME_MAX}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Никнейм (@username)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={VALIDATION_LIMITS.USERNAME_MAX}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              О себе
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={VALIDATION_LIMITS.BIO_MAX}
              placeholder="Пара слов о вас..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Оформление интерфейса
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light') onToggleTheme();
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                Светлая
              </button>
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark') onToggleTheme();
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Тёмная
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {savedNotice && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Профиль обновлён.
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3.5 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Выйти
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
