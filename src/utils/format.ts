import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

/** Each unit is used while the rounded count stays below `limit`. */
const AGO_UNITS = [
  { unit: 'minute', label: 'min', limit: 60 },
  { unit: 'hour', label: 'h', limit: 24 },
  { unit: 'day', label: 'd', limit: 30 },
] as const;

/**
 * How long ago `epoch` (ms) was. Relative while recent; a date once "N d ago" stops being
 * easy to place.
 */
export const ago = (epoch: number, now = Date.now()): string => {
  for (const { unit, label, limit } of AGO_UNITS) {
    // A clock slightly ahead of ours must not read as "-1 min ago".
    const count = Math.max(0, Math.round(dayjs(now).diff(epoch, unit, true)));
    if (count < limit) return count < 1 ? 'just now' : `${count} ${label} ago`;
  }
  return dayjs(epoch).format('L');
};

/**
 * An epoch (ms) or ISO timestamp as a date and time in the viewer's time zone.
 * Empty when there is none; an unparseable value is shown as it came.
 */
export const formatDateTime = (value?: number | string): string => {
  if (!value) return '';
  const date = dayjs(value);
  return date.isValid() ? date.format('L LT') : String(value);
};

/** `1 module`, `2 modules`. Only for nouns whose plural adds an s. */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
