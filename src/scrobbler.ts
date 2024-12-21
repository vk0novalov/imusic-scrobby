import { setTimeout as sleep } from 'node:timers/promises';
import { checkAppleMusicState } from './lib/imusic.ts';
import { scrobbleTrack, updateNowPlaying } from './lib/lastfm.ts';
import type { TrackInfo } from './lib/types.ts';

const DEFAULT_SLEEP_MS = 10000;
const APPLE_MUSIC_OFF_SLEEP_MS = 30000;

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

async function pollMusic(sessionKey: string) {
  const [isRunning, isPlaying, track, artist, album, duration, position] = await checkAppleMusicState();

  if (isRunning === 'false') {
    if (nowPlayingTrack) {
      await scrobbleTrack(sessionKey, nowPlayingTrack).catch(console.error);
    }
    nowPlayingTrack = null;
    return false;
  }

  if (isPlaying === 'false') {
    nowPlayingTrack = null;
    return false;
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
    // console.log(`Now playing: ${artist} - ${track}`);
  }

  if (checkForRewind(lastScrobbledTrack, nowPlayingTrack, position)) {
    // looks like rewind - so it's new scrobbling
    lastScrobbledTrack = null;
    nowPlayingTrack.startTime = getStartTime(position);
    await updateNowPlaying(sessionKey, nowPlayingTrack).catch(console.error);
  }

  // Scrobble the track if it's a new track and has played for at least half its duration or 4 minutes
  if (hasTrackChanged(lastScrobbledTrack, track, artist) && isEnoughTimeElapsed(position, duration)) {
    // TODO: retry to scrobble on error
    await scrobbleTrack(sessionKey, nowPlayingTrack).catch(console.error);
    // console.log(`Scrobbled: ${artist} - ${track}`);
    lastScrobbledTrack = { track, artist, position, album };
  }
  return true;
}

async function startScrobbling(sessionKey: string) {
  console.log('Starting scrobbling...');

  let isRunning = true;

  const poll = async () => {
    while (isRunning) {
      const isRunning = await pollMusic(sessionKey);
      await sleep(isRunning ? DEFAULT_SLEEP_MS : APPLE_MUSIC_OFF_SLEEP_MS);
    }
  };
  process.nextTick(poll);

  return () => {
    if (!isRunning) return;
    console.log('Stopping scrobbling...');
    isRunning = false;
  };
}

export { startScrobbling };
