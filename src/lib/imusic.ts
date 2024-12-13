import applescript from "applescript";

import type { MusicState } from './types.ts';

function checkAppleMusicState(): Promise<MusicState> {
  return new Promise((resolve, reject) => {
    const script = `
          on is_running(appName)
            tell application "System Events" to (name of processes) contains appName
          end is_running

          if is_running("Music") then
            tell application "Music"
              if player state is playing then
                set trackName to name of current track
                set artistName to artist of current track
                set albumName to album of current track
                set trackDuration to duration of current track
                set trackPosition to player position
                return {true, true, trackName, artistName, albumName, trackDuration, trackPosition}
              else
                return {true, false, "", "", "", 0, 0}
              end if
            end tell
          else
            return {false, false, "", "", "", 0, 0}
          end if
        `;

    applescript.execString(script, (err: Error | null, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result as MusicState);
      }
    });
  });
}

export { checkAppleMusicState }