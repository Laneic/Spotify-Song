import express from 'express'

const app = express()
const port = process.env.PORT || 3001

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`API server listening on port ${port}`)
})