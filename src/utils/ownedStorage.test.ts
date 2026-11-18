import { currentOwner, readOwned, removeOwned, writeOwned } from './ownedStorage';

const KEY = 'infraweave.test.v1';

const tokenFor = (sub: string, iss = 'https://idp.example.test') =>
  `header.${btoa(JSON.stringify({ sub, iss })).replace(/=+$/, '')}.signature`;

const signInAs = (sub: string, iss?: string) =>
  localStorage.setItem('auth_token', tokenFor(sub, iss));

describe('ownedStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('names the owner by issuer and subject', () => {
    signInAs('alice');
    expect(currentOwner()).toBe('https://idp.example.test|alice');
  });

  it('reads back what the same user wrote', () => {
    signInAs('alice');
    writeOwned(KEY, { layout: ['a'] });

    expect(readOwned(KEY)).toEqual({ layout: ['a'] });
  });

  it('never hands one user’s value to the next', () => {
    signInAs('alice');
    writeOwned(KEY, 'alice’s');

    signInAs('bob');
    expect(readOwned(KEY)).toBeUndefined();

    signInAs('alice', 'https://other-idp.example.test');
    expect(readOwned(KEY)).toBeUndefined();
  });

  it('stores nothing without a known owner', () => {
    writeOwned(KEY, 'anyone’s');
    expect(localStorage.getItem(KEY)).toBeNull();

    localStorage.setItem('auth_token', `header.${btoa(JSON.stringify({ sub: 'x' }))}.sig`);
    writeOwned(KEY, 'no issuer');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores a value stored without an owner', () => {
    signInAs('alice');
    localStorage.setItem(KEY, JSON.stringify(['legacy']));

    expect(readOwned(KEY)).toBeUndefined();
  });

  it('removes the value', () => {
    signInAs('alice');
    writeOwned(KEY, 1);
    removeOwned(KEY);

    expect(readOwned(KEY)).toBeUndefined();
  });
});
