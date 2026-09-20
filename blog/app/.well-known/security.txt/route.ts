export const dynamic = "force-static";

export function GET() {
  return new Response(
    [
      "Contact: mailto:lthung.work.79@gmail.com",
      "Expires: 2027-09-20T00:00:00.000Z",
      "Preferred-Languages: en",
      "Canonical: https://blog.scaryspiderseo.com/.well-known/security.txt",
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
