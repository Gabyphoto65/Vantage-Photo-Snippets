// Add Vantage backend proxy — Edge Function, streaming version.
// Calls Gemini's streamGenerateContent endpoint and re-emits the growing
// text output as plain text chunks (stripping Gemini's SSE envelope), so
// the client can render each snippet the moment its line is complete
// rather than waiting for the whole response.
//
// Env var access on Edge Functions uses Netlify.env.get(), NOT process.env.

export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server is not configured with a Gemini API key yet.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let upstream;
  try {
    const body = await request.text();
    upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Vantage backend error: ' + (err && err.message ? err.message : String(err)) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // If Gemini rejected the request outright (bad key, rate limit, overload),
  // pass that error straight through as JSON — same shape the client's
  // existing error handling already expects, no streaming involved.
  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    return new Response(errText || JSON.stringify({ error: 'Upstream request failed' }), {
      status: upstream.status || 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep the possibly-incomplete last line for next chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed && parsed.candidates && parsed.candidates[0]
            && parsed.candidates[0].content && parsed.candidates[0].content.parts
            && parsed.candidates[0].content.parts[0] && parsed.candidates[0].content.parts[0].text;
          if (text) controller.enqueue(encoder.encode(text));
        } catch (e) {
          // Malformed or partial SSE chunk — skip it, more will arrive.
        }
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};

export const config = { path: '/api/analyze' };
