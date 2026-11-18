import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedToggle } from './SegmentedToggle';

const options = [
  { value: 'standalone', label: 'Standalone' },
  { value: 'in-stacks', label: 'Within stacks' },
  { value: 'both', label: 'Both' },
] as const;

type UsageMode = (typeof options)[number]['value'];

const ControlledGroup = () => {
  const [value, setValue] = useState<UsageMode>('standalone');

  return (
    <SegmentedToggle
      value={value}
      options={options}
      onChange={setValue}
      ariaLabel="Module usage source"
    />
  );
};

describe('SegmentedToggle', () => {
  it('keeps the active value selected when its button is clicked', async () => {
    render(<ControlledGroup />);

    const standalone = screen.getByRole('button', { name: 'Standalone' });
    await userEvent.click(standalone);

    expect(standalone).toHaveAttribute('aria-pressed', 'true');
  });
});
