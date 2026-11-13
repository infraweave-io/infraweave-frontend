import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { jobDrawerSearch, readLogViewState, useJobDrawer, writeLogViewState } from './jobDrawer';

const wrapperAt = (url: string) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return Wrapper;
};

describe('jobDrawerSearch', () => {
  it('sets the job, view and lowercased type and keeps other params', () => {
    const search = jobDrawerSearch(new URLSearchParams('foo=bar'), {
      jobId: 'abc',
      view: 'changes',
      changeType: 'MUTATE',
    });
    expect(Object.fromEntries(new URLSearchParams(search))).toEqual({
      foo: 'bar',
      job: 'abc',
      view: 'changes',
      type: 'mutate',
    });
  });

  it("drops the previous job's log settings", () => {
    const search = jobDrawerSearch(new URLSearchParams('q=plan:&mode=highlight&line=3'), {
      jobId: 'abc',
      view: 'logs',
    });
    expect(Object.fromEntries(new URLSearchParams(search))).toEqual({ job: 'abc', view: 'logs' });
  });

  it('drops a stale type when the target has none', () => {
    const search = jobDrawerSearch(new URLSearchParams('job=old&view=logs&type=plan'), {
      jobId: 'abc',
      view: 'logs',
    });
    expect(new URLSearchParams(search).has('type')).toBe(false);
  });
});

describe('useJobDrawer', () => {
  it('reads the target from the URL', () => {
    const { result } = renderHook(() => useJobDrawer(), {
      wrapper: wrapperAt('/d?job=abc&view=logs&type=mutate'),
    });
    expect(result.current.target).toEqual({ jobId: 'abc', view: 'logs', changeType: 'mutate' });
  });

  it('ignores an unknown view', () => {
    const { result } = renderHook(() => useJobDrawer(), {
      wrapper: wrapperAt('/d?job=abc&view=nope'),
    });
    expect(result.current.target).toBeUndefined();
  });

  it("keeps the link's router state when the log view writes to the URL", () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter
        initialEntries={[
          { pathname: '/d', search: '?job=abc&view=logs', state: { jobStatus: 'successful' } },
        ]}
      >
        {children}
      </MemoryRouter>
    );
    const { result } = renderHook(() => ({ drawer: useJobDrawer(), location: useLocation() }), {
      wrapper: Wrapper,
    });
    act(() =>
      result.current.drawer.setLogViewState({
        search: 'plan:',
        filter: true,
        wrap: false,
        match: 0,
      }),
    );
    expect(result.current.location.search).toBe('?job=abc&view=logs&q=plan%3A');
    expect(result.current.location.state).toEqual({ jobStatus: 'successful' });
  });

  it('close removes only the drawer params', () => {
    const { result } = renderHook(() => ({ drawer: useJobDrawer(), location: useLocation() }), {
      wrapper: wrapperAt('/d?foo=bar&job=abc&view=changes&type=plan'),
    });
    act(() => result.current.drawer.close());
    expect(result.current.drawer.target).toBeUndefined();
    expect(result.current.location.search).toBe('?foo=bar');
  });
});

describe('log view state', () => {
  it('round-trips every setting, with match one-based in the URL', () => {
    const state = { search: 'plan:', filter: false, wrap: true, match: 2, line: 120 };
    const params = writeLogViewState(new URLSearchParams('job=abc'), state);
    expect(params.toString()).toBe('job=abc&q=plan%3A&mode=highlight&wrap=1&match=3&line=120');
    expect(readLogViewState(params)).toEqual(state);
  });

  it('leaves defaults out of the URL', () => {
    const params = writeLogViewState(new URLSearchParams('job=abc&q=old&line=4'), {
      search: '',
      filter: true,
      wrap: false,
      match: 0,
    });
    expect(params.toString()).toBe('job=abc');
  });

  it('ignores malformed numbers', () => {
    expect(readLogViewState(new URLSearchParams('match=0&line=abc'))).toEqual({});
  });

  it('close removes the log settings too', () => {
    const { result } = renderHook(() => ({ drawer: useJobDrawer(), location: useLocation() }), {
      wrapper: wrapperAt('/d?job=abc&view=logs&q=plan:&wrap=1&line=9'),
    });
    act(() => result.current.drawer.close());
    expect(result.current.location.search).toBe('');
  });
});
