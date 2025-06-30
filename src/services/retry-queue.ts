import { setTimeout as sleep } from 'node:timers/promises';
import { loadQueueFromStore, saveQueueToStore } from '../lib/queue.ts';
import type { TrackInfo } from '../types.ts';
import { scrobbleTrack } from './lastfm.ts';

let queue: TrackInfo[] | null;

const addToRetryQueue = async (trackInfo: TrackInfo) => {
  queue ??= await loadQueueFromStore();
  if (!queue) throw new Error('Failed to load queue');
  trackInfo.id = String(Date.now());
  queue.push(trackInfo);
  await saveQueueToStore(queue);
};

const scrobbleFromRetryQueue = async (sessionKey: string, scrobbleDelay: number = 1000) => {
  queue ??= await loadQueueFromStore();
  if (!queue) throw new Error('Failed to load queue');
  if (queue.length === 0) return;

  const scrobbledTracks = new Set();
  for (const trackInfo of queue) {
    try {
      if (await scrobbleTrack(sessionKey, trackInfo)) {
        scrobbledTracks.add(trackInfo.id);
      }
      await sleep(scrobbleDelay);
    } catch {
      // Ignore errors, just try the next track
    }
  }
  queue = queue.filter((trackInfo: TrackInfo) => !scrobbledTracks.has(trackInfo.id));
  await saveQueueToStore(queue);
};

export { addToRetryQueue, scrobbleFromRetryQueue };
