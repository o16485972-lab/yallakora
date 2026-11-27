const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export function GET() {
  return Response.json(
    { message: "Hello from vinext on Cloudflare Workers", app: "yallaakora" },
    { headers: CORS }
  );
}
