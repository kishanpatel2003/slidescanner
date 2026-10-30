import { NextRequest, NextResponse } from 'next/server';
import { getSlideThumbnail, googleErrorMessage } from '@/lib/google';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const presentationId = req.nextUrl.searchParams.get('presentationId');
  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!presentationId || !pageId) {
    return NextResponse.json({ error: 'Missing presentationId or pageId' }, { status: 400 });
  }
  if (process.env.MOCK_DECK === '1') {
    const { mockThumbnail } = await import('@/lib/mock');
    const thumb = mockThumbnail(pageId);
    if (!thumb) return NextResponse.json({ error: 'Unknown mock slide' }, { status: 404 });
    return NextResponse.json(thumb);
  }
  try {
    const thumb = await getSlideThumbnail(presentationId, pageId);
    return NextResponse.json(thumb);
  } catch (err) {
    const { status, message } = googleErrorMessage(err);
    return NextResponse.json({ error: message }, { status });
  }
}
