import { useRef, useState } from 'react'
import {
  analyzeStory,
  checkGeminiAvailability,
  countStoryWords,
  searchTracksForSections,
  type StoryAnalysis,
} from '../services/api'
import ReaderPage from './ReaderPage'
import './StoryPage.css'

const maxWords = 10_000
const maxFileBytes = 5 * 1024 * 1024

type StoryPageProps = {
  accessToken: string
  onLogout: () => void
}

function countWords(text: string) {
  return text.match(/\S+/gu)?.length ?? 0
}

export default function StoryPage({ accessToken, onLogout }: StoryPageProps) {
  const [view, setView] = useState<'upload' | 'choice' | 'songs' | 'reader'>('upload')
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [wordCount, setWordCount] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null)
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCheckingGemini, setIsCheckingGemini] = useState(false)
  const [isCounting, setIsCounting] = useState(false)
  const [selectedTrackIds, setSelectedTrackIds] = useState<Record<number, string>>({})

  async function selectFile(selectedFile?: File) {
    setError('')
    setAnalysis(null)
    setWordCount(null)

    if (!selectedFile) {
      setFile(null)
      return
    }

    const isSupported = /\.(txt|docx|pdf)$/i.test(selectedFile.name)
    if (!isSupported) {
      setFile(null)
      setError('Choose a plain text (.txt), Word (.docx), or PDF (.pdf) file.')
      return
    }

    if (selectedFile.size > maxFileBytes) {
      setFile(null)
      setError('Files must be 5 MB or smaller.')
      return
    }

    setFile(selectedFile)
    setIsCounting(true)
    try {
      const wordCount = selectedFile.name.toLowerCase().endsWith('.txt')
        ? countWords(await selectedFile.text())
        : (await countStoryWords(selectedFile, accessToken)).wordCount
      setWordCount(wordCount)
      if (wordCount > maxWords) {
        setError(`This story has ${wordCount.toLocaleString()} words. The limit is ${maxWords.toLocaleString()}.`)
      }
    } catch (countError) {
      setError(countError instanceof Error ? countError.message : 'This file could not be read.')
    } finally {
      setIsCounting(false)
    }
  }

  async function handleAnalyze() {
    if (!file || wordCount === null || wordCount > maxWords || isCounting) return

    setError('')
    setIsAnalyzing(true)
    setIsCheckingGemini(true)
    try {
      const availability = await checkGeminiAvailability(accessToken)
      setIsCheckingGemini(false)
      if (!availability.available) {
        setError(availability.message)
        return
      }

      const result = await analyzeStory(file, accessToken)
      setWordCount(result.wordCount)

      let nextAnalysis = result.analysis
      try {
        const trackResults = await searchTracksForSections(nextAnalysis.sections, accessToken)
        nextAnalysis = {
          ...nextAnalysis,
          sections: nextAnalysis.sections.map((section) => ({
            ...section,
            tracks: trackResults.sections.find((item) => item.sectionId === section.id)?.tracks ?? [],
          })),
        }
      } catch {
        nextAnalysis = {
          ...nextAnalysis,
          sections: nextAnalysis.sections.map((section) => ({ ...section, tracks: [] })),
        }
        setError('Story analysis is ready, but Spotify could not load songs. Retry the search below.')
      }

      setAnalysis(nextAnalysis)
      setSelectedTrackIds(Object.fromEntries(
        nextAnalysis.sections
          .filter((section) => section.tracks?.[0])
          .map((section) => [section.id, section.tracks![0].id]),
      ))
      setView('choice')
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'The story could not be analyzed.')
    } finally {
      setIsCheckingGemini(false)
      setIsAnalyzing(false)
    }
  }

  async function retryTrackSearch() {
    if (!analysis) return

    setError('')
    try {
      const trackResults = await searchTracksForSections(analysis.sections, accessToken)
      const sections = analysis.sections.map((section) => ({
        ...section,
        tracks: trackResults.sections.find((item) => item.sectionId === section.id)?.tracks ?? [],
      }))
      setAnalysis({ ...analysis, sections })
      setSelectedTrackIds(Object.fromEntries(
        sections.filter((section) => section.tracks?.[0]).map((section) => [section.id, section.tracks![0].id]),
      ))
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Spotify could not load songs. Try again later.')
    }
  }

  function startNewStory() {
    setFile(null)
    setWordCount(null)
    setIsCounting(false)
    setAnalysis(null)
    setSelectedTrackIds({})
    setError('')
    setView('upload')
  }

  function selectTrack(sectionId: number, trackId: string) {
    setSelectedTrackIds((current) => ({ ...current, [sectionId]: trackId }))
  }

  if (view === 'reader' && analysis) {
    return (
      <ReaderPage
        sections={analysis.sections}
        selectedTrackIds={selectedTrackIds}
        accessToken={accessToken}
        onExit={() => setView('choice')}
      />
    )
  }

  return (
    <main className="story-page">
      <header className="story-topbar">
        <a className="wordmark" href="/" aria-label="Spotify Song Finder home">
          <span className="wordmark-dot" />
          STORY / SOUND
        </a>
        <button className="logout-button" onClick={onLogout} type="button">
          Disconnect Spotify
        </button>
      </header>

      {view === 'upload' && <section className="story-intro">
        <p className="eyebrow">YOUR STORY, IN ANOTHER MEDIUM</p>
        <h1>Find the feeling.<br />Then find the music.</h1>
        <p className="intro-copy">Start with a story. We will trace its emotional arc and shape it into a musical direction.</p>
      </section>}

      {view === 'upload' && <div className="story-workspace">
        <section className="upload-panel" aria-labelledby="upload-title">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <h2 id="upload-title">Bring your story</h2>
          </div>
          <div className="upload-control">
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                const selectedFile = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                void selectFile(selectedFile)
              }}
            />
            <div className="upload-mark" aria-hidden="true">
              {file ? file.name.split('.').pop()?.toUpperCase() : 'STORY'}
            </div>
            <p className="upload-title">{file ? file.name : 'Choose a file to begin'}</p>
            <p className="upload-hint">TXT, Word, or PDF. Up to 10,000 words and 5 MB.</p>
            <button className="choose-file-button" type="button" onClick={() => fileInput.current?.click()}>
              {file ? 'Choose another file' : 'Choose story'}
            </button>
          </div>

          {file && (
            <div className="file-details" aria-live="polite">
              <span>{isCounting ? 'Checking word count...' : wordCount === null ? 'Word count unavailable' : `${wordCount.toLocaleString()} words`}</span>
              <span>{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          <button
            className="analyze-button"
            type="button"
            disabled={!file || wordCount === null || isCounting || isAnalyzing || wordCount > maxWords}
            onClick={() => void handleAnalyze()}
          >
            {isCounting ? 'Checking word count...' : isCheckingGemini ? 'Checking Gemini...' : isAnalyzing ? 'Reading story and finding songs...' : 'Analyze story'}
            <span aria-hidden="true">↗</span>
          </button>
          {file && wordCount === null && !isCounting && (
            <button className="text-action" type="button" onClick={() => void selectFile(file)}>Retry word count</button>
          )}
          {error && <p className="story-error" role="alert">{error}</p>}
          <p className="privacy-note">Files are analyzed in memory and are not saved by this app. Story text is sent to Google Gemini for analysis.</p>
        </section>

        <section className="analysis-panel" aria-labelledby="analysis-title" aria-live="polite">
          <div className="panel-heading">
            <span className="step-number">02</span>
            <h2 id="analysis-title">Story reading</h2>
          </div>

          {analysis ? (
            <AnalysisResults analysis={analysis} />
          ) : (
            <div className="analysis-empty">
              <span className="empty-orbit" aria-hidden="true">♪</span>
              <p>{isAnalyzing ? 'Listening for the shape of the story...' : 'Your story analysis will appear here.'}</p>
              <span>SUMMARY · TONE · GENRE · MOOD</span>
            </div>
          )}
        </section>
      </div>}

      {view === 'choice' && analysis && (
        <ExperienceChoice
          analysis={analysis}
          error={error}
          onBrowse={() => setView('songs')}
          onRead={() => setView('reader')}
          onNewStory={startNewStory}
          onRetryTracks={() => void retryTrackSearch()}
        />
      )}

      {view === 'songs' && analysis && (
        <SongRecommendations
          analysis={analysis}
          selectedTrackIds={selectedTrackIds}
          error={error}
          onSelectTrack={selectTrack}
          onRead={() => setView('reader')}
          onBack={() => setView('choice')}
          onNewStory={startNewStory}
          onRetryTracks={() => void retryTrackSearch()}
        />
      )}
    </main>
  )
}

function ExperienceChoice({
  analysis,
  error,
  onBrowse,
  onRead,
  onNewStory,
  onRetryTracks,
}: {
  analysis: StoryAnalysis
  error: string
  onBrowse: () => void
  onRead: () => void
  onNewStory: () => void
  onRetryTracks: () => void
}) {
  const hasTracks = analysis.sections.some((section) => section.tracks?.length)

  return (
    <section className="experience-choice">
      <div>
        <p className="eyebrow">ANALYSIS COMPLETE</p>
        <h2>Your story moves through {analysis.sections.length} musical parts.</h2>
        <p className="intro-copy">Choose how you want to experience its soundtrack.</p>
      </div>
      <div className="choice-analysis-summary">
        <AnalysisResults analysis={analysis} />
      </div>
      <div className="experience-actions">
        <button className="experience-button experience-primary" type="button" onClick={onBrowse}>
          Browse song suggestions <span aria-hidden="true">→</span>
        </button>
        <button className="experience-button experience-secondary" type="button" onClick={onRead}>
          Read with soundtrack <span aria-hidden="true">♪</span>
        </button>
      </div>
      <p className="experience-note">In-site playback requires Spotify Premium. You can still open each song in Spotify.</p>
      {error && <p className="story-error" role="alert">{error}</p>}
      {!hasTracks && <button className="text-action" type="button" onClick={onRetryTracks}>Retry song search</button>}
      <button className="text-action" type="button" onClick={onNewStory}>Start with another story</button>
    </section>
  )
}

function SongRecommendations({
  analysis,
  selectedTrackIds,
  error,
  onSelectTrack,
  onRead,
  onBack,
  onNewStory,
  onRetryTracks,
}: {
  analysis: StoryAnalysis
  selectedTrackIds: Record<number, string>
  error: string
  onSelectTrack: (sectionId: number, trackId: string) => void
  onRead: () => void
  onBack: () => void
  onNewStory: () => void
  onRetryTracks: () => void
}) {
  return (
    <section className="recommendations-view">
      <div className="recommendations-heading">
        <div>
          <p className="eyebrow">SOUNDTRACK BY STORY PART</p>
          <h2>{analysis.tone} story, section by section</h2>
        </div>
        <div className="recommendations-actions">
          <button className="experience-button experience-secondary compact-action" type="button" onClick={onRead}>Read with soundtrack</button>
          <button className="text-action" type="button" onClick={onBack}>Back</button>
        </div>
      </div>
      {error && <p className="story-error" role="alert">{error}</p>}
      {analysis.sections.map((section, sectionIndex) => (
        <article className="section-recommendations" key={section.id}>
          <header className="section-recommendation-heading">
            <span className="step-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
            <div>
              <h3>{section.title}</h3>
              <p>{section.mood} · {section.description}</p>
            </div>
          </header>
          {section.tracks?.length ? (
            <div className="track-grid">
              {section.tracks.map((track) => {
                const isSelected = selectedTrackIds[section.id] === track.id
                return (
                  <article className={isSelected ? 'track-result is-selected' : 'track-result'} key={track.id}>
                    {track.imageUrl ? <img src={track.imageUrl} alt={`${track.album} album artwork`} /> : <div className="track-image-placeholder">♪</div>}
                    <div className="track-result-copy">
                      <strong>{track.name}</strong>
                      <span>{track.artists.join(', ')}</span>
                      <small>{track.album}</small>
                    </div>
                    <div className="track-actions">
                      <button type="button" onClick={() => onSelectTrack(section.id, track.id)} aria-pressed={isSelected}>
                        {isSelected ? 'Selected' : 'Use for this part'}
                      </button>
                      <a href={track.spotifyUrl} target="_blank" rel="noreferrer">Open in Spotify</a>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-tracks">
              <p>No songs loaded for this part.</p>
              <button className="text-action" type="button" onClick={onRetryTracks}>Retry song search</button>
            </div>
          )}
        </article>
      ))}
      <button className="text-action new-story-action" type="button" onClick={onNewStory}>Start with another story</button>
    </section>
  )
}

function AnalysisResults({ analysis }: { analysis: StoryAnalysis }) {
  return (
    <div className="analysis-results">
      <div className="tone-line">
        <span className="tone-label">DOMINANT TONE</span>
        <strong>{analysis.tone}</strong>
      </div>
      <div className="result-block">
        <h3>In brief</h3>
        <p>{analysis.summary}</p>
      </div>
      <div className="result-block">
        <h3>Genres</h3>
        <div className="tag-list">
          {analysis.genres.map((genre) => <span className="result-tag" key={genre}>{genre}</span>)}
        </div>
      </div>
      <div className="result-block">
        <h3>Moods</h3>
        <div className="tag-list mood-tags">
          {analysis.moods.map((mood) => <span className="result-tag" key={mood}>{mood}</span>)}
        </div>
      </div>
      <div className="result-block arc-block">
        <h3>Emotional arc</h3>
        <ol className="arc-list">
          {analysis.emotionalArc.map((moment, index) => (
            <li key={`${moment.stage}-${index}`}>
              <span className="arc-index">{String(index + 1).padStart(2, '0')}</span>
              <span><strong>{moment.stage}</strong><small>{moment.description}</small></span>
            </li>
          ))}
        </ol>
      </div>
      <div className="result-block">
        <h3>Sound directions</h3>
        <ul className="query-list">
          {analysis.spotifySearchQueries.map((query) => <li key={query}>{query}</li>)}
        </ul>
      </div>
    </div>
  )
}