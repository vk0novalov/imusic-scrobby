import { authenticate } from './lib/lastfm.ts'
import { startScrobbling } from './scrobbler.ts';

process.title = "imusic-scrobby";

const SESSION_KEY = 'sessionKey'

const getSessionKey = async () => {
  let sessionKey = localStorage.getItem(SESSION_KEY) ?? null
  if (!sessionKey) {
    sessionKey = await authenticate()
    localStorage.setItem(SESSION_KEY, sessionKey)
  }
  return sessionKey
}

const main = async () => {
  startScrobbling(await getSessionKey())
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
