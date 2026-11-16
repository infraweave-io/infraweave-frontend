import React from 'react';
import { render } from '@testing-library/react';
import { ListIncomplete } from './ListIncomplete';

describe('ListIncomplete', () => {
  it('reads as one sentence with the reason', () => {
    const { container } = render(<ListIncomplete label="deployments" reason="stopped early" />);

    expect(container.textContent).toBe(
      'This list is incomplete: loading deployments stopped early. Reload to try again.',
    );
  });

  it('says how to try again when a reload is not the way', () => {
    const { container } = render(
      <ListIncomplete
        label="deployments"
        reason="stopped early"
        retry="Use Refresh to try again."
      />,
    );

    expect(container.textContent).toBe(
      'This list is incomplete: loading deployments stopped early. Use Refresh to try again.',
    );
  });

  it('falls back to the page-cap reason', () => {
    const { container } = render(<ListIncomplete label="modules" />);

    expect(container.textContent).toBe(
      'This list is incomplete: loading modules stopped before the registry was exhausted. Reload to try again.',
    );
  });
});
