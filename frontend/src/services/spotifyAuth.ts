const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

const redirectUri = "http://127.0.0.1:5173/callback";

function generateRandomString(length: number) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join("");
}

async function generateCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);

  const digest = await crypto.subtle.digest("SHA-256", data);

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function loginWithSpotify() {
  const codeVerifier = generateRandomString(64);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  localStorage.setItem("spotify_code_verifier", codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  window.location.href =
    `https://accounts.spotify.com/authorize?${params.toString()}`;
}