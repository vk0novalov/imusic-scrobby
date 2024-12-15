import type http from 'node:http';
import https from 'node:https';

const defaultOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
};

export const request = <T>(
  url: string,
  params?: URLSearchParams,
  options: https.RequestOptions = defaultOptions,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const handler = async (res: http.IncomingMessage) => {
      let data = '';
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

    req.on('error', (err) => {
      reject(err);
    });

    if (params) {
      req.write(params.toString());
    }
    req.end();
  });
};
