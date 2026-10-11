import { useEffect, useState } from "react";
import {
  completeSpotifyLogin,
  getSpotifyAccessToken,
  getTestMessage,
  loginWithSpotify,
  logoutFromSpotify,
} from "./services/api";
import StoryPage from "./pages/StoryPage";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getSpotifyAccessToken() !== null,
  );
  const [authError, setAuthError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(
    () => getSpotifyAccessToken() ?? "",
  );

  useEffect(() => {
    getTestMessage()
      .then((data) => {
        setMessage(data.message);
      })
      .catch((error) => {
        console.error(error);
      });

    completeSpotifyLogin()
      .then((token) => {
        if (token) {
          setSpotifyToken(token);
          setIsAuthenticated(true);
        }
      })
      .catch((error: unknown) => {
        setAuthError(
          error instanceof Error ? error.message : "Spotify sign-in failed.",
        );
      });
  }, []);

  async function handleSpotifyLogin() {
    setAuthError("");
    setIsSigningIn(true);

    try {
      await loginWithSpotify();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Spotify sign-in failed.",
      );
      setIsSigningIn(false);
    }
  }

  function handleSpotifyLogout() {
    logoutFromSpotify();
    setSpotifyToken("");
    setIsAuthenticated(false);
  }

  if (isAuthenticated && spotifyToken) {
    return <StoryPage accessToken={spotifyToken} onLogout={handleSpotifyLogout} />;
  }

  return (
    <main className="auth-page">
      <h1>Spotify Song Finder</h1>
      <p className="connection-status" aria-live="polite">
        {message || "Connecting to the backend..."}
      </p>
      {isAuthenticated ? (
        <button className="spotify-button" onClick={handleSpotifyLogout}>
          Disconnect Spotify
        </button>
      ) : (
        <button
          className="spotify-button"
          onClick={() => void handleSpotifyLogin()}
          disabled={isSigningIn}
        >
          {isSigningIn ? "Redirecting to Spotify..." : "Login with Spotify"}
        </button>
      )}
      {authError && (
        <p className="auth-error" role="alert">
          {authError}
        </p>
      )}
    </main>
  );
}

export default App;