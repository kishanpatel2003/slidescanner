import type { slides_v1 } from 'googleapis';
import type {
  BoundingBox,
  ElementType,
  PresentationData,
  SlideData,
  SlideElement,
} from './types';

const EMU_PER_PT = 12700;

interface Affine {
  scaleX: number;
  scaleY: number;
  shearX: number;
  shearY: number;
  translateX: number;
  translateY: number;
}

const IDENTITY: Affine = { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: 0, translateY: 0 };

function toEmu(magnitude: number | null | undefined, unit: string | null | undefined): number {
  if (magnitude == null) return 0;
  return unit === 'PT' ? magnitude * EMU_PER_PT : magnitude;
}

function fromApiTransform(t: slides_v1.Schema$AffineTransform | undefined): Affine {
  if (!t) return IDENTITY;
  return {
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
    shearX: t.shearX ?? 0,
    shearY: t.shearY ?? 0,
    translateX: toEmu(t.translateX, t.unit),
    translateY: toEmu(t.translateY, t.unit),
  };
}

/** parent ∘ child: apply child first, then parent. */
function compose(p: Affine, c: Affine): Affine {
  return {
    scaleX: p.scaleX * c.scaleX + p.shearX * c.shearY,
    shearX: p.scaleX * c.shearX + p.shearX * c.scaleY,
    shearY: p.shearY * c.scaleX + p.scaleY * c.shearY,
    scaleY: p.shearY * c.shearX + p.scaleY * c.scaleY,
    translateX: p.scaleX * c.translateX + p.shearX * c.translateY + p.translateX,
    translateY: p.shearY * c.translateX + p.scaleY * c.translateY + p.translateY,
  };
}

function elementBox(el: slides_v1.Schema$PageElement, transform: Affine): BoundingBox {
  const w = toEmu(el.size?.width?.magnitude, el.size?.width?.unit);
  const h = toEmu(el.size?.height?.magnitude, el.size?.height?.unit);
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => [
    transform.scaleX * x + transform.shearX * y + transform.translateX,
    transform.shearY * x + transform.scaleY * y + transform.translateY,
  ]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function unionBoxes(boxes: BoundingBox[]): BoundingBox {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Convert a Slides text frame to markdown, preserving paragraphs and bullet nesting. */
export function textToMarkdown(text: slides_v1.Schema$TextContent | undefined): string {
  if (!text?.textElements) return '';
  interface Para {
    prefix: string;
    text: string;
    bullet: boolean;
  }
  const paras: Para[] = [];
  let cur: Para | null = null;
  for (const te of text.textElements) {
    if (te.paragraphMarker) {
      const bullet = te.paragraphMarker.bullet;
      const level = bullet?.nestingLevel ?? 0;
      cur = { prefix: bullet ? '  '.repeat(level) + '- ' : '', text: '', bullet: !!bullet };
      paras.push(cur);
    } else {
      const content = te.textRun?.content ?? te.autoText?.content ?? '';
      if (!content) continue;
      if (!cur) {
        cur = { prefix: '', text: '', bullet: false };
        paras.push(cur);
      }
      cur.text += content;
    }
  }
  const lines: string[] = [];
  let prevBullet = false;
  for (const p of paras) {
    //  is a soft line break inside a paragraph; \n terminates the paragraph.
    const body = p.text.replace(/\n+$/g, '').replace(//g, '\n').trim();
    if (!body) continue;
    if (lines.length > 0) lines.push(p.bullet && prevBullet ? '' : '\n');
    lines.push(p.prefix + body);
    prevBullet = p.bullet;
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function tableToMarkdown(table: slides_v1.Schema$Table): string {
  const rows = (table.tableRows ?? []).map((row) =>
    (row.tableCells ?? []).map((cell) =>
      textToMarkdown(cell.text).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim(),
    ),
  );
  if (rows.length === 0) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? '');
  const line = (r: string[]) => `| ${pad(r).join(' | ')} |`;
  const [header, ...body] = rows;
  return [
    line(header),
    `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`,
    ...body.map(line),
  ].join('\n');
}

function placeholderRole(shape: slides_v1.Schema$Shape): SlideElement['role'] {
  const type = shape.placeholder?.type;
  if (type === 'TITLE' || type === 'CENTERED_TITLE') return 'title';
  if (type === 'SUBTITLE') return 'subtitle';
  if (type) return 'body';
  return null;
}

interface Leaf {
  isText: boolean;
  content: string;
}

/** Collect leaf content of a group to decide whether it is pure text. */
function groupLeaves(el: slides_v1.Schema$PageElement): Leaf[] {
  if (el.elementGroup) {
    return (el.elementGroup.children ?? []).flatMap(groupLeaves);
  }
  if (el.shape) {
    const content = textToMarkdown(el.shape.text);
    return [{ isText: content.length > 0, content }];
  }
  if (el.line) return [];
  return [{ isText: false, content: '' }];
}

function normalizeElement(
  el: slides_v1.Schema$PageElement,
  parent: Affine,
): SlideElement | null {
  const transform = compose(parent, fromApiTransform(el.transform ?? undefined));
  const description = el.description || el.title || null;

  const make = (
    type: ElementType,
    box: BoundingBox,
    opts: Partial<SlideElement> = {},
  ): SlideElement => ({
    elementId: el.objectId ?? '',
    type,
    role: null,
    boundingBox: box,
    isTextual: false,
    extractedContent: null,
    extractionSource: null,
    description,
    ...opts,
  });

  if (el.line) return null; // connectors and dividers: decoration, never extraction targets

  if (el.elementGroup) {
    const children = (el.elementGroup.children ?? [])
      .map((c) => normalizeElement(c, transform))
      .filter((c): c is SlideElement => c !== null);
    if (children.length === 0) return null;
    const box = unionBoxes(children.map((c) => c.boundingBox));
    const leaves = groupLeaves(el);
    const allText = leaves.length > 0 && leaves.every((l) => l.isText);
    if (allText) {
      const content = children
        .filter((c) => c.extractedContent)
        .sort(readingOrderCompare)
        .map((c) => c.extractedContent)
        .join('\n\n');
      return make('text', box, { isTextual: true, extractedContent: content, extractionSource: 'api-text' });
    }
    return make('group', box);
  }

  const box = elementBox(el, transform);
  if (box.width <= 0 || box.height <= 0) return null;

  if (el.shape) {
    const content = textToMarkdown(el.shape.text);
    if (content) {
      return make('text', box, {
        role: placeholderRole(el.shape),
        isTextual: true,
        extractedContent: content,
        extractionSource: 'api-text',
      });
    }
    return make('shape', box); // empty decorative shape; wand-able just in case
  }
  if (el.table) {
    const content = tableToMarkdown(el.table);
    return make('table', box, {
      isTextual: content.length > 0,
      extractedContent: content || null,
      extractionSource: content ? 'api-text' : null,
    });
  }
  if (el.image) return make('image', box);
  if (el.sheetsChart) return make('chart', box);
  if (el.video) return make('video', box);
  if (el.wordArt) {
    const content = el.wordArt.renderedText ?? '';
    return make('text', box, {
      isTextual: content.length > 0,
      extractedContent: content || null,
      extractionSource: content ? 'api-text' : null,
    });
  }
  return null;
}

/** Top-to-bottom rows (5% page-height tolerance), left-to-right within a row; title always first. */
function readingOrderCompare(a: SlideElement, b: SlideElement): number {
  if ((a.role === 'title') !== (b.role === 'title')) return a.role === 'title' ? -1 : 1;
  const rowTolerance = 457200; // ~0.5 inch in EMU
  const rowA = Math.round(a.boundingBox.y / rowTolerance);
  const rowB = Math.round(b.boundingBox.y / rowTolerance);
  if (rowA !== rowB) return rowA - rowB;
  return a.boundingBox.x - b.boundingBox.x;
}

export function normalizePresentation(pres: slides_v1.Schema$Presentation): PresentationData {
  const pageSize = {
    width: toEmu(pres.pageSize?.width?.magnitude, pres.pageSize?.width?.unit),
    height: toEmu(pres.pageSize?.height?.magnitude, pres.pageSize?.height?.unit),
  };
  const slides: SlideData[] = (pres.slides ?? []).map((slide, index) => {
    const elements = (slide.pageElements ?? [])
      .map((el) => normalizeElement(el, IDENTITY))
      .filter((el): el is SlideElement => el !== null)
      .sort(readingOrderCompare);
    return { slideId: slide.objectId ?? `slide-${index}`, index, elements };
  });
  return {
    presentationId: pres.presentationId ?? '',
    title: pres.title ?? 'Untitled presentation',
    pageSize,
    slides,
  };
}
