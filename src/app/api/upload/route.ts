import { NextResponse, type NextRequest } from "next/server";
import { uploadToImgBB } from "@/lib/helpers";

/**
 * POST /api/upload  —  Image upload to the ImgBB CDN (REQ-1.3).
 *
 * Accepts either:
 *   - multipart/form-data with a `file` (or `image`) field, or
 *   - application/json with `{ image: "<base64 or image url>" }`.
 *
 * Returns the hosted CDN URL that the admin stores in Turso
 * (e.g. classes.banner_url, subjects.icon_url, materials.thumbnail_url).
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.IMGBB_API_KEY || process.env.IMGBB_API_KEY === "your-imgbb-key") {
    return NextResponse.json(
      {
        error:
          "IMGBB_API_KEY is not configured. Set it in .env.local to enable image uploads.",
      },
      { status: 503 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let image: string | Blob | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const candidate = form.get("file") ?? form.get("image");

      if (candidate instanceof Blob) {
        image = candidate;
      } else if (typeof candidate === "string") {
        image = candidate;
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.image === "string") {
        image = body.image;
      }
    }

    if (!image) {
      return NextResponse.json(
        {
          error:
            "No image provided. Send a `file`/`image` field (multipart) or `{ image }` (JSON).",
        },
        { status: 400 }
      );
    }

    const result = await uploadToImgBB(image);

    return NextResponse.json({
      success: true,
      url: result.url,
      thumb_url: result.thumbUrl,
      delete_url: result.deleteUrl,
    });
  } catch (err) {
    console.error("[/api/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
