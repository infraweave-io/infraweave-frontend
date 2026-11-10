import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { jobDrawerSearch, useJobDrawer } from './jobDrawer';

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

  it('close removes only the drawer params', () => {
    const { result } = renderHook(() => ({ drawer: useJobDrawer(), location: useLocation() }), {
      wrapper: wrapperAt('/d?foo=bar&job=abc&view=changes&type=plan'),
    });
    act(() => result.current.drawer.close());
    expect(result.current.drawer.target).toBeUndefined();
    expect(result.current.location.search).toBe('?foo=bar');
  });
});
