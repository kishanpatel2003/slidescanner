'use client';

import { useRef } from 'react';
import type { ElementUiState, SlideData, SlideElement } from '@/lib/types';
import { defaultUiState, effectiveContent } from '@/lib/types';
import MarkdownBlock, { type MarkdownBlockHandle } from './MarkdownBlock';

interface Props {
  slide: SlideData;
  uiStates: Record<string, ElementUiState>;
  onDelete: (el: SlideElement) => void;
  onRetry: (el: SlideElement) => void;
  onEdit: (el: SlideElement, markdown: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  chart: 'Chart',
  group: 'Grouped shapes',
  shape: 'Shape',
  video: 'Video',
  table: 'Table',
};

function IconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 ${
        danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-slate-100 hover:text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
    </svg>
  );
}

interface BlockProps {
  el: SlideElement;
  ui: ElementUiState;
  onDelete: () => void;
  onRetry: () => void;
  onEdit: (markdown: string) => void;
}

function badge(el: SlideElement): { label: string; classes: string } {
  if (el.isTextual) {
    return {
      label: el.type === 'table' ? 'table · auto' : 'text · auto',
      classes: 'bg-emerald-100 text-emerald-700',
    };
  }
  return {
    label: `${TYPE_LABEL[el.type] ?? el.type} · vision`,
    classes: 'bg-violet-100 text-violet-700',
  };
}

function ContentBlock({ el, ui, onDelete, onRetry, onEdit }: BlockProps) {
  const editorRef = useRef<MarkdownBlockHandle>(null);
  const { label, classes } = badge(el);
  const border = el.isTextual ? 'border-emerald-200' : 'border-violet-200';
  const content = effectiveContent(el, ui);
  const loading = !el.isTextual && ui.status === 'loading';
  const failed = !el.isTextual && ui.status === 'error';
  const decorative = !el.isTextual && ui.status === 'done' && !content;

  return (
    <div className={`group rounded-lg border ${border} bg-white p-3 shadow-sm`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${classes}`}
        >
          {label}
        </span>
        {el.role === 'title' && (
          <span className="text-[10px] uppercase tracking-wide text-slate-400">title</span>
        )}
        {ui.userEdited && (
          <span
            title="Edited by you"
            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
          >
            edited
          </span>
        )}
        <span className="flex-1" />
        {!loading && !failed && !decorative && (
          <IconButton onClick={() => editorRef.current?.focus()} title="Edit">
            <PencilIcon />
          </IconButton>
        )}
        {!loading && (
          <IconButton onClick={onDelete} title="Remove from document" danger>
            <TrashIcon />
          </IconButton>
        )}
      </div>
      {loading && (
        <div className="py-1">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-500">
            <span className="vision-sparkle">✦</span>
            <span>Reading the visual…</span>
            <span className="vision-sparkle vision-sparkle-delayed text-[9px]">✦</span>
          </div>
          <div className="space-y-2">
            <div className="vision-shimmer h-3 w-4/5 rounded" />
            <div className="vision-shimmer h-3 w-full rounded" />
            <div className="vision-shimmer h-3 w-2/3 rounded" />
          </div>
        </div>
      )}
      {failed && (
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap text-xs text-red-600">{ui.error ?? 'Extraction failed'}</p>
          <button
            onClick={onRetry}
            className="shrink-0 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}
      {decorative && (
        <p className="text-sm italic text-slate-400">
          Model judged this element decorative — nothing to extract.
        </p>
      )}
      {!loading && !failed && !decorative && (
        // Vision results materialize with a brief reveal (text blocks render plain).
        <div className={el.isTextual ? undefined : 'vision-appear'}>
          <MarkdownBlock ref={editorRef} value={content} onChange={onEdit} />
        </div>
      )}
    </div>
  );
}

export default function SidePane({ slide, uiStates, onDelete, onRetry, onEdit }: Props) {
  const states = slide.elements.map((el) => ({
    el,
    ui: uiStates[el.elementId] ?? defaultUiState(el),
  }));
  const blocks = states.filter(
    ({ el, ui }) =>
      ui.selection !== 'deselected' &&
      ((el.isTextual && effectiveContent(el, ui)) ||
        (!el.isTextual && ui.selection === 'wand-selected')),
  );
  const awaitingWand = states.filter(({ el, ui }) => !el.isTextual && ui.selection === 'unselected');
  const deselectedCount = states.filter(({ ui }) => ui.selection === 'deselected').length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {blocks.length === 0 && awaitingWand.length === 0 && (
        <p className="text-sm text-slate-400">Nothing extractable on this slide.</p>
      )}
      {blocks.map(({ el, ui }) => (
        <ContentBlock
          key={el.elementId}
          el={el}
          ui={ui}
          onDelete={() => onDelete(el)}
          onRetry={() => onRetry(el)}
          onEdit={(markdown) => onEdit(el, markdown)}
        />
      ))}
      {(awaitingWand.length > 0 || deselectedCount > 0) && (
        <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs text-slate-500">
            {awaitingWand.length > 0 && (
              <>
                {awaitingWand.length} visual{awaitingWand.length > 1 ? 's' : ''} awaiting the wand (
                {awaitingWand.map(({ el }) => TYPE_LABEL[el.type] ?? el.type).join(', ')}) — click
                them on the slide to extract.
              </>
            )}
            {awaitingWand.length > 0 && deselectedCount > 0 && ' '}
            {deselectedCount > 0 && (
              <>
                {deselectedCount} element{deselectedCount > 1 ? 's' : ''} deselected — ⌘+click on the
                slide to restore.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
