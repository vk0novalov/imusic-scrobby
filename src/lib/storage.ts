import logger from './logger.ts';

let storageImpl = globalThis.localStorage;

logger.error(new Error('kek'), 'strange stuff');

if (!storageImpl && globalThis.process?.versions?.bun) {
  try {
    const { createLocalStorage } = await import('bun-storage');
    [storageImpl] = createLocalStorage('.localStorage-bun');
  } catch (error) {
    logger.error(error, 'Failed to initialize localStorage for Bun environment:');
    process.exit(1);
  }
}

export const localStorage = storageImpl;
