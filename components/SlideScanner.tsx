'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ElementUiState,
  PresentationData,
  SlideData,
  SlideElement,
  ThumbnailData,
} from '@/lib/types';
import { defaultUiState } from '@/lib/types';
import { buildMasterMarkdown, wordCount } from '@/lib/master';
import SlideCanvas from './SlideCanvas';
import SidePane from './SidePane';
import MasterDocDrawer from './MasterDocDrawer';

type Phase = 'input' | 'loading' | 'ready';

function slideContext(slide: SlideData): string | null {
  const title = slide.elements.find((el) => el.role === 'title' && el.extractedContent);
  return title?.extractedContent?.split('\n')[0] ?? null;
}

export default function SlideScanner() {
  const [phase, setPhase] = useState<Phase>('input');
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [thumbnails, setThumbnails] = useState<Record<string, ThumbnailData>>({});
  const [uiStates, setUiStates] = useState<Record<string, ElementUiState>>({});
  const [showDoc, setShowDoc] = useState(false);
  const thumbnailRequests = useRef(new Set<string>());

  const loadPresentation = useCallback(async () => {
    if (!urlInput.trim()) return;
    setPhase('loading');
    setError(null);
    try {
      const res = await fetch(`/api/presentation?id=${encodeURIComponent(urlInput)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setPresentation(data);
      setCurrentIndex(0);
      setThumbnails({});
      setUiStates({});
      thumbnailRequests.current.clear();
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('input');
    }
  }, [urlInput]);

  const updateUiState = useCallback(
    (el: SlideElement, patch: Partial<ElementUiState>) => {
      setUiStates((prev) => ({
        ...prev,
        [el.elementId]: { ...(prev[el.elementId] ?? defaultUiState(el)), ...patch },
      }));
    },
    [],
  );

  const startExtraction = useCallback(
    (el: SlideElement, slide: SlideData) => {
      if (!presentation) return;
      updateUiState(el, { selection: 'wand-selected', status: 'loading', error: null });
      fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentationId: presentation.presentationId,
          pageId: slide.slideId,
          elementType: el.type,
          boundingBox: el.boundingBox,
          pageSize: presentation.pageSize,
          description: el.description,
          slideContext: slideContext(slide),
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `Extraction failed (${res.status})`);
          updateUiState(el, { status: 'done', content: data.markdown, error: null });
        })
        .catch((err) => {
          updateUiState(el, {
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    [presentation, updateUiState],
  );

  const handleElementClick = useCallback(
    (el: SlideElement, withModifier: boolean) => {
      if (!presentation) return;
      const slide = presentation.slides[currentIndex];
      const ui = uiStates[el.elementId] ?? defaultUiState(el);

      if (ui.selection === 'deselected') {
        // Any click on a deselected element restores it.
        if (el.isTextual) {
          updateUiState(el, { selection: 'auto-selected' });
        } else if (ui.content !== null || ui.status === 'loading') {
          updateUiState(el, { selection: 'wand-selected' });
        } else if (withModifier) {
          updateUiState(el, { selection: 'unselected' }); // back to neutral, not extracted
        } else {
          startExtraction(el, slide); // plain click means "wand it"
        }
        return;
      }

      if (withModifier) {
        // ⌘/Ctrl+click deselects any element.
        updateUiState(el, { selection: 'deselected' });
        return;
      }

      if (el.isTextual) return; // text is auto-extracted; nothing to wand
      if (ui.selection === 'wand-selected') {
        if (ui.status === 'error') startExtraction(el, slide); // click a failed box to retry
        return;
      }
      // unselected or deselected → wand-select; reuse content if we already extracted once
      if (ui.content !== null || ui.status === 'loading') {
        updateUiState(el, { selection: 'wand-selected' });
      } else {
        startExtraction(el, slide);
      }
    },
    [presentation, currentIndex, uiStates, updateUiState, startExtraction],
  );

  const handleDelete = useCallback(
    (el: SlideElement) => updateUiState(el, { selection: 'deselected' }),
    [updateUiState],
  );

  const handleRetry = useCallback(
    (el: SlideElement) => {
      if (!presentation) return;
      startExtraction(el, presentation.slides[currentIndex]);
    },
    [presentation, currentIndex, startExtraction],
  );

  const handleEdit = useCallback(
    (el: SlideElement, markdown: string) => {
      updateUiState(el, { content: markdown, userEdited: true });
    },
    [updateUiState],
  );

  const masterMarkdown = useMemo(
    () => (presentation ? buildMasterMarkdown(presentation, uiStates) : ''),
    [presentation, uiStates],
  );

  // Fetch thumbnails for the current slide and prefetch neighbors.
  useEffect(() => {
    if (!presentation) return;
    const wanted = [currentIndex, currentIndex + 1, currentIndex - 1, currentIndex + 2]
      .filter((i) => i >= 0 && i < presentation.slides.length)
      .map((i) => presentation.slides[i].slideId);
    for (const slideId of wanted) {
      if (thumbnailRequests.current.has(slideId)) continue;
      thumbnailRequests.current.add(slideId);
      fetch(
        `/api/thumbnail?presentationId=${presentation.presentationId}&pageId=${encodeURIComponent(slideId)}`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.url) setThumbnails((prev) => ({ ...prev, [slideId]: data }));
          else thumbnailRequests.current.delete(slideId); // allow retry on error
        })
        .catch(() => thumbnailRequests.current.delete(slideId));
    }
  }, [presentation, currentIndex]);

  // Arrow-key navigation.
  useEffect(() => {
    if (phase !== 'ready' || !presentation) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setShowDoc(false);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, presentation.slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Home') {
        setCurrentIndex(0);
      } else if (e.key === 'End') {
        setCurrentIndex(presentation.slides.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, presentation]);

  if (phase !== 'ready' || !presentation) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-lg ring-1 ring-black/5">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">SlideScanner</h1>
          <p className="mb-6 text-sm text-slate-500">
            Turn a Google Slides deck into LLM-ready markdown with human-guided extraction.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadPresentation();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste a Google Slides URL…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              autoFocus
            />
            <button
              type="submit"
              disabled={phase === 'loading' || !urlInput.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {phase === 'loading' ? 'Loading…' : 'Open deck'}
            </button>
          </form>
          {error && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  const slide = presentation.slides[currentIndex];

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-baseline gap-3 overflow-hidden">
          <h1 className="text-sm font-semibold tracking-tight">SlideScanner</h1>
          <span className="truncate text-sm text-slate-500">{presentation.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">← → to navigate</span>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium tabular-nums">
            {currentIndex + 1} / {presentation.slides.length}
          </span>
          <button
            onClick={() => setShowDoc((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              showDoc
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Document · {wordCount(masterMarkdown)}w
          </button>
          <button
            onClick={() => {
              setPhase('input');
              setPresentation(null);
            }}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
          >
            New deck
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-[3] items-center justify-center bg-slate-100 p-6">
          <div className="w-full max-w-4xl">
            <SlideCanvas
              slide={slide}
              pageSize={presentation.pageSize}
              thumbnail={thumbnails[slide.slideId] ?? null}
              uiStates={uiStates}
              onElementClick={handleElementClick}
            />
          </div>
        </section>
        <aside className="min-w-0 flex-[2] border-l border-slate-200 bg-slate-50">
          <SidePane
            slide={slide}
            uiStates={uiStates}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onEdit={handleEdit}
          />
        </aside>
      </div>
      {showDoc && (
        <MasterDocDrawer
          markdown={masterMarkdown}
          deckTitle={presentation.title}
          onClose={() => setShowDoc(false)}
        />
      )}
    </main>
  );
}
