# bondroom

An agentic dating network demo: each person has an agent, each agent is given exactly two public links (LinkedIn + Instagram), and the agents do the first conversation before a human does.

## Run it

This is intentionally dependency-free. From this folder, use Node.js:

```bash
npm run dev
```

Open `http://localhost:4173`. The included `server.cjs` avoids needing Python on Windows.

## What works

- 28 seeded public-facing profiles, each with a LinkedIn link and a public Instagram link.
- Profile reader with needs, hobbies/interests, a written agent read, source links, and suggested first conversations.
- Search and category filters.
- Add-person flow: paste a LinkedIn URL and an Instagram URL; the browser calls `POST /api/profile-read`.
- The backend validates both URLs, fetches public page metadata server-side when available, and creates a cautious profile read from those two sources.
- If `OPENROUTER_API_KEY` is configured, the same backend sends only the retrieved metadata to an OpenRouter chat-completions endpoint for structured analysis. Without a key, the metadata fallback still works.
- Date lab: choose two agents and watch a fresh AI-generated agent-to-agent first date with a chemistry read; if the provider is unavailable, the UI labels the local fallback clearly.
- Rankings: choose any person and see a ranked fit index.
- Activity log, reset-demo control, responsive layout, and deep-linkable views.

## Backend and deployment

- `server.cjs` serves the static site and mirrors the API locally.
- `api/health.js` exposes `GET /api/health`.
- `api/profile-read.js` exposes `POST /api/profile-read`.
- `api/date-chat.js` exposes `POST /api/date-chat` and generates the agent-to-agent date transcript with OpenRouter when configured.
- Vercel will deploy the `api/` files as serverless functions automatically.
- Set `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, and `OPENROUTER_MODEL` in the Vercel project environment to enable model-generated reads.
- For local model testing, copy `.env.example` to `.env`, fill it in, and run `npm run dev`; `server.cjs` loads that file without adding a dependency.

The backend does not bypass logins or private pages. It attempts public HTML metadata retrieval with a short timeout; when a platform blocks the request, it records that limitation and falls back to the submitted public handles. A production version should use permissioned/official APIs or compliant public-page ingestion rather than browser-side scraping.

## Product note

Seeded profiles carry curated demo signals. Newly submitted profiles are backend-created and show which source pages were available to the server. The demo is deliberately honest about uncertainty when LinkedIn or Instagram does not expose public metadata.

## Submission copy

**Overall explanation (under 200 characters)**

> bondroom gives every person an agent: two public links become a profile read, a live agent date, and a ranking you can actually inspect.

**Technical section (under 500 characters)**

> Dependency-free HTML, CSS, and JavaScript for the interactive prototype. The demo uses a local directory of 28 curated public LinkedIn/Instagram pairs plus a URL parser for new entries. For production scraping, use a server-side worker with Playwright and official/permissioned APIs, rate limits, caching, and consent-aware data handling.

## 3-minute video cut

1. **0:00–0:20 — promise:** land on Discover, show the two-source promise and the 25+ agent count.
2. **0:20–0:55 — profile read:** open Profiles, choose Jessica Walsh, show the written read, needs, tags, and the two source buttons.
3. **0:55–1:15 — add flow:** click “add a person”, paste two public URLs, submit, and show the new profile.
4. **1:15–2:20 — agents actually date:** open Date lab, choose Jessica Walsh + Casey Neistat, start the date, let the transcript play, and pause on the chemistry result.
5. **2:20–2:50 — rankings:** open Rankings, change the person in the dropdown, show the ranked list and the “two inputs / one read” explanation.
6. **2:50–3:00 — close:** show Activity and reset/demo polish.
