import express from 'express'
import { requireSpotifyAuth } from '../middleware/requireSpotifyAuth.js'
import { uploadStory } from '../middleware/uploadStory.js'
import { analyzeStory, getGeminiAvailability } from '../services/storyAnalysis.js'
import { extractStory } from '../services/storyExtraction.js'
import { searchTracksForSections } from '../services/spotifySearch.js'

const router = express.Router()

router.get('/availability', requireSpotifyAuth, (_request, response) => {
  response.json(getGeminiAvailability())
})

router.post('/count', requireSpotifyAuth, uploadStory.single('story'), async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).json({ error: 'Choose a story file to check its word count.' })
    }

    const { wordCount } = await extractStory(request.file)
    response.json({ wordCount })
  } catch (error) {
    next(error)
  }
})

router.post('/tracks', requireSpotifyAuth, async (request, response, next) => {
  try {
    const queries = Array.isArray(request.body?.queries)
      ? request.body.queries
        .slice(0, 4)
        .filter((item) => Number.isInteger(item.id) && typeof item.query === 'string')
        .map((item) => ({ id: item.id, query: item.query.trim().slice(0, 120) }))
        .filter((item) => item.query)
      : []

    if (queries.length === 0) {
      return response.status(400).json({ error: 'No section search queries were provided.' })
    }

    const accessToken = request.get('authorization').replace(/^Bearer\s+/i, '')
    const sections = await searchTracksForSections(queries, accessToken)
    response.json({ sections })
  } catch (error) {
    next(error)
  }
})

router.post('/analyze', requireSpotifyAuth, uploadStory.single('story'), async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).json({ error: 'Choose a .txt or .pdf story to continue.' })
    }

    const { text, wordCount } = await extractStory(request.file)
    const analysis = await analyzeStory(text)

    response.json({ analysis, wordCount, fileName: request.file.originalname })
  } catch (error) {
    next(error)
  }
})

export default router