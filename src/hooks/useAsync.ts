import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

type FunctionReturningPromise = (...args: any[]) => Promise<any>;

type PromiseType<P extends Promise<any>> = P extends Promise<infer T> ? T : never;

export type AsyncState<T> =
  | { loading: boolean; error?: undefined; value?: undefined }
  | { loading: true; error?: Error | undefined; value?: T }
  | { loading: false; error: Error; value?: undefined }
  | { loading: false; error?: undefined; value: T };

export function useAsyncFn<T extends FunctionReturningPromise>(
  fn: T,
  deps: DependencyList = [],
  initialState: AsyncState<PromiseType<ReturnType<T>>> = { loading: false },
): [
  AsyncState<PromiseType<ReturnType<T>>>,
  (...args: Parameters<T>) => Promise<PromiseType<ReturnType<T>> | undefined>,
] {
  const lastCallId = useRef(0);
  const isMounted = useRef(true);
  const [state, setState] = useState<AsyncState<PromiseType<ReturnType<T>>>>(initialState);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const callback = useCallback((...args: Parameters<T>) => {
    const callId = ++lastCallId.current;

    if (!state.loading) {
      setState((prev) => ({ ...prev, loading: true }));
    }

    return fn(...args).then(
      (value) => {
        if (isMounted.current && callId === lastCallId.current) {
          setState({ value, loading: false });
        }
        return value;
      },
      (error: Error) => {
        if (isMounted.current && callId === lastCallId.current) {
          setState({ error, loading: false });
        }
        return undefined;
      },
    );
    // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
  }, deps);

  return [state, callback];
}

export function useAsync<T extends FunctionReturningPromise>(
  fn: T,
  deps: DependencyList = [],
): AsyncState<PromiseType<ReturnType<T>>> {
  const [state, callback] = useAsyncFn(fn, deps, { loading: true });

  useEffect(() => {
    (callback as (...args: any[]) => Promise<unknown>)();
  }, [callback]);

  return state;
}

export default useAsync;
