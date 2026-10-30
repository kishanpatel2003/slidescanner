# Record a walkthrough

Use the bundled Acme deck to record navigation, extraction, editing, and Markdown export without external API calls.

```sh
pnpm demo:assets
MOCK_DECK=1 pnpm dev
# In another terminal:
pnpm demo:record
pnpm demo:encode
```

The asset generator keeps slide artwork and element geometry in sync. Recording requires Playwright Chromium; encoding requires ffmpeg. Videos stay outside Git.
