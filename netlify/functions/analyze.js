// Vantage backend proxy — holds the Gemini API key as a server-side secret.
// The browser never sees this key. Set GEMINI_API_KEY in Netlify's
// Site settings -> Environment variables (never commit it to the repo).

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server is not configured with a Gemini API key yet.' })
      };
    }

    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: event.body
      }
    );

    const bodyText = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: { 'Content-Type': 'application/json' },
      body: bodyText
    };
  } catch (err) {
    // Catches anything unexpected (not just the fetch call) so the client
    // always gets readable JSON instead of a bare platform 500.
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Vantage backend error: ' + (err && err.message ? err.message : String(err)),
        stack: err && err.stack ? String(err.stack).split('\n').slice(0, 3).join(' | ') : undefined
      })
    };
  }
};
