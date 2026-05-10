export { RootPage } from './RootPage';

if (process.env.NODE_ENV === 'development' && process.env.MOCK_REQUESTS === 'true') {
  console.log('Starting MSW');
  (async () => {
    const { worker } = await import('../../../mocks/browser');
    worker.start(); // Mock backend proxy requests
  })();
}
