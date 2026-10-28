# Frank

Frank is an adults-only companion chat. He is warm, direct, and sensual when you invite that, and the hard line does not move: consenting adults only. The conversation stays in the browser on the device. There is no account.

## Boundaries

Frank refuses, in one sentence, and redirects when a request involves any of these:

- minors or age-play
- non-consent or coercion, including a stranger groping someone in public
- exploitation, violence, or illegal harm
- real, identifiable people

A server-side check rejects obvious cases before the model is called. It is a light, high-precision filter so ordinary adult talk still goes through. It is not a substitute for the system prompt, which keeps the same boundaries in every tone.

Tones (sweet, playful, spicy) only change delivery. They do not loosen the boundaries.

## Setup

Node 22.

```bash
npm ci
npm run dev
```

The dev server listens on port 8080. The first screen is an 18+ confirmation, remembered on the device. After that, the chat is the whole app.

## Environment

Set these on the server. Do not prefix them with `VITE_` and do not commit them.

| Variable          | Required | Default    | Purpose                                                                                     |
| ----------------- | -------- | ---------- | ------------------------------------------------------------------------------------------- |
| `XAI_API_KEY`     | To reply |            | Server-only xAI API key. On a Grok deploy the platform injects it.                          |
| `XAI_MODEL`       | No       | `grok-4.5` | Chat model id (`letters`, numbers, `.`, `_`, `-`). Anything else falls back to the default. |
| `XAI_TEMPERATURE` | No       | `0.7`      | Sampling temperature, clamped to `0`–`2`. Invalid values fall back to the default.          |

If `XAI_API_KEY` is missing, Frank stays on screen and says the model is unavailable. Messages already on the device can still be read. Nothing is sent to xAI.

Replies stream from `POST /api/frank`. Output is capped (`max_tokens` 450) so a visitor cannot run an unbounded completion.

## Scripts

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` runs the script tests and Frank's boundary, config, stream, and storage tests.

## Deploy

The production build is Vite plus Nitro's Vercel preset (`npm run build`). `vercel.json` sets the install command. Configure `XAI_API_KEY` (and the optional model and temperature) in the Vercel project for Production and Preview.

Do not commit `.vercel/output`, preview logs, screenshots, or secrets. `.env` files are gitignored. The platform injects `XAI_API_KEY` for a Grok-hosted deploy, so a local `.env` is not part of this repo.

## Privacy

The 18+ confirmation, the tone, and the message history live in `localStorage` on the device. Clearing the chat removes the thread from that store. The confirmation stays until the site data is cleared.
