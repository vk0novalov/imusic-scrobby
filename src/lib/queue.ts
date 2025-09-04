import { readFile, writeFile } from 'node:fs/promises';
import type { TrackInfo } from '../types.ts';
import logger from './logger.ts';

const QUEUE_FILE = '.retry-queue.tmp';

export const loadQueueFromStore = async () => {
  try {
    const queue = await readFile(QUEUE_FILE, 'utf8');
    return JSON.parse(queue);
  } catch {
    return [];
  }
};

export const saveQueueToStore = async (queue: TrackInfo[]) => {
  await writeFile(QUEUE_FILE, JSON.stringify(queue), 'utf8').catch((err: Error) => {
    logger.warn(err, `Error with saving retry queue: ${err.message}`);
  });
};
