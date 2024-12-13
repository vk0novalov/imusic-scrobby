import https from 'node:https';
import crypto from 'node:crypto';
import readline from 'node:readline';
import type { TrackInfo } from './types.ts';

const API_KEY: string = process.env.API_KEY!;
const API_SECRET: string = process.env.API_SECRET!;
const API_URL = 'https://ws.audioscrobbler.com/2.0/';

function scrobbleTrack(sessionKey: string, { artist, track, album, startTime }: TrackInfo) {
  return new Promise((resolve, reject) => {
    const method = 'track.scrobble';
    const params = new URLSearchParams({
      method: method,
      api_key: API_KEY,
      sk: sessionKey,
      artist: artist!,
      track: track!,
      album: album!,
      timestamp: String(Math.floor((startTime ?? Date.now()) / 1000)),
      format: 'json'
    });

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

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const response = JSON.parse(data);
        if (response.scrobbles?.['@attr']?.accepted === 1) {
          resolve('Track scrobbled successfully');
        } else {
          reject(new Error('Failed to scrobble track'));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(params.toString());
    req.end();
  });
}

function updateNowPlaying(sessionKey: string, { artist, track, album }: TrackInfo) {
  return new Promise((resolve, reject) => {
    const method = 'track.updateNowPlaying';
    const params = new URLSearchParams({
      method: method,
      api_key: API_KEY,
      sk: sessionKey,
      artist: artist!,
      track: track!,
      album: album!,
      format: 'json'
    });

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

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(API_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const response = JSON.parse(data);
        if (response.nowplaying) {
          resolve('Now playing updated successfully');
        } else {
          reject(new Error('Failed to update now playing'));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(params.toString());
    req.end();
  });
}

function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      method: 'auth.gettoken',
      api_key: API_KEY,
      format: 'json'
    });

    const url = `${API_URL}?${params}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const response = JSON.parse(data);
        if (response.token) {
          resolve(response.token);
        } else {
          reject(new Error('Failed to get auth token'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function getSessionKey(token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const method = 'auth.getSession';
    const sig = crypto.createHash('md5').update(`api_key${API_KEY}method${method}token${token}${API_SECRET}`).digest('hex');

    const params = new URLSearchParams({
      method: method,
      api_key: API_KEY,
      token: token,
      api_sig: sig,
      format: 'json'
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(`${API_URL}`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const response = JSON.parse(data);
        if (response.session?.key) {
          resolve(response.session.key);
        } else {
          reject(new Error('Failed to get session key'));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(params.toString());
    req.end();
  });
}

async function authenticate(): Promise<string> {
  try {
    const token = await getAuthToken();
    console.log('Please visit this URL to authorize the application:');
    console.log(`http://www.last.fm/api/auth/?api_key=${API_KEY}&token=${token}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
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

export { scrobbleTrack, updateNowPlaying, authenticate }
