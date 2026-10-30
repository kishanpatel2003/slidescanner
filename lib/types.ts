export type ElementType =
  | 'text'
  | 'image'
  | 'table'
  | 'chart'
  | 'shape'
  | 'group'
  | 'video';

export type ElementState = 'auto-selected' | 'unselected' | 'wand-selected' | 'deselected';

export type ExtractionSource = 'api-text' | 'vision-model';

/** Absolute position on the slide, in EMU (1 pt = 12700 EMU). */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlideElement {
  elementId: string;
  type: ElementType;
  /** Placeholder role from the layout, when Slides knows it. */
  role: 'title' | 'subtitle' | 'body' | null;
  boundingBox: BoundingBox;
  /** True when content came straight from the Slides API (text boxes, native tables). */
  isTextual: boolean;
  extractedContent: string | null;
  extractionSource: ExtractionSource | null;
  /** Alt text on the element, useful context for vision extraction. */
  description: string | null;
}

export interface SlideData {
  slideId: string;
  index: number;
  /** Sorted in reading order (top to bottom, left to right; title first). */
  elements: SlideElement[];
}

export interface PresentationData {
  presentationId: string;
  title: string;
  /** Slide page size in EMU. */
  pageSize: { width: number; height: number };
  slides: SlideData[];
}

export interface ThumbnailData {
  url: string;
  width: number;
  height: number;
}

export type ExtractionStatus = 'idle' | 'loading' | 'done' | 'error';

/** Client-side wand/selection state, keyed by elementId (unique per presentation). */
export interface ElementUiState {
  selection: ElementState;
  /**
   * Current markdown for the element. Starts null; set by vision extraction or user edits.
   * Effective content is `content ?? element.extractedContent`.
   */
  content: string | null;
  status: ExtractionStatus;
  error: string | null;
  userEdited: boolean;
}

export function defaultUiState(el: SlideElement): ElementUiState {
  return {
    selection: el.isTextual ? 'auto-selected' : 'unselected',
    content: null,
    status: 'idle',
    error: null,
    userEdited: false,
  };
}

/** The markdown an element currently contributes to the document. */
export function effectiveContent(el: SlideElement, ui: ElementUiState): string {
  return (ui.content ?? el.extractedContent ?? '').trim();
}
