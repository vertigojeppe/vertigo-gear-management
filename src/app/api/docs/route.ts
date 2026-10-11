import { NextResponse } from "next/server";

/** Interactive API docs (Scalar) reading /api/openapi.json. */
export function GET() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vertigo Gear API</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.60/dist/browser/standalone.min.js"></script>
  <script>
    Scalar.createApiReference("#app", { url: "/api/openapi.json", hideDownloadButton: false });
  </script>
</body>
</html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
