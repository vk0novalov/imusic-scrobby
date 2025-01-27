import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

let importIndex = 0;
const importWithoutCache = (path: string) => import(`${path}?no-cache=${importIndex++}`);

mock.module('is-online', {
  defaultExport: () => Promise.resolve(true),
});

describe('startScrobbling', () => {
  it('should return a function', async () => {
    const { startScrobbling } = await importWithoutCache('../src/scrobbler.ts');

    const stop = await startScrobbling('sessionKey');
    assert.strictEqual(typeof stop, 'function');
    stop();
  });

  it('should scrobble tracks', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

    const position = 60;
    const timeToSkipMs = 100000;

    const fakeTrack = {
      track: 'track',
      artist: 'artist',
      album: 'album',
    };

    const musicStateMockFn = mock.fn(() => ['true', 'true', ...Object.values(fakeTrack), 100, position]);
    const scrobbleTrackMockFn = mock.fn(() => Promise.resolve(true));
    const updateNowPlayingMockFn = mock.fn(() => Promise.resolve(true));

    const mockMusicModule = t.mock.module('../src/services/imusic.ts', {
      namedExports: {
        checkAppleMusicState: musicStateMockFn,
      },
    });
    const mockLastfmModule = t.mock.module('../src/services/lastfm.ts', {
      namedExports: {
        scrobbleTrack: scrobbleTrackMockFn,
        updateNowPlaying: updateNowPlayingMockFn,
      },
    });

    const { startScrobbling } = await importWithoutCache('../src/scrobbler.ts');

    t.mock.timers.tick(timeToSkipMs + position * 1000);

    const stop = await startScrobbling('sessionKey');
    await new Promise((resolve) => setImmediate(resolve));
    stop();

    mockMusicModule.restore();
    mockLastfmModule.restore();

    assert.strictEqual(musicStateMockFn.mock.callCount(), 1);
    assert.strictEqual(scrobbleTrackMockFn.mock.callCount(), 1);
    assert.strictEqual(updateNowPlayingMockFn.mock.callCount(), 1);

    assert.deepEqual(scrobbleTrackMockFn.mock.calls[0].arguments, [
      'sessionKey',
      { ...fakeTrack, startTime: timeToSkipMs },
    ]);
    assert.deepEqual(updateNowPlayingMockFn.mock.calls[0].arguments, [
      'sessionKey',
      { ...fakeTrack, startTime: timeToSkipMs },
    ]);
  });

  it('should not scrobble tracks if not enough time has elapsed', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

    const position = 30;
    const timeToSkipMs = 100000;

    const fakeTrack = {
      track: 'track',
      artist: 'artist',
      album: 'album',
    };

    const musicStateMockFn = mock.fn(() => ['true', 'true', ...Object.values(fakeTrack), 100, position]);
    const scrobbleTrackMockFn = mock.fn(() => Promise.resolve(true));
    const updateNowPlayingMockFn = mock.fn(() => Promise.resolve(true));

    const mockMusicModule = t.mock.module('../src/services/imusic.ts', {
      namedExports: {
        checkAppleMusicState: musicStateMockFn,
      },
    });
    const mockLastfmModule = t.mock.module('../src/services/lastfm.ts', {
      namedExports: {
        scrobbleTrack: scrobbleTrackMockFn,
        updateNowPlaying: updateNowPlayingMockFn,
      },
    });

    const { startScrobbling } = await importWithoutCache('../src/scrobbler.ts');

    t.mock.timers.tick(timeToSkipMs + position * 1000);

    const stop = await startScrobbling('sessionKey');
    await new Promise((resolve) => setImmediate(resolve));
    stop();

    mockMusicModule.restore();
    mockLastfmModule.restore();

    assert.strictEqual(musicStateMockFn.mock.callCount(), 1);
    assert.strictEqual(scrobbleTrackMockFn.mock.callCount(), 0);
    assert.strictEqual(updateNowPlayingMockFn.mock.callCount(), 1);

    assert.deepEqual(updateNowPlayingMockFn.mock.calls[0].arguments, [
      'sessionKey',
      { ...fakeTrack, startTime: timeToSkipMs },
    ]);
  });

  it('should scrobble rewinded tracks', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

    const position = 60;
    const timeToSkipMs = 100000;

    const fakeTrack = {
      track: 'track',
      artist: 'artist',
      album: 'album',
    };

    const musicStateMockFn = mock.fn(() => ['true', 'true', ...Object.values(fakeTrack), 100, position]);
    const scrobbleTrackMockFn = mock.fn(() => Promise.resolve(true));
    const updateNowPlayingMockFn = mock.fn(() => Promise.resolve(true));

    const mockMusicModule = t.mock.module('../src/services/imusic.ts', {
      namedExports: {
        checkAppleMusicState: musicStateMockFn,
      },
    });
    const mockLastfmModule = t.mock.module('../src/services/lastfm.ts', {
      namedExports: {
        scrobbleTrack: scrobbleTrackMockFn,
        updateNowPlaying: updateNowPlayingMockFn,
      },
    });

    const { startScrobbling } = await importWithoutCache('../src/scrobbler.ts');

    t.mock.timers.tick(timeToSkipMs + position * 1000);

    const stop = await startScrobbling('sessionKey');
    await new Promise((resolve) => setImmediate(resolve));

    musicStateMockFn.mock.mockImplementation(() => ['true', 'true', ...Object.values(fakeTrack), 100, 10]);
    t.mock.timers.tick(11000);
    await new Promise((resolve) => setImmediate(resolve));

    await stop();

    mockMusicModule.restore();
    mockLastfmModule.restore();

    assert.strictEqual(musicStateMockFn.mock.callCount(), 2);
    assert.strictEqual(scrobbleTrackMockFn.mock.callCount(), 1);
    assert.strictEqual(updateNowPlayingMockFn.mock.callCount(), 2);

    assert.deepEqual(scrobbleTrackMockFn.mock.calls[0].arguments, ['sessionKey', { ...fakeTrack, startTime: 161000 }]);
    assert.deepEqual(updateNowPlayingMockFn.mock.calls[0].arguments, [
      'sessionKey',

      { ...fakeTrack, startTime: 161000 },
    ]);
    assert.deepEqual(updateNowPlayingMockFn.mock.calls[1].arguments, [
      'sessionKey',

      { ...fakeTrack, startTime: 161000 },
    ]);
  });
});
