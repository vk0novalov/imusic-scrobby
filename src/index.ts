import { platform } from 'node:os';
import { authenticate } from './lib/lastfm.ts';
import { startScrobbling } from './scrobbler.ts';

const SESSION_KEY = 'sessionKey';

if (platform() !== 'darwin') {
  console.error('This app is only supported on macOS');
  process.exit(1);
}

const getSessionKey = async () => {
  let sessionKey = localStorage.getItem(SESSION_KEY) ?? null;
  if (!sessionKey) {
    sessionKey = await authenticate();
    localStorage.setItem(SESSION_KEY, sessionKey);
  }
  return sessionKey;
};

const main = async () => {
  process.title = 'imusic-scrobby';

  await startScrobbling(await getSessionKey());
};
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
