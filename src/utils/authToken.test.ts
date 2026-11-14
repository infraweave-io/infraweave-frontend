import { clearSession } from './authToken';

describe('clearSession', () => {
  it('removes the tokens and everything stored for the user', () => {
    for (const key of [
      'auth_token',
      'access_token',
      'refresh_token',
      'user',
      'oauth_state',
      'selectedProviders',
      'selectedProjectNames',
      'selectedRegions',
      'selectedProjectName',
      'selectedRegion',
      'selectedRepositoryData',
      'infraweave.projects.v1',
      'infraweave.resource-names.v1.module',
      'infraweave.fleet.v2',
    ]) {
      localStorage.setItem(key, 'x');
    }
    localStorage.setItem('__app_mode__', 'real');
    localStorage.setItem('theme_mode', 'dark');

    clearSession();

    expect(Object.keys(localStorage).sort()).toEqual(['__app_mode__', 'theme_mode']);
  });
});
