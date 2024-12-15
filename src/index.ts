import { authenticate } from './lib/lastfm.ts'
import { startScrobbling } from './scrobbler.ts';

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
  process.title = 'imusic-scrobby';

  startScrobbling(await getSessionKey())
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
