import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearWidgetSettings, useWidgetSetting, WidgetIdContext } from './widgetSettings';

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

/** Settings as the hook stores them: with the user they belong to. */
const storeSettings = (value: unknown, owner = 'auth-disabled') =>
  localStorage.setItem('infraweave.widgetSettings.v1', JSON.stringify({ owner, value }));

describe('useWidgetSetting', () => {
  beforeEach(() => {
    localStorage.clear();
    // Auth disabled stands for one known user, so settings are kept.
    localStorage.setItem('auth_token', 'disabled_auth_dummy_token');
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
    storeSettings({ counter: { count: 'lots' } });

    renderCounter('counter');

    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument();
  });

  it('stores nothing outside a widget container', async () => {
    renderCounter(null);
    await userEvent.click(screen.getByRole('button', { name: 'Count 0' }));

    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
    expect(localStorage.getItem('infraweave.widgetSettings.v1')).toBeNull();
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

    storeSettings({ picker: { picked: ['vpc', 3] } });
    render(
      <WidgetIdContext.Provider value="picker">
        <Picker />
      </WidgetIdContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Picked none' })).toBeInTheDocument();
  });

  it('never reads another user’s settings', () => {
    storeSettings({ counter: { count: 5 } }, 'https://issuer|someone-else');

    renderCounter('counter');

    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument();
  });

  it('stores nothing when the user is not known', async () => {
    localStorage.removeItem('auth_token');
    renderCounter('counter');
    await userEvent.click(screen.getByRole('button', { name: 'Count 0' }));

    expect(localStorage.getItem('infraweave.widgetSettings.v1')).toBeNull();
  });

  it('forgets a widget’s settings when it is cleared', async () => {
    const first = renderCounter('counter');
    await userEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    first.unmount();

    clearWidgetSettings('counter');
    renderCounter('counter');

    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument();
  });
});
