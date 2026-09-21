import { NextResponse } from "next/server";
import { getAllResources } from "@/lib/cloudflare-api";

export const runtime = "edge";

export async function GET() {
  try {
    const resources = await getAllResources();
    return NextResponse.json(resources);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
