/** Every track a version can be published to, most to least stable. */
export const TRACKS: readonly string[] = ['stable', 'beta', 'alpha', 'dev'];

/** Sort position of a track. Tracks not listed in `TRACKS` sort after them. */
export const trackRank = (track: string) => {
  const index = TRACKS.indexOf(track);
  return index === -1 ? TRACKS.length : index;
};
