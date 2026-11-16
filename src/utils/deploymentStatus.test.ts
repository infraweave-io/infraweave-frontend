import { isFailedDeployment, statusKind } from './deploymentStatus';

describe('statusKind', () => {
  it.each([
    'failed',
    'error',
    'failure',
    'timed_out',
    'cancelled',
    'rolled_back',
    'FAILED',
    'failed_plan',
    'failed_init',
    'failed_policy',
  ])('reads %s as failed', (status) => {
    expect(statusKind(status)).toBe('failed');
  });

  it('tells success, progress and the unknown apart', () => {
    expect(statusKind('successful')).toBe('success');
    expect(statusKind('running')).toBe('in-progress');
    expect(statusKind('requested')).toBe('in-progress');
    expect(statusKind('initiated')).toBe('in-progress');
    expect(statusKind('drifted')).toBe('unknown');
    expect(statusKind(undefined)).toBe('unknown');
  });
});

describe('isFailedDeployment', () => {
  it('agrees with statusKind on the status', () => {
    expect(isFailedDeployment({ status: 'timed_out', error_text: '' })).toBe(true);
    expect(isFailedDeployment({ status: 'successful', error_text: '' })).toBe(false);
  });

  it('counts a recorded error whatever the status says', () => {
    expect(isFailedDeployment({ status: 'successful', error_text: 'boom' })).toBe(true);
  });
});
