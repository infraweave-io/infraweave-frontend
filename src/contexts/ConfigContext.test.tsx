import React from 'react';
import { renderHook } from '@testing-library/react';
import { ConfigProvider, useAppConfig } from './ConfigContext';

vi.mock('../utils/authToken', () => ({
  ensureFreshAuthToken: vi.fn(async () => 'secret-token'),
  forceRefreshAuthToken: vi.fn(),
  clearSession: vi.fn(),
}));

const authHeaderSentTo = async (url: string) => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  const { result } = renderHook(() => useAppConfig(), {
    wrapper: ({ children }) => (
      <ConfigProvider isStandalone backendBaseUrl="https://api.example.com">
        {children}
      </ConfigProvider>
    ),
  });
  await result.current.config.fetch(url);
  const init = fetchSpy.mock.calls[0][1];
  fetchSpy.mockRestore();
  return new Headers(init?.headers).get('Authorization');
};

describe('config.fetch', () => {
  it('sends the token to the API and the app itself', async () => {
    expect(await authHeaderSentTo('https://api.example.com/api/v1/projects')).toBe(
      'Bearer secret-token',
    );
    expect(await authHeaderSentTo('/api/v1/projects')).toBe('Bearer secret-token');
  });

  it('never sends the token to another host', async () => {
    expect(await authHeaderSentTo('https://attacker.example/x.json')).toBeNull();
    expect(await authHeaderSentTo('//attacker.example/x.json')).toBeNull();
  });
});
