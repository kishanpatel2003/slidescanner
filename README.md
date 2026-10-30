# SlideScanner

Turn a Google Slides deck into clean, LLM-ready markdown - with you in control of what gets extracted.

Machines alone do a bad job of reading slides full of diagrams, charts, and screenshots. SlideScanner does the boring part automatically (all the text) and lets you point a magic wand at the visuals that actually matter. A vision model turns each one into markdown, you fix anything it got wrong, and you walk away with one clean document.

## What it does

- **Reads any deck you can view.** Paste a Google Slides URL - view-only and comment-only decks work fine. The deck is never modified.
- **Extracts all text automatically.** Titles, bullets, and native tables come straight from the Slides API, in reading order.
- **You wand the visuals.** Click a diagram, chart, or screenshot on the slide and a vision model (Claude) describes it as markdown. Skip the decorative stuff.
- **Everything is editable.** Every extracted block is a rich markdown editor. Fix a word, restructure a list, delete a paragraph - like writing in Notion.
- **One master document.** Everything you keep flows into a single markdown doc, organized slide by slide, updated live. Copy it or download it as a `.md` file.

## Quick start

```sh
pnpm install --frozen-lockfile
MOCK_DECK=1 pnpm dev
```

Open http://localhost:3000 and enter a Google Slides URL. `MOCK_DECK=1` uses the bundled Acme deck and saved extraction responses. See [recording instructions](docs/RECORDING.md).

## Getting started with your own decks

You need: Node 20+, `pnpm`, the `gcloud` CLI, and an Anthropic API key.

```bash
git clone https://github.com/kishanpatel2003/slidescanner.git
cd slidescanner
pnpm install
```

**1. Give the app read access to Google Slides** (one-time):

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/presentations.readonly,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/cloud-platform
gcloud auth application-default set-quota-project <a-gcp-project-you-own>
```

The quota project must have the Slides and Drive APIs enabled. If you don't have one, create a GCP project, then:

```bash
gcloud services enable slides.googleapis.com drive.googleapis.com --project=<your-project>
```

**2. Add your Anthropic API key** (one-time): get a key at [console.anthropic.com](https://console.anthropic.com), then create a `.env` file:

```
ANTHROPIC_API_KEY=<your-key>
```

**3. Run it:**

```bash
pnpm dev
```

Open http://localhost:3000 and paste a Google Slides URL.

## How to use it

| Action | How |
| --- | --- |
| Flip through slides | `<-` `->` (or PgUp/PgDn, Home/End) |
| Extract a visual | Click it with the wand cursor |
| Remove anything from the doc | Hold `Cmd` (minus appears on the wand) and click it, or use the trash icon |
| Bring something back | Click the dimmed box again |
| Edit extracted content | Click into any block in the right pane and type |
| Retry a failed extraction | Click the red box or the Retry button |
| See / export the document | "Document" button in the header - Copy or Download `.md` |

**Reading the colors:** green boxes are auto-extracted text, dashed gray boxes are visuals waiting for the wand, violet boxes are wand-extracted, dimmed boxes are removed.

## Configuration

Set in `.env`:

| Variable | What it does | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic API key for vision extraction | (required) |
| `VISION_MODEL` | Which model reads your visuals | `claude-sonnet-4-6` |
| `MOCK_DECK` | Set to `1` to use the bundled deck and saved responses | unset |
| `MOCK_EXTRACT_DELAY_MS` | Artificial delay for mock visual extraction, in milliseconds | `700` |

## Example data

Leave `MOCK_DECK` unset to use Google Slides and Anthropic. `MOCK_EXTRACT_DELAY_MS=0` makes saved responses appear instantly.

## Good to know

- Nothing is saved anywhere. Your work lives in the browser tab; export the document before closing.
- Slide images come from short-lived Google URLs (~30 min). If slides stop rendering after a long pause, reload the deck.
- Vision extraction quality is the heart of the tool. If a diagram comes out wrong, edit it inline - or wand it again for a fresh attempt.

## How it works (one paragraph)

The backend (Next.js API routes) pulls the deck structure from the Google Slides API - element positions, types, and text - and renders slide thumbnails. The frontend overlays clickable bounding boxes on each slide. When you wand an element, the server crops that region out of the slide image with `sharp` and sends it to Claude via the Anthropic API with a prompt tuned to the element type (table, chart, diagram, screenshot). The result lands in the side pane as editable markdown, and the master document is recomputed from all kept blocks on every change.

## Local use

Run on localhost. Google access uses your machine credentials; visual extraction sends the selected content to the configured model provider.

The editor uses Tiptap v2 with a known `mergeAttributes` advisory. Upgrade the editor before exposing it as a service that accepts untrusted content.

## License

MIT
