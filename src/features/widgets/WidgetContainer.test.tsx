import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlacedWidget, WidgetContainer, WidgetDefinition } from './WidgetContainer';
import { useOnWidgetReload } from './widgetReload';

const reloadAlpha = vi.fn();

const Reloadable = () => {
  useOnWidgetReload(reloadAlpha);
  return <p>Alpha content</p>;
};

const WIDGETS: WidgetDefinition[] = [
  { id: 'a', title: 'Alpha', Component: Reloadable },
  { id: 'b', title: 'Beta', Component: () => <p>Beta content</p> },
  { id: 'c', title: 'Gamma', Component: () => <p>Gamma content</p> },
];

/** Small widgets with these ids, in this order. */
const small = (...ids: string[]): PlacedWidget[] => ids.map((id) => ({ id, size: 'small' }));

const renderContainer = (layout: PlacedWidget[], editing = true) => {
  const onLayoutChange = vi.fn();
  render(
    <WidgetContainer
      widgets={WIDGETS}
      layout={layout}
      onLayoutChange={onLayoutChange}
      editing={editing}
    />,
  );
  return onLayoutChange;
};

describe('WidgetContainer', () => {
  it('shows the widgets in layout order, skipping unknown ids', () => {
    renderContainer(small('b', 'gone', 'a'), false);

    expect(screen.getAllByRole('region').map((region) => region.textContent)).toEqual([
      expect.stringContaining('Beta content'),
      expect.stringContaining('Alpha content'),
    ]);
  });

  it('hides the edit controls outside edit mode', () => {
    renderContainer(small('a'), false);

    expect(screen.queryByRole('button', { name: 'Remove Alpha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add widget' })).not.toBeInTheDocument();
  });

  it('says how to add widgets when the layout is empty', () => {
    renderContainer(small(), false);

    expect(screen.getByText(/no widgets on this page/i)).toBeInTheDocument();
  });

  it('moves a widget earlier and later', async () => {
    const onLayoutChange = renderContainer(small('a', 'b', 'c'));

    await userEvent.click(screen.getByRole('button', { name: 'Move Beta earlier' }));
    expect(onLayoutChange).toHaveBeenLastCalledWith(small('b', 'a', 'c'));

    await userEvent.click(screen.getByRole('button', { name: 'Move Beta later' }));
    expect(onLayoutChange).toHaveBeenLastCalledWith(small('a', 'c', 'b'));
  });

  it('cannot move past either end', () => {
    renderContainer(small('a', 'b'));

    expect(screen.getByRole('button', { name: 'Move Alpha earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Beta later' })).toBeDisabled();
  });

  it('removes a widget', async () => {
    const onLayoutChange = renderContainer(small('a', 'b'));

    await userEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));

    expect(onLayoutChange).toHaveBeenCalledWith(small('b'));
  });

  it('adds a widget that is not on the page yet', async () => {
    const onLayoutChange = renderContainer(small('a'));

    await userEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByText('Alpha')).not.toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Gamma' }));

    expect(onLayoutChange).toHaveBeenCalledWith(small('a', 'c'));
  });

  it('offers no add tile once every widget is on the page', () => {
    renderContainer(small('a', 'b', 'c'));

    expect(screen.queryByRole('button', { name: 'Add widget' })).not.toBeInTheDocument();
  });

  it('resizes a widget from its settings', async () => {
    const onLayoutChange = renderContainer(small('a', 'b'));

    await userEvent.click(screen.getByRole('button', { name: 'Settings for Beta' }));
    expect(screen.getByRole('menuitem', { name: 'Small' })).toHaveClass('Mui-selected');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Large' }));

    expect(onLayoutChange).toHaveBeenCalledWith([
      { id: 'a', size: 'small' },
      { id: 'b', size: 'large' },
    ]);
  });

  it('reloads a widget that offers it, in or out of edit mode', async () => {
    renderContainer(small('a', 'b'), false);

    await userEvent.click(screen.getByRole('button', { name: 'Reload Alpha' }));

    expect(reloadAlpha).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Reload Beta' })).not.toBeInTheDocument();
  });

  it('spins until the reload settles', async () => {
    let finish: () => void = () => {};
    reloadAlpha.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    renderContainer(small('a'), false);

    await userEvent.click(screen.getByRole('button', { name: 'Reload Alpha' }));

    expect(screen.getByRole('progressbar', { name: 'Reloading Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Alpha' })).toBeDisabled();

    finish();
    await waitFor(() =>
      expect(
        screen.queryByRole('progressbar', { name: 'Reloading Alpha' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Reload Alpha' })).toBeEnabled();
  });

  it('spins for a moment even when the reload is instant', async () => {
    renderContainer(small('a'), false);

    await userEvent.click(screen.getByRole('button', { name: 'Reload Alpha' }));

    expect(screen.getByRole('progressbar', { name: 'Reloading Alpha' })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('progressbar', { name: 'Reloading Alpha' }),
      ).not.toBeInTheDocument(),
    );
  });
});
