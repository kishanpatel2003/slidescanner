import type { ElementType } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const DEFAULT_VISION_MODEL = 'claude-sonnet-4-6';

export function visionModel(): string {
  return process.env.VISION_MODEL || DEFAULT_VISION_MODEL;
}

const OUTPUT_RULES =
  'Return ONLY the extracted markdown content. No preamble, no commentary, no code fences ' +
  'around the whole answer. If the element contains no meaningful content (purely decorative), ' +
  'return the single word: DECORATIVE';

const PROMPTS: Record<string, string> = {
  chart:
    'This is a chart from a presentation slide. Describe the data shown: chart type, axes, ' +
    'data series, key values, and any trends or comparisons the chart communicates. ' +
    'Use a markdown list or table for the data.',
  table:
    'This is a table from a presentation slide. Extract it into markdown table format. ' +
    'Preserve all rows, columns, headers, and cell values exactly.',
  diagram:
    'This is a diagram from a presentation slide. Describe the structure, relationships, and ' +
    'flow it shows. Preserve hierarchy and directionality. Use markdown headers, lists, and ' +
    'arrows (->) to represent the structure. Transcribe all labels exactly.',
  image:
    'This is a visual element from a presentation slide. First identify what it is - a diagram/' +
    'flowchart, a table, a chart/graph, a screenshot of a UI, or a general image - then extract ' +
    'accordingly:\n' +
    '- Diagram/flowchart: describe structure, relationships, and flow; use lists and arrows (->); transcribe all labels.\n' +
    '- Table: extract as a markdown table, preserving every row, column, and value.\n' +
    '- Chart/graph: describe chart type, axes, series, key values, and trends.\n' +
    '- Screenshot/UI: describe what it shows, extract all visible text, note layout and key UI elements.\n' +
    '- General image: describe it in detail relevant to the presentation context.',
};

function promptFor(elementType: ElementType): string {
  if (elementType === 'chart') return PROMPTS.chart;
  if (elementType === 'table') return PROMPTS.table;
  if (elementType === 'group' || elementType === 'shape') return PROMPTS.diagram;
  return PROMPTS.image;
}

export interface ExtractParams {
  pngBase64: string;
  elementType: ElementType;
  description: string | null;
  slideContext: string | null;
}

export async function extractWithVision(params: ExtractParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('No vision model credentials. Set ANTHROPIC_API_KEY in .env.');
  }

  const contextLines = [
    params.slideContext ? `Slide context: ${params.slideContext}` : null,
    params.description ? `Author-provided alt text: ${params.description}` : null,
  ].filter(Boolean);

  const prompt = [
    promptFor(params.elementType),
    ...contextLines,
    OUTPUT_RULES,
  ].join('\n\n');

  const body = JSON.stringify({
    model: visionModel(),
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: params.pngBase64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': apiKey,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, { method: 'POST', headers, body, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision model error (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Vision model returned an empty response');
  return text;
}
