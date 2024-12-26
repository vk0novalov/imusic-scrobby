import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import type { TrackInfo } from '../types.ts';
import { scrobbleTrack } from './lastfm.ts';

const QUEUE_FILE = '.retry-queue.tmp';

let queue: TrackInfo[] | null;

const loadQueueFromStore = async () => {
  try {
    const queue = await readFile(QUEUE_FILE, 'utf8');
    return JSON.parse(queue);
  } catch {
    return [];
  }
};

const saveQueueToStore = async () => {
  await writeFile(QUEUE_FILE, JSON.stringify(queue), 'utf8');
};

const addToRetryQueue = async (trackInfo: TrackInfo) => {
  queue ??= await loadQueueFromStore();
  if (!queue) throw new Error('Failed to load queue');
  trackInfo.id = String(Date.now());
  queue.push(trackInfo);
  await saveQueueToStore();
};

const scrobbleRetryQueue = async (sessionKey: string) => {
  queue ??= await loadQueueFromStore();
  if (!queue) throw new Error('Failed to load queue');
  if (queue.length === 0) return;

  const scrobbledTracks = new Set();
  for (const trackInfo of queue) {
    try {
      if (await scrobbleTrack(sessionKey, trackInfo)) {
        scrobbledTracks.add(trackInfo.id);
      }
      await sleep(1000);
    } catch {
      // Ignore errors, just try the next track
    }
  }
  queue = queue.filter((trackInfo: TrackInfo) => !scrobbledTracks.has(trackInfo.id));
  await saveQueueToStore();
};

export { addToRetryQueue, scrobbleRetryQueue };