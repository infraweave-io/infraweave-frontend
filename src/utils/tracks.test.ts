import { trackRank } from './tracks';

describe('trackRank', () => {
  it('orders tracks from most to least stable', () => {
    const tracks = ['dev', 'stable', 'alpha', 'beta'];
    expect(tracks.sort((a, b) => trackRank(a) - trackRank(b))).toEqual([
      'stable',
      'beta',
      'alpha',
      'dev',
    ]);
  });

  it('puts unknown tracks after the known ones', () => {
    expect(trackRank('canary')).toBeGreaterThan(trackRank('dev'));
  });
});
