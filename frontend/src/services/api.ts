const spotifyClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim()
const spotifyRedirectUri =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || `${window.location.origin}/`
const tokenStorageKey = 'spotify-token'
const verifierStorageKey = 'spotify-code-verifier'
const stateStorageKey = 'spotify-auth-state'

type SpotifyTokenResponse = {
  access_token: string
  expires_in: number
}

type StoredSpotifyToken = {
  accessToken: string
  expiresAt: number
}

function encodeBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function createRandomString(byteLength: number) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return encodeBase64Url(new Uint8Array(digest))
}

function requireClientId() {
  if (!spotifyClientId) {
    throw new Error('Add VITE_SPOTIFY_CLIENT_ID to frontend/.env and restart Vite.')
  }

  return spotifyClientId
}

export async function loginWithSpotify() {
  const verifier = createRandomString(64)
  const state = createRandomString(32)
  const challenge = await createCodeChallenge(verifier)

  sessionStorage.setItem(verifierStorageKey, verifier)
  sessionStorage.setItem(stateStorageKey, state)

  const params = new URLSearchParams({
    client_id: requireClientId(),
    response_type: 'code',
    redirect_uri: spotifyRedirectUri,
    scope: 'user-read-private streaming user-read-playback-state user-modify-playback-state',
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })

  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`)
}

export async function completeSpotifyLogin() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const authError = url.searchParams.get('error')

  if (!code && !authError) return null

  window.history.replaceState({}, document.title, `${url.pathname}${url.hash}`)

  if (authError) {
    throw new Error(`Spotify authorization failed: ${authError}`)
  }

  if (!code) {
    throw new Error('Spotify did not return an authorization code.')
  }

  const expectedState = sessionStorage.getItem(stateStorageKey)
  const verifier = sessionStorage.getItem(verifierStorageKey)
  sessionStorage.removeItem(stateStorageKey)
  sessionStorage.removeItem(verifierStorageKey)

  if (!returnedState || returnedState !== expectedState || !verifier) {
    throw new Error('Spotify sign-in could not be verified. Please try again.')
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireClientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyRedirectUri,
      code_verifier: verifier,
    }),
  })

  const tokenData = (await response.json()) as SpotifyTokenResponse & {
    error_description?: string
  }

  if (!response.ok) {
    throw new Error(tokenData.error_description || 'Spotify did not accept the sign-in code.')
  }

  const storedToken: StoredSpotifyToken = {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  }
  sessionStorage.setItem(tokenStorageKey, JSON.stringify(storedToken))
  return storedToken.accessToken
}

export function getSpotifyAccessToken() {
  const storedToken = sessionStorage.getItem(tokenStorageKey)
  if (!storedToken) return null

  try {
    const token = JSON.parse(storedToken) as StoredSpotifyToken
    if (token.expiresAt <= Date.now()) {
      sessionStorage.removeItem(tokenStorageKey)
      return null
    }

    return token.accessToken
  } catch {
    sessionStorage.removeItem(tokenStorageKey)
    return null
  }
}

export function logoutFromSpotify() {
  sessionStorage.removeItem(tokenStorageKey)
}

export async function getTestMessage() {
  const response = await fetch('/api/test')

  if (!response.ok) {
    throw new Error('Failed to fetch from backend')
  }

  return response.json()
}

export type StoryAnalysis = {
  summary: string
  tone: string
  genres: string[]
  moods: string[]
  emotionalArc: { stage: string; description: string }[]
  spotifySearchQueries: string[]
  sections: StorySection[]
}

export type SpotifyTrack = {
  id: string
  name: string
  artists: string[]
  album: string
  imageUrl: string | null
  spotifyUrl: string
  uri: string
  previewUrl: string | null
  isPlayable: boolean
}

export type GeminiAvailability = {
  available: boolean
  retryAfterSeconds: number
  message: string
}

export type StorySection = {
  id: number
  text: string
  title: string
  mood: string
  description: string
  searchQuery: string
  tracks?: SpotifyTrack[]
}

export async function analyzeStory(file: File, accessToken: string) {
  const formData = new FormData()
  formData.append('story', file)

  const response = await fetch('/api/story/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message
    if (response.status === 429 || response.status === 503) {
      throw new Error(errorMessage || 'Gemini is temporarily unavailable. Please wait before trying again.')
    }
    throw new Error(errorMessage || 'The story could not be analyzed.')
  }

  return result as {
    analysis: StoryAnalysis
    wordCount: number
    fileName: string
  }
}

export async function checkGeminiAvailability(accessToken: string) {
  const response = await fetch('/api/story/availability', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.error || 'Could not check Gemini availability.')
  }

  return result as GeminiAvailability
}

export async function countStoryWords(file: File, accessToken: string) {
  const formData = new FormData()
  formData.append('story', file)

  const response = await fetch('/api/story/count', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = typeof result.error === 'string' ? result.error : 'Could not read the document text.'
    throw new Error(errorMessage)
  }

  return result as { wordCount: number }
}

export async function searchTracksForSections(
  queries: Pick<StorySection, 'id' | 'searchQuery'>[],
  accessToken: string,
) {
  const response = await fetch('/api/story/tracks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ queries: queries.map(({ id, searchQuery }) => ({ id, query: searchQuery })) }),
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.error || 'Spotify could not find songs for this story.')
  }

  return result as { sections: { sectionId: number; tracks: SpotifyTrack[] }[] }
}