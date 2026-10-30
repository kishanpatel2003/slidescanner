import { google, slides_v1 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

let client: slides_v1.Slides | null = null;

/**
 * Slides client backed by Application Default Credentials.
 * Local dev: `gcloud auth application-default login --scopes=...` (see README section in CLAUDE.md).
 */
export async function getSlidesClient(): Promise<slides_v1.Slides> {
  if (!client) {
    const auth = new GoogleAuth({ scopes: SCOPES });
    client = google.slides({ version: 'v1', auth: (await auth.getClient()) as never });
  }
  return client;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

// Signed thumbnail URLs live ~30 min; cache for 25 so extract calls on the
// same slide reuse one getThumbnail quota hit.
const THUMBNAIL_TTL_MS = 25 * 60 * 1000;
const thumbnailCache = new Map<string, { thumb: Thumbnail; expiresAt: number }>();

export async function getSlideThumbnail(
  presentationId: string,
  pageId: string,
): Promise<Thumbnail> {
  const key = `${presentationId}/${pageId}`;
  const cached = thumbnailCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.thumb;
  const slides = await getSlidesClient();
  const res = await slides.presentations.pages.getThumbnail({
    presentationId,
    pageObjectId: pageId,
    'thumbnailProperties.thumbnailSize': 'LARGE',
    'thumbnailProperties.mimeType': 'PNG',
  });
  const thumb: Thumbnail = {
    url: res.data.contentUrl ?? '',
    width: res.data.width ?? 0,
    height: res.data.height ?? 0,
  };
  if (!thumb.url) throw new Error('Slides API returned no thumbnail URL');
  thumbnailCache.set(key, { thumb, expiresAt: Date.now() + THUMBNAIL_TTL_MS });
  return thumb;
}

/** Accepts a full Slides URL or a bare presentation ID. */
export function parsePresentationId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

const ADC_HINT =
  'Google auth failed. Run: gcloud auth application-default login ' +
  '--scopes=https://www.googleapis.com/auth/presentations.readonly,' +
  'https://www.googleapis.com/auth/drive.readonly,' +
  'https://www.googleapis.com/auth/cloud-platform';

export function googleErrorMessage(err: unknown): { status: number; message: string } {
  const e = err as { code?: number; response?: { status?: number }; message?: string };
  const status = e.code ?? e.response?.status ?? 500;
  if (status === 401) return { status, message: ADC_HINT };
  if (status === 403) {
    return {
      status,
      message:
        `Access denied by Google (403): ${e.message ?? 'no detail'}. ` +
        'Either you lack view access to this deck, or the ADC quota project does not have the Slides API enabled. ' +
        ADC_HINT,
    };
  }
  if (status === 404) return { status, message: 'Presentation not found. Check the URL.' };
  return { status: typeof status === 'number' && status >= 400 ? status : 500, message: e.message ?? 'Unknown Google API error' };
}
