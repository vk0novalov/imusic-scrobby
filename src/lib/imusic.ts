import applescript from 'applescript';

type MusicState = [string, string, string, string, string, number, number]

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

    applescript.execString<MusicState>(script, (err, result) => {
      if (err) return reject(err);
      if (!result) return reject(new Error('Failed to check Apple Music state'));

      resolve(result);
    });
  });
}

export { checkAppleMusicState }
