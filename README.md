# Spotify Song Finder

## Project layout

- `frontend/` contains the React, TypeScript, and Vite application.
- `backend/` contains the Node.js API scaffold.

## Run locally

Start the frontend from `frontend/` with `npm install` followed by `npm run dev`.

In `backend/`, copy `.env.example` to `.env` and add a Gemini API key. Then run `npm install` followed by `npm start`. The API listens on port `5000`.

## Spotify login

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:5000/callback` as a redirect URI in the app settings.
3. Set `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/callback` in `frontend/.env`.
4. Restart the Vite dev server and open the app at `http://127.0.0.1:5173/`.

The frontend uses Authorization Code with PKCE, so it does not need a Spotify client secret. Express receives Spotify's callback on port `5000` and forwards it to the frontend. The redirect URI in `frontend/.env` must exactly match the one registered in the dashboard. Sign out and sign in again after changing the requested scopes so Spotify can grant playback permissions.

## Story analysis

After signing in, upload a `.txt`, `.docx`, or text-based `.pdf` story to receive a Gemini analysis of its summary, tone, genres, moods, emotional arc, and Spotify search directions. Legacy `.doc` files are not supported. Files are limited to 5 MB and 10,000 extracted words. Uploads are processed in memory and are not saved by this app.

The Gemini API key stays in `backend/.env`; never put it in a `VITE_` variable. Gemini 3.8 Flash has a 1,048,576-token input limit, but free-tier access and request quotas are limited and can change. On Google's free tier, submitted content may be used to improve its products; avoid uploading sensitive stories unless you are comfortable with Google's current terms.

## Story reader and music

After analysis, the app searches Spotify for tracks matched to each story section. Choose **Browse song suggestions** to review and select a track for each part, or **Read with soundtrack** to advance through the story while the selected tracks change. Browser playback uses Spotify's Web Playback SDK and requires Spotify Premium plus the `streaming`, `user-read-playback-state`, and `user-modify-playback-state` scopes. The reader must be started by a user click; Spotify links remain available when in-site playback is unavailable.
