import crypto from "node:crypto";
import type http from "node:http";
import https from "node:https";
import readline from "node:readline";
import type { TrackInfo } from "./types.ts";

if (!process.env.API_KEY || !process.env.API_SECRET) {
  console.error("API_KEY and API_SECRET environment variables are required");
  process.exit(1);
}

const API_KEY: string = process.env.API_KEY;
const API_SECRET: string = process.env.API_SECRET;
const API_URL = "https://ws.audioscrobbler.com/2.0/";

const defaultOptions = {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
};

type ScrobbleResponse = {
  scrobbles: {
    "@attr": {
      accepted: number;
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

const request = <T>(
  url: string,
  params?: URLSearchParams,
  options: https.RequestOptions = defaultOptions,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const handler = async (res: http.IncomingMessage) => {
      let data = "";
      for await (const chunk of res) {
        data += chunk;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    };
    const req = options
      ? https.request(url, options, handler)
      : https.get(url, handler);

    req.on("error", (err) => {
      reject(err);
    });

    if (params) {
      req.write(params.toString());
    }
    req.end();
  });
};

async function scrobbleTrack(
  sessionKey: string,
  { artist, track, album, startTime }: TrackInfo,
) {
  const method = "track.scrobble";
  const params = new URLSearchParams({
    method: method,
    api_key: API_KEY,
    sk: sessionKey,
    artist: artist,
    track: track,
    album: album,
    timestamp: String(Math.floor((startTime ?? Date.now()) / 1000)),
    format: "json",
  });

  // Create API signature
  let signatureBase = "";
  params.sort();
  params.forEach((value, key) => {
    if (key !== "format") {
      signatureBase += key + value;
    }
  });
  signatureBase += API_SECRET;
  const api_sig = crypto.createHash("md5").update(signatureBase).digest("hex");
  params.append("api_sig", api_sig);

  const response: ScrobbleResponse = await request(API_URL, params);
  return response.scrobbles?.["@attr"]?.accepted === 1;
}

async function updateNowPlaying(
  sessionKey: string,
  { artist, track, album }: TrackInfo,
) {
  const method = "track.updateNowPlaying";
  const params = new URLSearchParams({
    method: method,
    api_key: API_KEY,
    sk: sessionKey,
    artist: artist,
    track: track,
    album: album,
    format: "json",
  });

  // Create API signature
  let signatureBase = "";
  params.sort();
  params.forEach((value, key) => {
    if (key !== "format") {
      signatureBase += key + value;
    }
  });
  signatureBase += API_SECRET;
  const api_sig = crypto
    .createHash("md5")
    .update(signatureBase)
    .digest("hex");
  params.append("api_sig", api_sig);

  const response = await request<UpdateNowPlayingResponse>(
    API_URL,
    params,
  );
  return !!response.nowplaying;
}

async function getAuthToken(): Promise<string> {
  const params = new URLSearchParams({
    method: "auth.gettoken",
    api_key: API_KEY,
    format: "json",
  });

  const url = `${API_URL}?${params}`;

  const response: TokenResponse = await request(url)
  return response.token;
}

async function getSessionKey(token: string): Promise<string> {
  const method = "auth.getSession";
  const sig = crypto
    .createHash("md5")
    .update(`api_key${API_KEY}method${method}token${token}${API_SECRET}`)
    .digest("hex");

  const params = new URLSearchParams({
    method: method,
    api_key: API_KEY,
    token: token,
    api_sig: sig,
    format: "json",
  });

  const response = await request<GetSessionKeyResponse>(
    API_URL,
    params,
  );
  if (!response?.session?.key) throw new Error("Failed to get session key");
  return response.session.key;
}

async function authenticate(): Promise<string> {
  try {
    const token = await getAuthToken();
    console.log("Please visit this URL to authorize the application:");
    console.log(
      `http://www.last.fm/api/auth/?api_key=${API_KEY}&token=${token}`,
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      rl.question(
        "Press Enter after you have authorized the application...",
        () => {
          rl.close();
          resolve();
        },
      );
    });

    const sessionKey = await getSessionKey(token);
    console.log(
      `Authentication successful! Your session key is: ${sessionKey}`,
    );
    return sessionKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Authentication failed:", error.message);
    } else {
      console.error("An unexpected error occurred.");
    }
    throw error;
  }
}

export { scrobbleTrack, updateNowPlaying, authenticate };
