import { platform } from 'node:os';
import logger from './lib/logger.ts';
import { localStorage } from './lib/storage.ts';
import { startScrobbling } from './scrobbler.ts';
import { authenticate } from './services/lastfm.ts';

const SESSION_KEY = 'sessionKey';

if (platform() !== 'darwin') {
  logger.error('This app is only supported on macOS');
  process.exit(1);
}

if (localStorage === undefined) {
  logger.error('localStorage is not available, maybe you need add --experimental-webstorage flag');
  process.exit(1);
}

const getSessionKey = async () => {
  let sessionKey = localStorage.getItem(SESSION_KEY) ?? null;
  if (!sessionKey) {
    if (!process.stdin.isTTY) {
      logger.error('You must run this app in a terminal to get the session key from Last.fm');
      process.exit(1);
    }
    sessionKey = await authenticate();
    localStorage.setItem(SESSION_KEY, sessionKey);
  }
  return sessionKey;
};

const main = async () => {
  process.title = 'imusic-scrobby';

  await startScrobbling(process.env.SESSION_KEY ?? (await getSessionKey()), {
    launchRetryQueue: true,
  });
};

main().catch((err) => {
  logger.error(`Failed to start scrobbling: ${err}`);
  process.exit(1);
});
