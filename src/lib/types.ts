type NullableString = string | null

type TrackInfo = {
  track: NullableString,
  artist: NullableString,
  album?: NullableString,
  startTime?: number,
  position?: number,
}

type MusicState = [string, string, string, string, string, number, number, null]

export type { TrackInfo, MusicState, NullableString }