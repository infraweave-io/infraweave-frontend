import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ModuleStackUsageExplorerPage } from './ModuleStackUsageExplorerPage';

vi.mock('./ModuleStackUsageExplorerCard', () => ({
  ModuleStackUsageExplorerCard: () => <div data-testid="module-stack-explorer-card" />,
}));

describe('ModuleStackUsageExplorerPage', () => {
  it('shows the explorer title and returns to the dashboard', () => {
    const onBack = vi.fn();

    render(<ModuleStackUsageExplorerPage onBack={onBack} />);

    expect(
      screen.getByRole('heading', { name: 'Deployment Explorer', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('module-stack-explorer-card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
