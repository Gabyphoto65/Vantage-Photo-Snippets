// Add Vantage backend proxy — Edge Function, non-streaming version.
// Calls Gemini's regular generateContent endpoint and waits for the full
// response, then extracts the model's text output and returns it as plain
// text (the client parses one JSON snippet per line from it).
//
// This trades away progressive/streaming display for a simpler, more
// reliable request: it either fully succeeds or fully fails, with no
// risk of a mid-stream cutoff from the platform's execution ceiling
// hitting partway through a response.
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

  try {
    const body = await request.text();

    // Netlify kills this whole function at 40s with a generic, uninformative
    // message. Timing out a few seconds earlier, on our own terms, means a
    // slow/overloaded Gemini shows up as a clear, fast error instead of a
    // silent multi-second hang that ends in "the edge function timed out."
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 32000);

    let upstream;
    try {
      upstream = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body,
          signal: controller.signal
        }
      );
    } catch (fetchErr) {
      if (fetchErr && fetchErr.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Gemini did not respond within 32 seconds. This usually means Google\'s API is under heavy load right now (common on shared free-tier keys with several people testing at once) — wait a bit and try again.' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return new Response(errText || JSON.stringify({ error: 'Upstream request failed' }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await upstream.json();
    const text = data && data.candidates && data.candidates[0]
      && data.candidates[0].content && data.candidates[0].content.parts
      && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No response text from model' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Vantage backend error: ' + (err && err.message ? err.message : String(err)) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: '/api/analyze' };
