// API base resolution.
//
// Audio + lyric-fallback endpoints are now co-located as Vercel Serverless
// Functions in this same project (see /api). So by default we call them on the
// SAME ORIGIN as the app — no dependency on the old, now-retired Fly.dev host.
//
// An explicit VITE_API_BASE_URL still wins (useful for local dev against a
// separate backend), EXCEPT when it points at the dead Fly.dev host, in which
// case we self-heal back to same-origin.
const DEFAULT_REMOTE_BACKEND = 'https://swar-player-backend.onrender.com';

let configured = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('swar_api_base_url')) ||
  ''
).replace(/\/$/, '');
if (/fly\.dev/i.test(configured)) configured = '';

// When deployed to Render static sites or remote hosts where VITE_API_BASE_URL was not baked in,
// fallback to the live Swar Render backend instead of calling the static site origin.
if (!configured && typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLocal) {
    configured = DEFAULT_REMOTE_BACKEND;
  }
}

const API_BASE_URL = configured;

export function buildApiUrl(path, params = {}) {
  const base = API_BASE_URL || window.location.origin;
  const url = new URL(path, base);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}
