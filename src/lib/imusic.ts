import { promisify } from 'node:util';
import applescript from 'applescript';

type MusicState = [boolean, boolean, string, string, string, number, number];

const execString = promisify(applescript.execString);

const checkStateScript = `
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

async function checkAppleMusicState(): Promise<MusicState> {
  const result = await execString<MusicState>(checkStateScript);
  if (!result) throw new Error('Failed to check Apple Music state');
  // Convert booleans to actual booleans, it's a hack for AppleScript
  result[0] = String(result[0]) === 'true';
  result[1] = String(result[1]) === 'true';
  return result;
}

export { checkAppleMusicState };
