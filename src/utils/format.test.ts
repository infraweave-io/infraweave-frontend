import { ago, plural } from './format';

const NOW = new Date('2026-10-09T12:00:00Z').getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('ago', () => {
  it('says just now for anything under half a minute', () => {
    expect(ago(NOW, NOW)).toBe('just now');
    expect(ago(NOW - 29 * 1000, NOW)).toBe('just now');
  });

  it('never reads negative when the timestamp is ahead of the clock', () => {
    expect(ago(NOW + 5 * MINUTE, NOW)).toBe('just now');
  });

  it('counts minutes, then hours, then days', () => {
    expect(ago(NOW - 5 * MINUTE, NOW)).toBe('5 min ago');
    expect(ago(NOW - 59 * MINUTE, NOW)).toBe('59 min ago');
    expect(ago(NOW - 60 * MINUTE, NOW)).toBe('1 h ago');
    expect(ago(NOW - 23 * HOUR, NOW)).toBe('23 h ago');
    expect(ago(NOW - 24 * HOUR, NOW)).toBe('1 d ago');
    expect(ago(NOW - 29 * DAY, NOW)).toBe('29 d ago');
  });

  it('switches to a date from 30 days', () => {
    const epoch = NOW - 30 * DAY;
    expect(ago(epoch, NOW)).toBe(new Date(epoch).toLocaleDateString());
  });

  it('defaults to the current time', () => {
    expect(ago(Date.now() - 5 * MINUTE)).toBe('5 min ago');
  });
});

describe('plural', () => {
  it('adds an s to every count but one', () => {
    expect(plural(0, 'module')).toBe('0 modules');
    expect(plural(1, 'module')).toBe('1 module');
    expect(plural(2, 'module')).toBe('2 modules');
  });
});
