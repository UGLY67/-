import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  Moon,
  Sun,
  Users,
  Zap,
} from 'lucide-react';
import { VALIDATION_LIMITS } from '../types/messenger';

interface AuthScreenProps {
  onGoogleSignIn: () => Promise<void>;
  onCredentialsSignIn: (username: string, password: string) => Promise<void>;
  onCredentialsRegister: (params: {
    username: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  authError: string | null;
}

export function AuthScreen({
  onGoogleSignIn,
  onCredentialsSignIn,
  onCredentialsRegister,
  theme,
  onToggleTheme,
  authError,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<'credentials' | 'google' | null>(
    null
  );
  const [imgFailed, setImgFailed] = useState(false);

  const handleModeSwitch = (next: 'login' | 'register') => {
    setMode(next);
    setLocalError(null);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (
      cleanUsername.length < VALIDATION_LIMITS.USERNAME_MIN ||
      cleanUsername.length > VALIDATION_LIMITS.USERNAME_MAX ||
      !VALIDATION_LIMITS.USERNAME_REGEX.test(cleanUsername)
    ) {
      setLocalError(
        'Никнейм должен содержать от 2 до 40 символов: только латинские буквы (a-z), цифры и _.'
      );
      return;
    }

    if (password.length < VALIDATION_LIMITS.PASSWORD_MIN) {
      setLocalError('Пароль должен содержать минимум 6 символов.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setLocalError('Пароли не совпадают.');
      return;
    }

    setLoadingMode('credentials');
    try {
      if (mode === 'login') {
        await onCredentialsSignIn(cleanUsername, password);
      } else {
        await onCredentialsRegister({
          username: cleanUsername,
          password,
          displayName: displayName.trim() || cleanUsername,
        });
      }
    } finally {
      setLoadingMode(null);
    }
  };

  const handleGoogleClick = async () => {
    setLocalError(null);
    setLoadingMode('google');
    try {
      await onGoogleSignIn();
    } finally {
      setLoadingMode(null);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between gap-8 border-b border-slate-200 px-6 py-4 dark:border-slate-800 lg:px-12">
        <div className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
          супер скрытный мессенджер
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <span className="whitespace-nowrap shrink-0">Личные диалоги</span>
          <span className="whitespace-nowrap shrink-0">Групповые чаты</span>
          <span className="whitespace-nowrap shrink-0">Мгновенная синхронизация</span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shrink-0"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-stretch gap-10 px-6 py-10 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-12">
        <div className="flex flex-col justify-center lg:col-span-6">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Пространство для общения в реальном времени
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance] dark:text-slate-100 sm:text-4xl">
            Чистая и быстрая переписка без лишнего шума
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Войдите по никнейму и паролю, создайте новую учётную запись или используйте Google-аккаунт.
          </p>

          {/* Auth Card */}
          <div className="mt-6 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('register')}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Регистрация
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Никнейм
                </label>
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3 font-mono text-sm text-slate-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    maxLength={VALIDATION_LIMITS.USERNAME_MAX}
                    autoComplete="username"
                    placeholder="alex_99"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-7 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-950"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Латинские буквы (a-z), цифры и символ _
                </p>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Отображаемое имя (необязательно)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={VALIDATION_LIMITS.DISPLAY_NAME_MAX}
                    autoComplete="name"
                    placeholder="Как вас будут видеть в чатах"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-950"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Пароль
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={VALIDATION_LIMITS.PASSWORD_MAX}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Минимум 6 символов"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Повторите пароль
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    maxLength={VALIDATION_LIMITS.PASSWORD_MAX}
                    autoComplete="new-password"
                    placeholder="Введите пароль ещё раз"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-950"
                  />
                </div>
              )}

              {displayError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {displayError}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingMode !== null}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
              >
                <span>
                  {loadingMode === 'credentials'
                    ? mode === 'login'
                      ? 'Выполняется вход...'
                      : 'Создание аккаунта...'
                    : mode === 'login'
                      ? 'Войти по никнейму'
                      : 'Создать аккаунт'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">или</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loadingMode !== null}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <span>
                {loadingMode === 'google'
                  ? 'Подключение Google...'
                  : 'Войти через Google'}
              </span>
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 sm:grid-cols-3 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Реальное время</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Мгновенная доставка сообщений, реакций и индикатора набора.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Группы и контакты</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Личные диалоги, закрытые команды и общий чат.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Изоляция данных</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Доступ к беседам есть только у подтверждённых участников.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-stretch lg:col-span-6">
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {!imgFailed ? (
              <img
                src="/src/assets/images/messenger_auth_backdrop_1795223722572.jpg"
                alt="Архитектурные стеклянные призмы — супер скрытный мессенджер"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full min-h-[320px] w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center bg-slate-100 p-12 dark:bg-slate-900">
                <MessageSquare className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                  супер скрытный мессенджер
                </p>
              </div>
            )}
            <div className="border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
              <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Избранное для заметок · Общий чат · Личные диалоги</span>
                <span className="font-mono-tabular">Web · Mobile</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
