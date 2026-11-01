/**
 * Shared utility helpers for SahajSkill.
 *
 *  - {@link sanitizeDriveLink}  Convert Google Drive share/view links into
 *    embeddable `/preview` URLs (REQ-2.1).
 *  - {@link uploadToImgBB}      Upload an image to the ImgBB CDN and return the
 *    hosted URL (REQ-1.3).
 */

/* -------------------------------------------------------------------------- */
/*                         Google Drive link sanitizer                        */
/* -------------------------------------------------------------------------- */

/**
 * Normalize a Google Drive link into an embeddable preview URL.
 *
 * Supported input shapes:
 *   - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   - https://drive.google.com/file/d/FILE_ID/preview
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID&export=download
 *   - https://docs.google.com/document/d/FILE_ID/edit
 *
 * Non-Drive links (GitHub raw, YouTube, etc.) are returned unchanged so the
 * same helper can be used as a pass-through sanitizer for any file_url.
 */
export function sanitizeDriveLink(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  const url = rawUrl.trim();

  // Only transform Google Drive / Docs hosts; leave everything else intact.
  const isGoogleHost =
    url.includes("drive.google.com") || url.includes("docs.google.com");
  if (!isGoogleHost) return url;

  const fileId = extractDriveFileId(url);
  if (!fileId) return url;

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** Extract the Drive file id from the common Google Drive/Docs URL formats. */
function extractDriveFileId(url: string): string | null {
  // .../d/FILE_ID/...  (file, document, spreadsheets, presentation)
  const pathMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  // ...?id=FILE_ID  or  &id=FILE_ID  (open?id=, uc?id=)
  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  return null;
}

/* -------------------------------------------------------------------------- */
/*                               ImgBB uploader                               */
/* -------------------------------------------------------------------------- */

export interface ImgBBResult {
  url: string;
  deleteUrl: string | null;
  thumbUrl: string | null;
}

/**
 * Upload an image to ImgBB and return the hosted CDN URL.
 *
 * @param image     Base64-encoded image data (no `data:` prefix), a raw image
 *                  URL, or a File/Blob to upload.
 * @param apiKey    ImgBB API key. Defaults to `process.env.IMGBB_API_KEY`.
 *
 * Reference: ImgBB API — POST https://api.imgbb.com/1/upload
 */
export async function uploadToImgBB(
  image: string | Blob,
  apiKey: string | undefined = process.env.IMGBB_API_KEY
): Promise<ImgBBResult> {
  if (!apiKey) {
    throw new Error(
      "IMGBB_API_KEY is not set. Add it to your .env.local file."
    );
  }

  const form = new FormData();
  form.append("key", apiKey);

  if (typeof image === "string") {
    // ImgBB accepts a base64 string or an image URL in the `image` field.
    form.append("image", stripDataUrlPrefix(image));
  } else {
    form.append("image", image);
  }

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });

  const payload = (await res.json()) as {
    success?: boolean;
    data?: {
      url?: string;
      display_url?: string;
      delete_url?: string;
      thumb?: { url?: string };
    };
    error?: { message?: string };
  };

  if (!res.ok || !payload.success || !payload.data?.url) {
    const message =
      payload.error?.message ?? `ImgBB upload failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  return {
    url: payload.data.display_url ?? payload.data.url,
    deleteUrl: payload.data.delete_url ?? null,
    thumbUrl: payload.data.thumb?.url ?? null,
  };
}

/** Remove a leading `data:image/...;base64,` prefix if present. */
function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex !== -1) {
    return value.slice(commaIndex + 1);
  }
  return value;
}
