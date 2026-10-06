// Only public values live here. The Gemini key lives in the Worker's secrets, never in this repo.
export const APP_VERSION = '1.3.0';
export const API_URL = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://shivi-api.shivixricky.workers.dev';
export const REQUEST_TIMEOUT_MS = 20000;
export const HISTORY_LIMIT = 16;
export const MAX_INPUT = 1000;
