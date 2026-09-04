interface Env {
  SCHEDULE_API_URL: string;
}

const jsonError = (message: string, status: number) =>
  Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SCHEDULE_API_URL) {
    return jsonError("Schedule API is not configured.", 503);
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonError("Method not allowed.", 405);
  }

  try {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(env.SCHEDULE_API_URL);
    upstreamUrl.search = incomingUrl.search;

    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      redirect: "follow",
      headers: {
        Accept: "application/json",
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: request.method === "POST" ? await request.text() : undefined,
    });

    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("Content-Type") || "application/json;charset=utf-8",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonError("The schedule service is temporarily unavailable.", 502);
  }
};
