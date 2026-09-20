export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok", service: "website" },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
