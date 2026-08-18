import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Jede Testdatei rendert in dasselbe jsdom-Dokument – ohne Aufräumen würden
// sich Komponenten aus vorherigen Tests in Queries mischen.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
