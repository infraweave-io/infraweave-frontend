import '@testing-library/jest-dom';
import { Window } from 'happy-dom';

// Node 25+ defines its own `localStorage` and `sessionStorage` getters on globalThis. Without
// `--localstorage-file` they return undefined, and they win over the ones from happy-dom.
// Node 24, which .nvmrc pins, does not have this problem.
const storageWindow = new Window();
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[name]?.getItem !== 'function') {
    Object.defineProperty(globalThis, name, { value: storageWindow[name], configurable: true });
  }
}
