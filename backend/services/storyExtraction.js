import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export const MAX_STORY_WORDS = 10_000

function countWords(text) {
  return text.match(/\S+/gu)?.length ?? 0
}

export async function extractStory(file) {
  const extension = path.extname(file.originalname).toLowerCase()
  let text

  if (extension === '.txt') {
    text = file.buffer.toString('utf8')
  } else if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer })
    text = result.value
  } else if (extension === '.pdf') {
    if (!file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
      throw Object.assign(new Error('This does not appear to be a valid PDF.'), { status: 400 })
    }

    const parser = new PDFParse({ data: file.buffer })
    try {
      const result = await parser.getText()
      text = result.text
    } finally {
      await parser.destroy()
    }
  } else {
    throw Object.assign(new Error('Choose a .txt, .docx, or .pdf file.'), { status: 400 })
  }

  const wordCount = countWords(text)
  if (wordCount === 0) {
    throw Object.assign(new Error('No readable text was found in that file.'), { status: 400 })
  }
  if (wordCount > MAX_STORY_WORDS) {
    throw Object.assign(new Error(`Stories must be ${MAX_STORY_WORDS.toLocaleString()} words or fewer.`), { status: 413 })
  }

  return { text: text.trim(), wordCount }
}