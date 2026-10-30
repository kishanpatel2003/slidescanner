import { NextRequest, NextResponse } from 'next/server';
import { getSlidesClient, googleErrorMessage, parsePresentationId } from '@/lib/google';
import { normalizePresentation } from '@/lib/normalize';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get('id');
  if (!input) {
    return NextResponse.json({ error: 'Missing ?id= (Slides URL or presentation ID)' }, { status: 400 });
  }
  const presentationId = parsePresentationId(input);
  if (!presentationId) {
    return NextResponse.json({ error: 'That does not look like a Google Slides URL or ID' }, { status: 400 });
  }
  if (process.env.MOCK_DECK === '1') {
    const { mockPresentation } = await import('@/lib/mock');
    return NextResponse.json(mockPresentation);
  }
  try {
    const slides = await getSlidesClient();
    const res = await slides.presentations.get({ presentationId });
    return NextResponse.json(normalizePresentation(res.data));
  } catch (err) {
    const { status, message } = googleErrorMessage(err);
    return NextResponse.json({ error: message }, { status });
  }
}
