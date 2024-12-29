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
import { addToRetryQueue, scrobbleRetryQueue } from './services/retry-queue.ts';
import type { TrackInfo } from './types.ts';

const DEFAULT_SLEEP_MS = 10000;
const APPLE_MUSIC_OFF_SLEEP_MS = 30000;

type MusicAppState = 'inactive' | 'active';

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
    addToRetryQueue(trackInfo).catch(logger.error);
    return;
  }
  scrobbleTrack(sessionKey, trackInfo).catch((err: Error) => {
    logger.warn(`Failed to scrobble: ${trackInfo.artist} - ${trackInfo.track}, error: ${err.message}`);
    addToRetryQueue(trackInfo).catch(logger.error);
  });
};

const setNowPlaying = async (sessionKey: string, trackInfo: TrackInfo) => {
  logger.trace(`Now Playing: ${trackInfo.artist} - ${trackInfo.track}`);
  if (!(await isOnline())) return;
  updateNowPlaying(sessionKey, trackInfo).catch(logger.error);
};

const pollMusic = async (sessionKey: string): Promise<MusicAppState> => {
  const [isRunning, isPlaying, track, artist, album, duration, position] = await checkAppleMusicState();

  if (!isRunning) {
    if (nowPlayingTrack) scrobble(sessionKey, nowPlayingTrack);
    nowPlayingTrack = null;
    return 'inactive';
  }

  if (!isPlaying) {
    nowPlayingTrack = null;
    return 'inactive';
  }

  // Update Now Playing if the track has changed
  if (!nowPlayingTrack || checkForNewTrack(nowPlayingTrack, track, artist)) {
    nowPlayingTrack = {
      track,
      artist,
      album,
      startTime: getStartTime(position),
    };
    setNowPlaying(sessionKey, nowPlayingTrack);
  }

  if (checkForRewind(lastScrobbledTrack, nowPlayingTrack, position)) {
    // looks like rewind - so it's new scrobbling
    lastScrobbledTrack = null;
    nowPlayingTrack.startTime = getStartTime(position);
    setNowPlaying(sessionKey, nowPlayingTrack);
  }

  // Scrobble the track if it's a new track and has played for at least half its duration or 4 minutes
  if (hasTrackChanged(lastScrobbledTrack, track, artist) && isEnoughTimeElapsed(position, duration)) {
    scrobble(sessionKey, nowPlayingTrack);
    lastScrobbledTrack = { track, artist, position, album };
  }
  return 'active';
};

const startScrobbleRetryQueueHandler = (sessionKey: string) => {
  const timeout = 60_000 * 10; // 10 minutes
  scrobbleRetryQueue(sessionKey)
    .catch(logger.error)
    .finally(() => setTimeout(startScrobbleRetryQueueHandler, timeout, sessionKey).unref());
};

async function startScrobbling(sessionKey: string, { launchRetryQueue = false } = {}) {
  logger.info('Starting scrobbling...');

  let isScrobbling = true;

  const poll = async () => {
    if (launchRetryQueue) {
      logger.info('Launching retry queue...');
      startScrobbleRetryQueueHandler(sessionKey);
    }

    while (isScrobbling) {
      const musicAppState = await pollMusic(sessionKey);
      await sleep(musicAppState === 'active' ? DEFAULT_SLEEP_MS : APPLE_MUSIC_OFF_SLEEP_MS);
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
