import { useEffect, useRef, useState } from 'react'
import type { SpotifyTrack, StorySection } from '../services/api'
import './ReaderPage.css'

type PlayerError = { message: string }
type PlayerReady = { device_id: string }

type SpotifyWebPlayer = {
  addListener(event: string, callback: (event: PlayerError | PlayerReady) => void): boolean
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  togglePlay(): Promise<void>
}

declare global {
  interface Window {
    Spotify?: { Player: new (options: Record<string, unknown>) => SpotifyWebPlayer }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

type ReaderPageProps = {
  sections: StorySection[]
  selectedTrackIds: Record<number, string>
  accessToken: string
  onExit: () => void
}

async function startSpotifyPlayback(accessToken: string, deviceId: string, track: SpotifyTrack) {
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [track.uri] }),
    },
  )

  if (!response.ok) {
    const details = await response.json().catch(() => ({}))
    if (response.status === 403) {
      throw new Error('Spotify browser playback requires an eligible Premium account.')
    }
    throw new Error(details.error?.message || 'Spotify could not start playback on this device.')
  }
}

export default function ReaderPage({ sections, selectedTrackIds, accessToken, onExit }: ReaderPageProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [deviceId, setDeviceId] = useState('')
  const [playerStatus, setPlayerStatus] = useState('Loading Spotify player...')
  const [playerError, setPlayerError] = useState('')
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const playerRef = useRef<SpotifyWebPlayer | null>(null)
  const activeSection = sections[activeIndex]
  const selectedTrack = activeSection?.tracks?.find((track) => track.id === selectedTrackIds[activeSection.id])
    ?? activeSection?.tracks?.[0]

  useEffect(() => {
    let disposed = false
    let player: SpotifyWebPlayer | null = null

    const initializePlayer = () => {
      if (disposed || !window.Spotify?.Player) return

      player = new window.Spotify.Player({
        name: 'Story Sound Reader',
        volume: 0.75,
        getOAuthToken: (callback: (token: string) => void) => callback(accessToken),
      })
      playerRef.current = player

      player.addListener('ready', (event) => {
        const readyEvent = event as PlayerReady
        setDeviceId(readyEvent.device_id)
        setPlayerStatus('Spotify player ready')
      })
      player.addListener('not_ready', () => {
        setDeviceId('')
        setPlayerStatus('Spotify player disconnected')
      })
      player.addListener('initialization_error', (event) => setPlayerError((event as PlayerError).message))
      player.addListener('authentication_error', (event) => setPlayerError((event as PlayerError).message))
      player.addListener('account_error', () => {
        setPlayerError('Browser playback requires Spotify Premium. You can still open each song in Spotify.')
      })
      player.addListener('playback_error', (event) => setPlayerError((event as PlayerError).message))
      void player.connect()
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://sdk.scdn.co/spotify-player.js"]')
    window.onSpotifyWebPlaybackSDKReady = initializePlayer

    if (window.Spotify?.Player) {
      initializePlayer()
    } else if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      script.onerror = () => setPlayerError('Could not load the Spotify player. Open songs in Spotify instead.')
      document.body.append(script)
    }

    return () => {
      disposed = true
      player?.disconnect()
      playerRef.current = null
      window.onSpotifyWebPlaybackSDKReady = undefined
    }
  }, [accessToken])

  useEffect(() => {
    if (!hasStartedPlayback || !deviceId || !selectedTrack) return

    void startSpotifyPlayback(accessToken, deviceId, selectedTrack)
      .then(() => setIsPaused(false))
      .catch((error: unknown) => {
        setPlayerError(error instanceof Error ? error.message : 'Spotify could not start playback.')
      })
  }, [accessToken, activeIndex, deviceId, hasStartedPlayback, selectedTrack])

  async function handleStartPlayback() {
    if (!deviceId || !selectedTrack || !playerRef.current) return

    setPlayerError('')
    try {
      await playerRef.current.activateElement()
      setHasStartedPlayback(true)
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : 'Spotify could not start playback.')
    }
  }

  async function handleTogglePlayback() {
    if (!playerRef.current) return

    try {
      await playerRef.current.togglePlay()
      setIsPaused((paused) => !paused)
    } catch {
      setPlayerError('Spotify could not change playback.')
    }
  }

  function moveToSection(index: number) {
    setPlayerError('')
    setActiveIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="reader-page">
      <header className="reader-topbar">
        <button className="reader-back" type="button" onClick={onExit}>← Back to songs</button>
        <span className="reader-wordmark">STORY / SOUND</span>
      </header>

      <div className="reader-layout">
        <article className="reader-story">
          <p className="reader-kicker">STORY WITH SOUND</p>
          <div className="reader-progress" aria-label={`Section ${activeIndex + 1} of ${sections.length}`}>
            {sections.map((section, index) => (
              <span key={section.id} className={index <= activeIndex ? 'progress-segment is-active' : 'progress-segment'} />
            ))}
          </div>
          <p className="reader-section-count">PART {String(activeIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</p>
          <h1>{activeSection.title}</h1>
          <p className="reader-mood">{activeSection.mood}</p>
          <p className="reader-section-description">{activeSection.description}</p>
          <div className="reader-copy">{activeSection.text}</div>
          <nav className="reader-navigation" aria-label="Story sections">
            <button type="button" onClick={() => moveToSection(activeIndex - 1)} disabled={activeIndex === 0}>Previous part</button>
            {activeIndex < sections.length - 1 ? (
              <button className="reader-next" type="button" onClick={() => moveToSection(activeIndex + 1)}>Next part <span aria-hidden="true">→</span></button>
            ) : (
              <button className="reader-next" type="button" onClick={onExit}>Finish reading <span aria-hidden="true">✓</span></button>
            )}
          </nav>
        </article>

        <aside className="reader-music" aria-label="Music for this section">
          <p className="reader-kicker">NOW SOUNDTRACKING</p>
          {selectedTrack ? (
            <>
              {selectedTrack.imageUrl && <img className="reader-cover" src={selectedTrack.imageUrl} alt={`${selectedTrack.album} album artwork`} />}
              <p className="reader-track-name">{selectedTrack.name}</p>
              <p className="reader-track-artist">{selectedTrack.artists.join(', ')}</p>
              <p className="reader-track-mood">{activeSection.mood}</p>
              <div className="reader-player-controls">
                {!hasStartedPlayback ? (
                  <button className="reader-play-button" type="button" disabled={!deviceId} onClick={() => void handleStartPlayback()}>
                    {deviceId ? 'Start playback' : 'Connecting to Spotify...'}
                  </button>
                ) : (
                  <button className="reader-play-button" type="button" onClick={() => void handleTogglePlayback()}>
                    {isPaused ? 'Resume playback' : 'Pause playback'}
                  </button>
                )}
                <a href={selectedTrack.spotifyUrl} target="_blank" rel="noreferrer">Open in Spotify</a>
              </div>
              <p className="reader-player-status" aria-live="polite">{playerError || playerStatus}</p>
            </>
          ) : (
            <p className="reader-player-status">No matching track was found for this part. Return to song recommendations to choose another.</p>
          )}
          <p className="reader-advance-note">Your selected soundtrack changes when you move to the next part.</p>
        </aside>
      </div>
    </main>
  )
}
