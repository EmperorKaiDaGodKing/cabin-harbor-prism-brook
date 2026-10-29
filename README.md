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

| Variable           | Required | Default    | Purpose                                                                                     |
| ------------------ | -------- | ---------- | ------------------------------------------------------------------------------------------- |
| `XAI_API_KEY`      | To reply |            | Server-only xAI API key. On a Grok deploy the platform injects it.                          |
| `XAI_MODEL`        | No       | `grok-4.5` | Chat model id (`letters`, numbers, `.`, `_`, `-`). Anything else falls back to the default. |
| `XAI_VISION_MODEL` | No       | `grok-4.7` | Model for a turn that includes a photo. See below.                                          |
| `XAI_TEMPERATURE`  | No       | `0.7`      | Sampling temperature, clamped to `0`–`2`. Invalid values fall back to the default.          |

If `XAI_API_KEY` is missing, Frank stays on screen and says the model is unavailable. Messages already on the device can still be read. Nothing is sent to xAI.

Replies stream from `POST /api/frank`. Output is capped (`max_tokens` 450) so a visitor cannot run an unbounded completion.

## Photos

A message can include up to four photos: jpg, png, webp, or gif, from the photo picker, a drop, or a paste. Large stills are resized on the device (long edge 1600px, jpeg) before they are kept. Each photo has to stay under about 1.4 million characters of data URL. A gif under 900KB stays animated in the thread. Anything over the cap shows an error and is not sent.

Frank sees the photo. The request uses xAI chat-completions image parts (`image_url` with a base64 data URL, `detail: auto`). xAI documents jpeg and png only, so a webp or gif is turned into a jpeg still on the device before that call. The animated gif in the thread is unchanged.

Image input was checked against [docs.x.ai](https://docs.x.ai) on 2026-10-29. These chat model ids accept images:

- `grok-4.7` (text and image in, text out)
- `grok-4.6`, `grok-4.5`, `grok-4.5-latest`, `grok-4.3`, `grok-4.3-latest` (text, image → text)
- `grok-4` (chat-completions image examples)
- `grok-2-vision-1212` and other ids that contain `vision` (legacy)

`grok-4.7` does accept images. A photo turn uses `XAI_MODEL` when that id is one of the above. Set `XAI_VISION_MODEL` to force a different model for photo turns. If that variable is unset and `XAI_MODEL` cannot take images, photo turns use `grok-4.7`.

Only the four newest photos in the thread are sent again on a later turn, so a follow-up can still refer to a recent picture without uploading the whole history. Older photos stay visible on the device. Tapping one opens it full screen: Esc, the close button, or a tap on the dark area dismisses it; arrows and a swipe move between photos in the thread; pinch, double-tap, or the scroll wheel zooms.

Photos are not written on the server and are not logged. They live in the same on-device thread as the text. Clearing the chat removes them. A very long thread drops the oldest photos from device storage before the text.

## Scripts

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` runs the script tests and Frank's boundary, config, stream, and storage tests.

## Deploy

The production build is Vite plus Nitro's Vercel preset (`npm run build`). `vercel.json` sets the install command. Configure `XAI_API_KEY`, and optionally `XAI_MODEL`, `XAI_VISION_MODEL`, and `XAI_TEMPERATURE`, in the Vercel project for Production and Preview.

Do not commit `.vercel/output`, preview logs, screenshots, or secrets. `.env` files are gitignored. The platform injects `XAI_API_KEY` for a Grok-hosted deploy, so a local `.env` is not part of this repo.

## Privacy

The 18+ confirmation, the tone, and the message history — including photos — live in `localStorage` on the device. Clearing the chat removes the thread from that store. The confirmation stays until the site data is cleared. The server does not store photos; it only passes them through on the reply request.
