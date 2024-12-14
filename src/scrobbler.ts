import { setTimeout as sleep } from 'node:timers/promises'
import { checkAppleMusicState } from './lib/imusic.ts'
import { scrobbleTrack, updateNowPlaying } from './lib/lastfm.ts'
import type { TrackInfo } from './lib/types.ts';

const DEFAULT_SLEEP_MS = 10000
const APPLE_MUSIC_OFF_SLEEP_MS = 30000

let lastScrobbledTrack: TrackInfo | null = null;
let nowPlayingTrack: TrackInfo | null = null;

function checkForRewind(lastScrobbledTrack: TrackInfo, nowPlayingTrack: TrackInfo, position: number) {
  if (!lastScrobbledTrack) return false
  if (lastScrobbledTrack.track !== nowPlayingTrack.track && lastScrobbledTrack.artist !== nowPlayingTrack.artist) return false
  return lastScrobbledTrack.position !== undefined && position < lastScrobbledTrack.position && position < DEFAULT_SLEEP_MS
}

async function pollMusic(sessionKey: string) {
  const [isRunning, isPlaying, track, artist, album, duration, position] = await checkAppleMusicState();

  if (isRunning === 'false') {
    if (nowPlayingTrack) {
      await scrobbleTrack(sessionKey, nowPlayingTrack).catch(console.error);
    }
    nowPlayingTrack = null
    return false
  }

  if (isPlaying === 'false') {
    nowPlayingTrack = null;
    return false
  }

  // Update Now Playing if the track has changed
  if (!nowPlayingTrack || nowPlayingTrack.track !== track || nowPlayingTrack.artist !== artist) {
    nowPlayingTrack = { track, artist, album, startTime: Date.now() - position * 1000 };
    await updateNowPlaying(sessionKey, nowPlayingTrack).catch(console.error);
    console.log(`Now playing: ${artist} - ${track}`);
  }

  if (lastScrobbledTrack && checkForRewind(lastScrobbledTrack, nowPlayingTrack, position)) {
    // looks like rewind - so it's new scrobbling
    lastScrobbledTrack = null
    nowPlayingTrack.startTime = Date.now() - position * 1000
    await updateNowPlaying(sessionKey, nowPlayingTrack).catch(console.error);
  }

  // Scrobble the track if it's a new track and has played for at least half its duration or 4 minutes
  if ((!lastScrobbledTrack || lastScrobbledTrack.track !== track || lastScrobbledTrack.artist !== artist) &&
    (position > Math.min(duration / 2, 4 * 60))) {
    // TODO: retry to scrobble on error
    await scrobbleTrack(sessionKey, nowPlayingTrack).catch(console.error);
    // console.log(`Scrobbled: ${artist} - ${track}`);
    lastScrobbledTrack = { track, artist, position };
  }
  return true
}

async function startScrobbling(sessionKey: string) {
  console.log('Starting scrobbling...');
  while (true) {
    const isRunning = await pollMusic(sessionKey)
    await sleep(isRunning ? DEFAULT_SLEEP_MS : APPLE_MUSIC_OFF_SLEEP_MS)
  }
}

export { startScrobbling }