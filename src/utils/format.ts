/**
 * How long ago `epoch` (ms) was. Relative while recent; a date once "N d ago" stops being
 * easy to place.
 */
export const ago = (epoch: number, now = Date.now()): string => {
  // A clock slightly ahead of ours must not read as "-1 min ago".
  const minutes = Math.max(0, Math.round((now - epoch) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(epoch).toLocaleDateString();
};

/**
 * An epoch (ms) or ISO timestamp as a date and time in the viewer's locale and time zone.
 * Empty when there is none; an unparseable value is shown as it came.
 */
export const formatDateTime = (value?: number | string): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

/** `1 module`, `2 modules`. Only for nouns whose plural adds an s. */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
