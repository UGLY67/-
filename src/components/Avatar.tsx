import { useState } from 'react';
import { Bookmark, Globe, Users } from 'lucide-react';
import { getInitials } from '../utils/formatters';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  kind?: 'user' | 'saved' | 'group' | 'public';
  isOnline?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

const TONE_PALETTE = [
  'bg-blue-600 text-white',
  'bg-slate-700 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
  'bg-sky-600 text-white',
  'bg-zinc-700 text-white',
];

function getColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % TONE_PALETTE.length;
  }
  return TONE_PALETTE[Math.abs(hash) % TONE_PALETTE.length];
}

export function Avatar({
  name,
  src,
  size = 'md',
  kind = 'user',
  isOnline = false,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  const renderContent = () => {
    if (kind === 'saved') {
      return (
        <div
          className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-white`}
        >
          <Bookmark className="h-[46%] w-[46%]" />
        </div>
      );
    }

    if (kind === 'public') {
      if (!imgFailed) {
        return (
          <img
            src="/src/assets/images/community_room_emblem_1795223723624.jpg"
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={`${sizeClass} shrink-0 rounded-full object-cover border border-slate-200 dark:border-slate-700`}
          />
        );
      }
      return (
        <div
          className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-slate-800 text-white dark:bg-slate-700`}
        >
          <Globe className="h-[46%] w-[46%]" />
        </div>
      );
    }

    if (kind === 'group') {
      return (
        <div
          className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
        >
          <Users className="h-[46%] w-[46%]" />
        </div>
      );
    }

    if (src && !imgFailed) {
      return (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${sizeClass} shrink-0 rounded-full object-cover border border-slate-200 dark:border-slate-700`}
        />
      );
    }

    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-semibold select-none ${getColorClass(
          name
        )}`}
      >
        {getInitials(name)}
      </div>
    );
  };

  return (
    <div className="relative inline-flex shrink-0">
      {renderContent()}
      {isOnline && kind === 'user' && (
        <span
          aria-label="В сети"
          title="В сети"
          className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
        />
      )}
    </div>
  );
}
