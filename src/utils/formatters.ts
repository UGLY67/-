import type { Timestamp } from 'firebase/firestore';
import type { PublicUser } from '../types/messenger';

export function timestampToMillis(ts: Timestamp | null | undefined): number {
  if (!ts) return 0;
  try {
    return ts.toMillis();
  } catch {
    return 0;
  }
}

export function formatMessageTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatChatListTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return formatMessageTime(ts);
  }
  if (diffDays === 1) {
    return 'Вчера';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  }
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateDivider(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Сегодня';
  const date = ts.toDate();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function getDateKey(ts: Timestamp | null | undefined): string {
  if (!ts) return 'pending';
  const d = ts.toDate();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function isUserOnline(user: PublicUser | null | undefined): boolean {
  if (!user || !user.isOnline || !user.lastSeenAt) return false;
  const ageMs = Date.now() - timestampToMillis(user.lastSeenAt);
  return ageMs < 150_000; // 2.5 minutes heartbeat window
}

export function formatLastSeen(user: PublicUser | null | undefined): string {
  if (!user) return 'не в сети';
  if (isUserOnline(user)) return 'в сети';
  const ms = timestampToMillis(user.lastSeenAt);
  if (!ms) return 'был(а) недавно';

  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'был(а) только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `был(а) ${diffMin} мин. назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `был(а) ${diffHours} ч. назад`;

  const date = new Date(ms);
  return `был(а) ${date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })}`;
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'П';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function generateDefaultUsername(displayName: string | null, email: string | null, uid: string): string {
  const raw = (displayName || email?.split('@')[0] || 'user').toLowerCase();
  let transliterated = '';
  for (const ch of raw) {
    if (CYRILLIC_MAP[ch] !== undefined) {
      transliterated += CYRILLIC_MAP[ch];
    } else if (/[a-z0-9_]/.test(ch)) {
      transliterated += ch;
    } else if (ch === ' ' || ch === '-' || ch === '.') {
      transliterated += '_';
    }
  }
  const cleaned = transliterated.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const suffix = uid.slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, '0');
  const base = cleaned.length >= 2 ? cleaned.slice(0, 30) : `user`;
  return `${base}_${suffix}`.slice(0, 40);
}

export function isValidHttpUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isLikelyImageUrl(url: string): boolean {
  if (!isValidHttpUrl(url)) return false;
  const lower = url.toLowerCase().split('?')[0];
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.avif')
  );
}

export function pluralizeMembers(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} участника`;
  }
  return `${count} участников`;
}

export function isValidAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.length > 35000) return false;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return true;
  }
  return trimmed.length <= 500 && isValidHttpUrl(trimmed);
}

export async function compressAvatarImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите файл изображения (PNG, JPG, WebP или GIF).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Размер файла не должен превышать 10 МБ.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
      el.src = objectUrl;
    });

    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Браузер не поддерживает обработку изображений.');
    }

    const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - minSide) / 2;
    const sy = ((img.naturalHeight || img.height) - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

    const qualities = [0.82, 0.68, 0.52, 0.38];
    for (const mime of ['image/webp', 'image/jpeg']) {
      for (const q of qualities) {
        const dataUrl = canvas.toDataURL(mime, q);
        if (
          dataUrl.length <= 35000 &&
          /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
        ) {
          return dataUrl;
        }
      }
    }

    throw new Error('Не удалось сжать изображение до допустимого размера. Попробуйте другое фото.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
