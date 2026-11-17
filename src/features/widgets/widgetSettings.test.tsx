import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWidgetSetting, WidgetIdContext } from './widgetSettings';

const Counter = () => {
  const [count, setCount] = useWidgetSetting('count', 0);
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
};

const Picker = () => {
  const [picked, setPicked] = useWidgetSetting<string[]>('picked', []);
  return (
    <button onClick={() => setPicked([...picked, 'vpc'])}>
      Picked {picked.length ? picked.join(',') : 'none'}
    </button>
  );
};

const renderCounter = (widgetId: string | null) =>
  render(
    <WidgetIdContext.Provider value={widgetId}>
      <Counter />
    </WidgetIdContext.Provider>,
  );

describe('useWidgetSetting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps a setting for the next time the widget mounts', async () => {
    const first = renderCounter('counter');
    await userEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    first.unmount();

    renderCounter('counter');

    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
  });

  it('keeps each widget’s settings apart', async () => {
    const first = renderCounter('one');
    await userEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    first.unmount();

    renderCounter('two');

    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument();
  });

  it('ignores a stored value of the wrong type', () => {
    localStorage.setItem(
      'infraweave.widgetSettings.v1',
      JSON.stringify({ counter: { count: 'lots' } }),
    );

    renderCounter('counter');

    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument();
  });

  it('stores nothing outside a widget container', async () => {
    renderCounter(null);
    await userEvent.click(screen.getByRole('button', { name: 'Count 0' }));

    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it('keeps a list setting, and ignores a stored list that is not all strings', async () => {
    const first = render(
      <WidgetIdContext.Provider value="picker">
        <Picker />
      </WidgetIdContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Picked none' }));
    first.unmount();

    const second = render(
      <WidgetIdContext.Provider value="picker">
        <Picker />
      </WidgetIdContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Picked vpc' })).toBeInTheDocument();
    second.unmount();

    localStorage.setItem(
      'infraweave.widgetSettings.v1',
      JSON.stringify({ picker: { picked: ['vpc', 3] } }),
    );
    render(
      <WidgetIdContext.Provider value="picker">
        <Picker />
      </WidgetIdContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Picked none' })).toBeInTheDocument();
  });
});
