import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getSlideThumbnail, googleErrorMessage } from '@/lib/google';
import { extractWithVision } from '@/lib/vision';
import type { BoundingBox, ElementType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

interface ExtractRequest {
  presentationId: string;
  pageId: string;
  elementType: ElementType;
  /** Element bounding box, in EMU. */
  boundingBox: BoundingBox;
  /** Slide page size, in EMU. */
  pageSize: { width: number; height: number };
  description?: string | null;
  slideContext?: string | null;
}

// Slightly widen the crop so cut-off labels and axis text survive.
const PAD_FRACTION = 0.015;
// Upscale small crops so text stays legible for the vision model.
const MIN_CROP_WIDTH = 512;

async function cropElement(
  thumbnailUrl: string,
  box: BoundingBox,
  pageSize: { width: number; height: number },
): Promise<Buffer> {
  const res = await fetch(thumbnailUrl);
  if (!res.ok) throw new Error(`Failed to fetch slide thumbnail (${res.status})`);
  const png = Buffer.from(await res.arrayBuffer());
  const image = sharp(png);
  const meta = await image.metadata();
  const tw = meta.width ?? 0;
  const th = meta.height ?? 0;
  if (!tw || !th) throw new Error('Could not read thumbnail dimensions');

  const padX = tw * PAD_FRACTION;
  const padY = th * PAD_FRACTION;
  const left = Math.max(0, Math.floor((box.x / pageSize.width) * tw - padX));
  const top = Math.max(0, Math.floor((box.y / pageSize.height) * th - padY));
  const right = Math.min(tw, Math.ceil(((box.x + box.width) / pageSize.width) * tw + padX));
  const bottom = Math.min(th, Math.ceil(((box.y + box.height) / pageSize.height) * th + padY));
  const width = right - left;
  const height = bottom - top;
  if (width < 4 || height < 4) throw new Error('Element region is too small to extract');

  let cropped = image.extract({ left, top, width, height });
  if (width < MIN_CROP_WIDTH) {
    cropped = cropped.resize({ width: MIN_CROP_WIDTH, kernel: 'lanczos3' });
  }
  return cropped.png().toBuffer();
}

export async function POST(req: NextRequest) {
  let body: ExtractRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { presentationId, pageId, elementType, boundingBox, pageSize } = body;
  if (!presentationId || !pageId || !elementType || !boundingBox || !pageSize) {
    return NextResponse.json(
      { error: 'Missing required fields: presentationId, pageId, elementType, boundingBox, pageSize' },
      { status: 400 },
    );
  }
  if (process.env.MOCK_DECK === '1') {
    const { mockDelayMs, mockExtraction } = await import('@/lib/mock');
    await new Promise((r) => setTimeout(r, mockDelayMs()));
    return NextResponse.json({ markdown: mockExtraction(pageId, boundingBox) });
  }

  let pngBase64: string;
  try {
    const thumb = await getSlideThumbnail(presentationId, pageId);
    const crop = await cropElement(thumb.url, boundingBox, pageSize);
    pngBase64 = crop.toString('base64');
  } catch (err) {
    const { status, message } = googleErrorMessage(err);
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const markdown = await extractWithVision({
      pngBase64,
      elementType,
      description: body.description ?? null,
      slideContext: body.slideContext ?? null,
    });
    if (markdown === 'DECORATIVE') {
      return NextResponse.json({ markdown: '', decorative: true });
    }
    return NextResponse.json({ markdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision extraction failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
