# Shivi

Mobile-first bestie chat PWA. Static frontend (GitHub Pages) → Cloudflare Worker proxy (holds the Gemini key) → Gemini.

## What's inside (v1.2)
- **Memory**: biodata + facts Shivi learns on her own, editable in Settings → Shivi ki memory. Stored only in the browser.
- **Moods**: Shivi's mood changes with the situation (header pill, avatar ring colour).
- **Stickers + emoji**: add your own images in Settings → Stickers, tag them by mood. Shivi sends them now and then; you can send them too.
- **One-line replies**: Shivi answers in a single short line, max 15 words (enforced in the prompt and again in the Worker).
- **Voice notes**: now and then Shivi sends a sweet voice message (Gemini text-to-speech through the Worker). Settings → Voice notes (Band / Kabhi kabhi / Zyada), pick her voice and tap "Awaaz sunao" to preview. If voice fails she falls back to text.
- The site reloads itself once when a new version is deployed.

## Update an existing deployment
1. `cd worker && npx wrangler deploy`
2. `git add . && git commit -m "v1.1" && git push` (GitHub Actions publishes the site)

## Run locally
1. `cd worker` and create `.dev.vars` with two lines: `GEMINI_API_KEY=YOUR_KEY` and `ALLOWED_ORIGIN=*`, then `npx wrangler dev` (serves http://localhost:8787)
2. In another terminal from the project root: `python3 -m http.server 8000`, open http://localhost:8000

## First deploy
1. Worker: `cd worker && npx wrangler login && npx wrangler secret put GEMINI_API_KEY && npx wrangler deploy`
2. Put the printed `https://shivi-api.<you>.workers.dev` URL in `js/config.js` (`API_URL`) and your Pages origin in `worker/wrangler.toml` (`ALLOWED_ORIGIN`).
3. Push to GitHub → Settings → Pages → Source: GitHub Actions.
4. Open the Pages URL in Chrome on Android → menu → Install app.

## Voice notes: models
The Worker tries `gemini-3.8-flash-tts`, then `gemini-3.8-flash-lite-tts`, then `gemini-3.1-flash-tts-preview`. Model names change often; if voice stops working, check the Gemini speech docs and edit `TTS_MODELS` in `worker/index.js`.

## Privacy
Never commit biodata or personal files to this public repo. Type biodata into the app's memory screen instead. The Gemini key lives only in the Worker's secrets.


## v1.3
New photo icons, romantic UI, weak-network auto-retry, Gemini model fallback, more natural voice. Re-run `npx wrangler deploy` inside `worker/` after updating.
