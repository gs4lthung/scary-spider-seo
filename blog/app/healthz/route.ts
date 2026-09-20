import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const db = await getDb();
    await db.run(sql`SELECT 1`);

    return Response.json(
      { status: "ok", service: "blog", database: "ok" },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { status: "error", service: "blog", database: "unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
