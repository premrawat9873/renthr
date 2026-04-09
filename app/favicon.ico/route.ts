import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const iconPath = path.join(process.cwd(), "public", "favicon.ico");
  const iconBuffer = await fs.readFile(iconPath);

  return new Response(iconBuffer, {
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
