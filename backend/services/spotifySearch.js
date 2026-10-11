export async function searchTracksForSections(queries, accessToken) {
  return Promise.all(queries.map(async ({ id, query }) => {
    const params = new URLSearchParams({ q: query, type: 'track', limit: '5' })
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const error = new Error(
        response.status === 429
          ? 'Spotify search is rate limited. Please try again shortly.'
          : 'Spotify could not find tracks for this story section.',
      )
      error.status = response.status === 429 ? 429 : 502
      throw error
    }

    const result = await response.json()
    return {
      sectionId: id,
      tracks: result.tracks.items.map((track) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist) => artist.name),
        album: track.album.name,
        imageUrl: track.album.images[0]?.url ?? null,
        spotifyUrl: track.external_urls.spotify,
        uri: track.uri,
        previewUrl: track.preview_url,
        isPlayable: track.is_playable !== false,
      })),
    }
  }))
}