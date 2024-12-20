import crypto from 'node:crypto';
import readline from 'node:readline';
import { request } from './network/request.ts';
import type { TrackInfo } from './types.ts';

// TODO: move to config and validate on startup
if (!process.env.API_KEY || !process.env.API_SECRET) {
  console.error('API_KEY and API_SECRET environment variables are required');
  process.exit(1);
}

const API_KEY: string = process.env.API_KEY;
const API_SECRET: string = process.env.API_SECRET;
const API_URL = 'https://ws.audioscrobbler.com/2.0/';

type ScrobbleResponse = {
  scrobbles?: {
    '@attr'?: {
      accepted?: number;
    };
  };
};

type UpdateNowPlayingResponse = {
  nowplaying: string;
};

type GetSessionKeyResponse = {
  session: {
    key: string;
  };
};

type TokenResponse = {
  token: string;
};

const buildSearchParams = (method: string, data?: Partial<TrackInfo> & { token?: string; sk?: string }) => {
  const params = new URLSearchParams({
    method,
    format: 'json',
    api_key: API_KEY,
  });

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      params.append(key, String(value));
    }
  }

  // Create API signature
  let signatureBase = '';
  params.sort();
  params.forEach((value, key) => {
    if (key !== 'format') {
      signatureBase += key + value;
    }
  });
  signatureBase += API_SECRET;
  const api_sig = crypto.createHash('md5').update(signatureBase).digest('hex');
  params.append('api_sig', api_sig);

  return params;
};

async function scrobbleTrack(sessionKey: string, { artist, track, album, startTime }: TrackInfo) {
  const params = buildSearchParams('track.scrobble', {
    artist,
    track,
    album,
    startTime: Math.floor(startTime ?? Date.now() / 1000),
    sk: sessionKey,
  });
  const response: ScrobbleResponse = await request(API_URL, params);
  return response.scrobbles?.['@attr']?.accepted === 1;
}

async function updateNowPlaying(sessionKey: string, { artist, track, album }: TrackInfo) {
  const response = await request<UpdateNowPlayingResponse>(
    API_URL,
    buildSearchParams('track.updateNowPlaying', { artist, track, album, sk: sessionKey }),
  );
  return !!response.nowplaying;
}

async function getAuthToken(): Promise<string> {
  const params = new URLSearchParams({
    method: 'auth.gettoken',
    api_key: API_KEY,
    format: 'json',
  });

  const url = `${API_URL}?${params}`;

  const response: TokenResponse = await request(url);
  return response.token;
}

async function getSessionKey(token: string): Promise<string> {
  const response = await request<GetSessionKeyResponse>(API_URL, buildSearchParams('auth.getSession', { token }));
  if (!response?.session?.key) throw new Error('Failed to get session key');
  return response.session.key;
}

async function authenticate(): Promise<string> {
  try {
    const token = await getAuthToken();
    console.log('Please visit this URL to authorize the application:');
    console.log(`http://www.last.fm/api/auth/?api_key=${API_KEY}&token=${token}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      rl.question('Press Enter after you have authorized the application...', () => {
        rl.close();
        resolve();
      });
    });

    const sessionKey = await getSessionKey(token);
    console.log(`Authentication successful! Your session key is: ${sessionKey}`);
    return sessionKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Authentication failed:', error.message);
    } else {
      console.error('An unexpected error occurred.');
    }
    throw error;
  }
}

export { scrobbleTrack, updateNowPlaying, authenticate };
