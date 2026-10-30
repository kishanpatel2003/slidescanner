# Reproduce the demo

The bundled DemoCo deck is fictional and contains synthetic business data.

```sh
pnpm demo:assets
MOCK_DECK=1 pnpm dev
# In another terminal:
pnpm demo:record
pnpm demo:encode
```

The generator produces matching slide images and JSON geometry. The recorder exercises the actual local app with mocked Google and vision responses, including slide navigation, visual extraction, editing, and Markdown export. It requires Playwright Chromium; encoding requires ffmpeg. Recordings and encoded videos are ignored by Git.

Demo mode is for demonstration only. It does not validate real Google credentials or vision-model accuracy.
