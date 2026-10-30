// Example mode serves the bundled deck without external calls.
// Enabled with MOCK_DECK=1.
import 'server-only';

import type { PresentationData, ThumbnailData, BoundingBox } from './types';
import deck from './mockDeck.json';

export const mockPresentation = deck.presentation as PresentationData;

export function mockThumbnail(pageId: string): ThumbnailData | null {
  const slide = mockPresentation.slides.find((s) => s.slideId === pageId);
  if (!slide) return null;
  return { url: `/mock/slide-${slide.index + 1}.png`, width: 1600, height: 900 };
}

const extractions = deck.extractions as Record<string, string>;

export function mockExtraction(pageId: string, box: BoundingBox): string {
  const slide = mockPresentation.slides.find((s) => s.slideId === pageId);
  const el = slide?.elements.find(
    (e) => Math.abs(e.boundingBox.x - box.x) < 1 && Math.abs(e.boundingBox.y - box.y) < 1,
  );
  return (el && extractions[el.elementId]) ?? '*No extraction available.*';
}

export function mockDelayMs(): number {
  const raw = process.env.MOCK_EXTRACT_DELAY_MS;
  if (!raw) return 700;
  const delay = Number(raw);
  return Number.isFinite(delay) && delay >= 0 ? delay : 700;
}
