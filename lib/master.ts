import type { ElementUiState, PresentationData } from './types';
import { defaultUiState, effectiveContent } from './types';

/**
 * The master document: every non-deselected element with content, across all
 * slides, in reading order. Slide titles are folded into the slide headings.
 */
export function buildMasterMarkdown(
  pres: PresentationData,
  uiStates: Record<string, ElementUiState>,
): string {
  const parts: string[] = [`# ${pres.title}`];
  for (const slide of pres.slides) {
    const body: string[] = [];
    let titleLine: string | null = null;
    for (const el of slide.elements) {
      const ui = uiStates[el.elementId] ?? defaultUiState(el);
      if (ui.selection === 'deselected') continue;
      const isIncluded =
        el.isTextual || (ui.selection === 'wand-selected' && ui.status === 'done');
      if (!isIncluded) continue;
      const raw = effectiveContent(el, ui);
      if (!raw) continue;
      if (el.role === 'title' && titleLine === null) {
        const [first, ...rest] = raw.split('\n');
        titleLine = first.trim().replace(/^#+\s*/, '');
        const restText = rest.join('\n').trim();
        if (restText) body.push(restText);
      } else {
        body.push(raw);
      }
    }
    if (titleLine === null && body.length === 0) continue;
    parts.push(`## Slide ${slide.index + 1}${titleLine ? `: ${titleLine}` : ''}`);
    parts.push(...body);
  }
  return parts.join('\n\n') + '\n';
}

export function wordCount(markdown: string): number {
  const words = markdown.replace(/[#|*`>_-]+/g, ' ').trim().split(/\s+/);
  return words[0] === '' ? 0 : words.length;
}
