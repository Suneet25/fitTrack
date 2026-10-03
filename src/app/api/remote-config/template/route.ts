import { NextResponse } from "next/server";
import { remoteConfigTemplate } from "@/config/remote-config";

/**
 * Development only: the Remote Config schema as a template file.
 * Firebase console → Remote Config → ⋮ → "Publish from a file" accepts it as-is.
 */
export function GET() {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  return new NextResponse(JSON.stringify(remoteConfigTemplate(), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="remoteconfig.template.json"',
    },
  });
}
