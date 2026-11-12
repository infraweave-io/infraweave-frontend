import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogViewer, LogViewerProps } from './ComponentAdapter';
import { ThemeProviderWrapper } from '../../contexts/ThemeContext';

const LOGS = ['Initializing...', 'Plan: 1 to add', 'apply started', 'Plan: done', 'Done!'].join(
  '\n',
);

const renderViewer = (props: Partial<LogViewerProps> = {}) =>
  render(
    <ThemeProviderWrapper>
      <LogViewer text={LOGS} {...props} />
    </ThemeProviderWrapper>,
  );

const scrolledTo: Element[] = [];

beforeEach(() => {
  scrolledTo.length = 0;
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolledTo.push(this);
  });
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LogViewer', () => {
  it('numbers every line', () => {
    const { container } = renderViewer();
    expect(container.querySelectorAll('[data-line]')).toHaveLength(5);
    expect(container.querySelector('[data-line="5"]')).toHaveTextContent('Done!');
  });

  it('opens with the search, mode and wrap from its initial state', () => {
    const { container } = renderViewer({
      initialState: { search: 'plan:', filter: false, wrap: true },
    });
    expect(screen.getByPlaceholderText('Search logs...')).toHaveValue('plan:');
    expect(screen.getByRole('button', { name: /highlight/i })).toBeInTheDocument();
    expect(screen.getByTitle('Disable word wrap')).toBeInTheDocument();
    // Highlight mode keeps the non-matching lines.
    expect(container.querySelectorAll('[data-line]')).toHaveLength(5);
  });

  it('filters to matching lines by default, keeping their real line numbers', () => {
    const { container } = renderViewer({ initialState: { search: 'plan:' } });
    const lines = [...container.querySelectorAll('[data-line]')].map((el) =>
      el.getAttribute('data-line'),
    );
    expect(lines).toEqual(['2', '4']);
  });

  it('starts on, and scrolls to, the initial match', () => {
    const { container } = renderViewer({ initialState: { search: 'plan:', match: 1 } });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(scrolledTo).toContain(container.querySelector('[data-match="1"]'));
  });

  it('scrolls to the initial line', () => {
    const { container } = renderViewer({ initialState: { line: 3 } });
    expect(scrolledTo).toContain(container.querySelector('[data-line="3"]'));
  });

  it('waits for a linked line that has not loaded yet', () => {
    const { container, rerender } = renderViewer({ initialState: { line: 7 } });
    expect(scrolledTo).toHaveLength(0);
    rerender(
      <ThemeProviderWrapper>
        <LogViewer text={`${LOGS}\nmore\nlinked line`} initialState={{ line: 7 }} />
      </ThemeProviderWrapper>,
    );
    expect(scrolledTo).toContain(container.querySelector('[data-line="7"]'));
  });

  it('reports line selection and match navigation, but not its initial state', async () => {
    const onStateChange = vi.fn();
    renderViewer({ initialState: { search: 'plan:' }, onStateChange });
    expect(onStateChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ match: 1 }));

    await userEvent.click(screen.getByTitle('Link to line 4'));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ line: 4 }));

    await userEvent.click(screen.getByTitle('Deselect line'));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ line: undefined }));
  });

  it('reports the search once typing settles', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onStateChange = vi.fn();
    renderViewer({ onStateChange });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.type(screen.getByPlaceholderText('Search logs...'), 'plan:');
    expect(onStateChange).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'plan:' }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'plan:', match: 0 }),
    );
  });
});
