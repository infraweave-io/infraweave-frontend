import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CloudFilterPanel from './CloudFilterPanel';
import { SelectedProvidersProvider, useSelectedProviders } from './SelectedProvidersContext';

// The panel lowercases everything it reads and writes, so the state has to hold
// lowercase names. This probe shows the state the rest of the app consumes.
const SelectionProbe = () => {
  const { selectedProviders } = useSelectedProviders();
  return <div data-testid="selection">{JSON.stringify(selectedProviders)}</div>;
};

describe('CloudFilterPanel', () => {
  beforeEach(() => localStorage.clear());

  const renderPanel = () =>
    render(
      <SelectedProvidersProvider>
        <CloudFilterPanel />
        <SelectionProbe />
      </SelectedProvidersProvider>,
    );

  const selection = () => JSON.parse(screen.getByTestId('selection').textContent!);

  it('ticks the offered clouds on a first visit', () => {
    // The default selection has to match what the checkbox reads, or the box
    // renders unticked while the lists are full — a filter that looks inverted.
    renderPanel();

    expect(screen.getByRole('checkbox', { name: 'AWS' })).toBeChecked();
    expect(selection()).toEqual(['aws']);
  });

  it('does not duplicate a cloud when it is toggled', async () => {
    // A mismatched default ('AWS' in state, 'aws' from the checkbox) made the
    // first click *append* rather than remove, and Projects/Policies fetch once
    // per selected entry — so every row rendered twice.
    renderPanel();
    const checkbox = screen.getByRole('checkbox', { name: 'AWS' });

    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(selection()).toEqual([]);

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(selection()).toEqual(['aws']);
  });

  it('normalizes a stored selection saved in another casing', () => {
    localStorage.setItem('selectedProviders', JSON.stringify(['AWS']));

    renderPanel();

    expect(screen.getByRole('checkbox', { name: 'AWS' })).toBeChecked();
    expect(selection()).toEqual(['aws']);
  });

  it('defers to a provider already mounted above it', () => {
    // RootPage mounts the provider inside the app-root copy. Two independent
    // states meant a toggle in one subtree never reached the other, and the inner
    // one re-ticked every cloud whenever navigation remounted it.
    render(
      <SelectedProvidersProvider initialProviders={['aws']}>
        <SelectedProvidersProvider>
          <CloudFilterPanel />
          <SelectionProbe />
        </SelectedProvidersProvider>
      </SelectedProvidersProvider>,
    );

    expect(selection()).toEqual(['aws']);
  });

  it('keeps an emptied selection when a nested provider remounts', async () => {
    // The inner provider used to re-read the persisted `[]`, hit the
    // start-inclusive fallback, and silently re-tick everything on navigation.
    const { rerender } = render(
      <SelectedProvidersProvider>
        <SelectedProvidersProvider key="a">
          <CloudFilterPanel />
          <SelectionProbe />
        </SelectedProvidersProvider>
      </SelectedProvidersProvider>,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'AWS' }));
    expect(selection()).toEqual([]);

    // A fresh key remounts the inner provider, as a route change would.
    rerender(
      <SelectedProvidersProvider>
        <SelectedProvidersProvider key="b">
          <CloudFilterPanel />
          <SelectionProbe />
        </SelectedProvidersProvider>
      </SelectedProvidersProvider>,
    );

    expect(selection()).toEqual([]);
  });
});
