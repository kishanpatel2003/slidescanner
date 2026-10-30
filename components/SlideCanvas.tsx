'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementUiState, SlideData, SlideElement, ThumbnailData } from '@/lib/types';
import { defaultUiState } from '@/lib/types';

interface Props {
  slide: SlideData;
  pageSize: { width: number; height: number };
  thumbnail: ThumbnailData | null;
  uiStates: Record<string, ElementUiState>;
  onElementClick: (el: SlideElement, withModifier: boolean) => void;
}

// Magic wand cursor: diagonal wand with a spark, hotspot at the tip (2,2).
// With `minus`, a small ⊖ badge sits under the handle: reverse-select (deselect) mode.
function wandCursor(minus: boolean): string {
  const badge = minus
    ? `<line x1='3' y1='20' x2='11' y2='20' stroke='%23111' stroke-width='4' stroke-linecap='round'/>` +
      `<line x1='3' y1='20' x2='11' y2='20' stroke='white' stroke-width='2.2' stroke-linecap='round'/>`
    : '';
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>` +
    `<line x1='7' y1='7' x2='22' y2='22' stroke='%23111' stroke-width='3.4' stroke-linecap='round'/>` +
    `<line x1='7' y1='7' x2='22' y2='22' stroke='white' stroke-width='1.6' stroke-linecap='round'/>` +
    `<path d='M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z' fill='%23facc15' stroke='%23111' stroke-width='0.8'/>` +
    badge +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 5 5, crosshair`;
}

const WAND_CURSOR = wandCursor(false);
const WAND_CURSOR_REVERSE = wandCursor(true);

/** True while ⌘ (or Ctrl) is held, so the UI can signal reverse-select mode. */
function useModifierHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) setHeld(false);
    };
    const reset = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);
  return held;
}

function boxStyle(el: SlideElement, pageSize: Props['pageSize']) {
  return {
    left: `${(el.boundingBox.x / pageSize.width) * 100}%`,
    top: `${(el.boundingBox.y / pageSize.height) * 100}%`,
    width: `${(el.boundingBox.width / pageSize.width) * 100}%`,
    height: `${(el.boundingBox.height / pageSize.height) * 100}%`,
  };
}

function boxClasses(el: SlideElement, ui: ElementUiState): string {
  if (ui.selection === 'deselected') {
    return 'border border-slate-400/70 bg-slate-500/25 opacity-70';
  }
  if (ui.selection === 'wand-selected') {
    if (ui.status === 'loading') {
      return 'border-2 border-violet-500 bg-violet-400/20 animate-pulse';
    }
    if (ui.status === 'error') {
      return 'border-2 border-red-500 bg-red-400/15';
    }
    return 'border-2 border-violet-500 bg-violet-400/15';
  }
  if (el.isTextual) {
    return 'border border-emerald-500/50 bg-emerald-400/10 hover:bg-emerald-400/20';
  }
  return 'border border-slate-400/60 border-dashed bg-transparent hover:bg-sky-400/15 hover:border-sky-500/80';
}

function boxTitle(el: SlideElement, ui: ElementUiState): string {
  if (ui.selection === 'deselected') return `${el.type} — deselected (click to restore)`;
  if (ui.selection === 'wand-selected') {
    if (ui.status === 'loading') return `${el.type} — extracting…`;
    if (ui.status === 'error') return `${el.type} — extraction failed (click to retry)`;
    return `${el.type} — extracted (⌘+click to remove)`;
  }
  if (el.isTextual) return `${el.type} — auto-extracted (⌘+click to remove)`;
  return `${el.type} — click to extract with the wand`;
}

export default function SlideCanvas({ slide, pageSize, thumbnail, uiStates, onElementClick }: Props) {
  const reverseMode = useModifierHeld();

  // Overlapping boxes: the smallest element wins clicks and hover, like in design tools.
  const zIndexOf = useMemo(() => {
    const byAreaDesc = [...slide.elements].sort(
      (a, b) =>
        b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height,
    );
    return new Map(byAreaDesc.map((el, i) => [el.elementId, i + 1]));
  }, [slide]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/5"
      style={{
        aspectRatio: `${pageSize.width} / ${pageSize.height}`,
        cursor: reverseMode ? WAND_CURSOR_REVERSE : WAND_CURSOR,
      }}
    >
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail.url}
          alt={`Slide ${slide.index + 1}`}
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-slate-200" />
      )}
      {slide.elements.map((el) => {
        const ui = uiStates[el.elementId] ?? defaultUiState(el);
        return (
          <div
            key={el.elementId}
            title={boxTitle(el, ui)}
            className={`absolute rounded-sm transition-colors ${boxClasses(el, ui)}`}
            style={{ ...boxStyle(el, pageSize), zIndex: zIndexOf.get(el.elementId) }}
            onClick={(e) => {
              e.stopPropagation();
              onElementClick(el, e.metaKey || e.ctrlKey);
            }}
          />
        );
      })}
    </div>
  );
}
