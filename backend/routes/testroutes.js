import express from 'express'

const router = express.Router()

router.get('/', (_request, response) => {
  response.json({
    message: 'Backend is working!',
  })
})

export default router