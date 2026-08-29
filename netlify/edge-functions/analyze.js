// Vantage backend proxy — Edge Function version.
// Edge Functions have a 40s response-header timeout (vs 10s for standard
// serverless Functions), and time spent waiting on Gemini doesn't count
// against the CPU-time limit — much better fit for a sometimes-slow
// free-tier AI API call.
//
// Env var access on Edge Functions uses Netlify.env.get(), NOT process.env.
// Set GEMINI_API_KEY in Site settings -> Environment variables as before.

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

    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body
      }
    );

    const bodyText = await upstream.text();

    return new Response(bodyText, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Vantage backend error: ' + (err && err.message ? err.message : String(err))
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: '/api/analyze' };
