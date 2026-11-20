import { CHART_STATUS_COLORS } from './ThemeContext';
import { statusKind } from '../utils/deploymentStatus';

describe('CHART_STATUS_COLORS', () => {
  const samples = ['success', 'failed_plan', 'running', 'something-else', undefined];

  it.each(['light', 'dark'] as const)(
    'gives every status kind its own colour in %s mode',
    (mode) => {
      const palette = CHART_STATUS_COLORS[mode];
      const colors = samples.map((status) => palette[statusKind(status)]);
      expect(colors.every(Boolean)).toBe(true);
      // Colour is the only cue in the chart fill, so kinds must not share one.
      expect(new Set(Object.values(palette)).size).toBe(Object.keys(palette).length);
    },
  );
});
