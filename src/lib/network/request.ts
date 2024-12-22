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
      res.on('aborted', () => {
        reject(new Error('Response was aborted.'));
      });

      res.on('error', (err) => {
        reject(err);
      });

      res.on('close', () => {
        if (!res.complete) {
          reject(new Error('Response was closed before fully completing.'));
        }
      });

      const { statusCode } = res;
      if (statusCode && statusCode > 299) {
        reject(new Error(`Request failed with status code ${res.statusCode}`));
      }

      let data = '';
      res.setEncoding('utf8');
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
