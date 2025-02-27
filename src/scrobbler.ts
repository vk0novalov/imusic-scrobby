import { createRequire } from 'node:module';
// NOTE: weird workaround for testing and to enable the possibility of mocking timers for ESM
// https://nodejs.org/api/test.html#timers
// Destructuring functions such as import { setTimeout } from 'node:timers' is currently not supported by this API.
const require = createRequire(import.meta.url);
const { setTimeout: sleep } = require('node:timers/promises');

import isOnline from 'is-online';
import logger from './lib/logger.ts';
import { checkAppleMusicState } from './services/imusic.ts';
import { scrobbleTrack, updateNowPlaying } from './services/lastfm.ts';
import { addToRetryQueue, scrobbleFromRetryQueue } from './services/retry-queue.ts';
import type { TrackInfo } from './types.ts';

const DEFAULT_SLEEP_MS = 10000;
const APPLE_MUSIC_OFF_SLEEP_MS = 30000;

const MusicAppState = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
} as const;
type MusicAppState = keyof typeof MusicAppState;

let lastScrobbledTrack: TrackInfo | null = null;
let nowPlayingTrack: TrackInfo | null = null;

const getStartTime = (position: number) => Date.now() - position * 1000;

const checkForNewTrack = (nowPlayingTrack: TrackInfo, track: string, artist: string) => {
  return nowPlayingTrack.track !== track || nowPlayingTrack.artist !== artist;
};

const checkForRewind = (lastScrobbledTrack: TrackInfo | null, nowPlayingTrack: TrackInfo, position: number) => {
  if (!lastScrobbledTrack) return false;

  if (lastScrobbledTrack.track !== nowPlayingTrack.track && lastScrobbledTrack.artist !== nowPlayingTrack.artist)
    return false;

  return (
    lastScrobbledTrack.position !== undefined && position < lastScrobbledTrack.position && position < DEFAULT_SLEEP_MS
  );
};

const hasTrackChanged = (lastScrobbledTrack: TrackInfo | null, track: string, artist: string) => {
  if (!lastScrobbledTrack) return true;
  return lastScrobbledTrack.track !== track || lastScrobbledTrack.artist !== artist;
};

const isEnoughTimeElapsed = (position: number, duration: number) => position > Math.min(duration / 2, 4 * 60);

const scrobble = async (sessionKey: string, trackInfo: TrackInfo) => {
  logger.trace(`Scrobble: ${trackInfo.artist} - ${trackInfo.track}`);
  if (!(await isOnline())) {
    return await addToRetryQueue(trackInfo);
  }
  try {
    await scrobbleTrack(sessionKey, trackInfo);
  } catch (err: unknown) {
    logger.warn(
      `Failed to scrobble: ${trackInfo.artist} - ${trackInfo.track}, error: ${err instanceof Error ? err.message : err}`,
    );
    await addToRetryQueue(trackInfo);
  }
};

const setNowPlaying = async (sessionKey: string, trackInfo: TrackInfo) => {
  logger.trace(`Now Playing: ${trackInfo.artist} - ${trackInfo.track}`);
  if (!(await isOnline())) return;
  await updateNowPlaying(sessionKey, trackInfo);
};

const pollMusic = async (sessionKey: string): Promise<MusicAppState> => {
  const [isRunning, isPlaying, track, artist, album, duration, position] = await checkAppleMusicState();

  if (!isRunning) {
    if (nowPlayingTrack) scrobble(sessionKey, nowPlayingTrack).catch(logger.error);
    nowPlayingTrack = null;
    return MusicAppState.INACTIVE;
  }

  if (!isPlaying) {
    nowPlayingTrack = null;
    return MusicAppState.INACTIVE;
  }

  // Update Now Playing if the track has changed
  if (!nowPlayingTrack || checkForNewTrack(nowPlayingTrack, track, artist)) {
    nowPlayingTrack = {
      track,
      artist,
      album,
      startTime: getStartTime(position),
    };
    setNowPlaying(sessionKey, nowPlayingTrack).catch(logger.error);
  }

  if (checkForRewind(lastScrobbledTrack, nowPlayingTrack, position)) {
    // looks like rewind - so it's new scrobbling
    lastScrobbledTrack = null;
    nowPlayingTrack.startTime = getStartTime(position);
    setNowPlaying(sessionKey, nowPlayingTrack).catch(logger.error);
  }

  // Scrobble the track if it's a new track and has played for at least half its duration or 4 minutes
  if (hasTrackChanged(lastScrobbledTrack, track, artist) && isEnoughTimeElapsed(position, duration)) {
    scrobble(sessionKey, nowPlayingTrack).catch(logger.error);
    lastScrobbledTrack = { track, artist, position, album };
  }
  return MusicAppState.ACTIVE;
};

const startscrobbleFromRetryQueueHandler = (sessionKey: string) => {
  const timeout = 60_000 * 10; // 10 minutes
  scrobbleFromRetryQueue(sessionKey)
    .catch(logger.error)
    .finally(() => setTimeout(startscrobbleFromRetryQueueHandler, timeout, sessionKey).unref());
};

async function startScrobbling(sessionKey: string, { launchRetryQueue = false } = {}) {
  logger.info('Starting scrobbling...');

  let isScrobbling = true;

  const poll = async () => {
    if (launchRetryQueue) {
      logger.info('Launching retry queue...');
      startscrobbleFromRetryQueueHandler(sessionKey);
    }

    while (isScrobbling) {
      const musicAppState = await pollMusic(sessionKey).catch((err) => {
        logger.error(`Failed to poll music state: ${err}`);
        return MusicAppState.INACTIVE;
      });
      await sleep(musicAppState === MusicAppState.ACTIVE ? DEFAULT_SLEEP_MS : APPLE_MUSIC_OFF_SLEEP_MS);
    }
  };
  process.nextTick(poll);

  return () => {
    if (!isScrobbling) return;
    logger.info('Stopping scrobbling...');
    isScrobbling = false;
  };
}

export { startScrobbling };
