import { createRequire } from 'node:module';
// NOTE: weird workaround for testing and to enable the possibility of mocking timers for ESM
// https://nodejs.org/api/test.html#timers
// Destructuring functions such as import { setTimeout } from 'node:timers' is currently not supported by this API.
const require = createRequire(import.meta.url);
const { setTimeout: sleep } = require('node:timers/promises');

import { checkAppleMusicState } from './services/imusic.ts';
import { scrobbleTrack, updateNowPlaying } from './services/lastfm.ts';
import logger from './lib/logger.ts';
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
  logger.trace(`Scrobbled: ${trackInfo.artist} - ${trackInfo.track}`);
  await scrobbleTrack(sessionKey, trackInfo).catch(console.error);
};

async function pollMusic(sessionKey: string): Promise<MusicAppState> {
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
    await updateNowPlaying(sessionKey, nowPlayingTrack).catch(console.error);
  }

  if (checkForRewind(lastScrobbledTrack, nowPlayingTrack, position)) {
    // looks like rewind - so it's new scrobbling
    lastScrobbledTrack = null;
    nowPlayingTrack.startTime = getStartTime(position);
    await updateNowPlaying(sessionKey, nowPlayingTrack).catch(console.error);
  }

  // Scrobble the track if it's a new track and has played for at least half its duration or 4 minutes
  if (hasTrackChanged(lastScrobbledTrack, track, artist) && isEnoughTimeElapsed(position, duration)) {
    scrobble(sessionKey, nowPlayingTrack);
    lastScrobbledTrack = { track, artist, position, album };
  }
  return 'active';
}

async function startScrobbling(sessionKey: string) {
  logger.info('Starting scrobbling...');

  let isScrobbling = true;

  const poll = async () => {
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
