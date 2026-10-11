export async function requireSpotifyAuth(request, response, next) {
  const authorization = request.get('authorization') || ''
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!accessToken) {
    return response.status(401).json({ error: 'Sign in with Spotify before analyzing a story.' })
  }

  try {
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileResponse.ok) {
      return response.status(401).json({ error: 'Your Spotify session expired. Sign in again.' })
    }

    next()
  } catch (error) {
    next(error)
  }
}