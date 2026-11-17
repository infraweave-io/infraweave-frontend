import { act, renderHook } from '@testing-library/react';
import { clearQueryCache, QUERY_FRESH_FOR_MS, useCachedQuery } from './queryCache';

describe('useCachedQuery', () => {
  beforeEach(() => {
    clearQueryCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderQuery = async (key: string, fetcher: () => Promise<string>) => {
    const hook = renderHook(() => useCachedQuery(key, fetcher));
    await act(async () => {});
    return hook;
  };

  it('loads once for callers sharing a key, and again for a remount once stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetcher = vi.fn(() => Promise.resolve('releases'));

    const first = await renderQuery('releases', fetcher);
    expect(first.result.current).toMatchObject({ data: 'releases', loading: false });
    first.unmount();
    await renderQuery('releases', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + QUERY_FRESH_FOR_MS);
    const stale = await renderQuery('releases', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(stale.result.current.data).toBe('releases');
  });

  it('joins a load already running for the key', async () => {
    const fetcher = vi.fn(() => Promise.resolve('releases'));

    renderHook(() => useCachedQuery('releases', fetcher));
    renderHook(() => useCachedQuery('releases', fetcher));
    await act(async () => {});

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reloads a fresh result on request', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const { result } = await renderQuery('releases', fetcher);

    await act(async () => result.current.reload());

    expect(result.current.data).toBe('new');
  });

  it('keeps the last result beside an error, and loads again on the next mount', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce('old')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('new');
    const first = await renderQuery('releases', fetcher);
    await act(async () => first.result.current.reload());

    expect(first.result.current).toMatchObject({ data: 'old', error: new Error('offline') });

    first.unmount();
    const second = await renderQuery('releases', fetcher);
    expect(second.result.current).toMatchObject({ data: 'new', error: undefined });
  });

  it('drops results on clear, and ignores a load from before it', async () => {
    let resolve: (value: string) => void = () => {};
    const { result } = renderHook(() =>
      useCachedQuery('releases', () => new Promise<string>((r) => (resolve = r))),
    );

    act(() => clearQueryCache());
    await act(async () => resolve('last user'));

    expect(result.current.data).toBeUndefined();
  });
});
