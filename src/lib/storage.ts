import logger from './logger.ts';

let storageImpl = globalThis.localStorage;

if (!storageImpl && globalThis.process?.versions?.bun) {
  try {
    const { createLocalStorage } = await import('bun-storage');
    storageImpl = createLocalStorage('.localStorage-bun');
  } catch (error) {
    logger.error('Failed to initialize localStorage for Bun environment:', error);
    process.exit(1);
  }
}

export const localStorage = storageImpl;
