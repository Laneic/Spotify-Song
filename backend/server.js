import express from 'express'
import dotenv from 'dotenv'
import multer from 'multer'
import testRoutes from './routes/testroutes.js'
import storyRoutes from './routes/storyRoutes.js'

dotenv.config()

const app = express();

app.use(express.json())

app.use('/api/test', testRoutes)
app.use('/api/story', storyRoutes)

app.get('/callback', (request, response) => {
  const callbackParams = new URLSearchParams()

  for (const key of ['code', 'state', 'error']) {
    const value = request.query[key]
    if (typeof value === 'string') callbackParams.set(key, value)
  }

  const query = callbackParams.toString()
  response.redirect(query ? `http://127.0.0.1:5173/?${query}` : 'http://127.0.0.1:5173/')
})

const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`API server listening on port ${port}`)
})

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'Files must be 5 MB or smaller.' })
  }

  if (error instanceof multer.MulterError) {
    return response.status(400).json({ error: 'The uploaded file could not be processed.' })
  }

  console.error(error)
  return response.status(error.status || 500).json({
    error: error.status ? error.message : 'The story could not be analyzed.',
  })
})