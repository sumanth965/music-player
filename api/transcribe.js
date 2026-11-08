/**
 * api/transcribe.js
 * Serverless handler for Groq Cloud Whisper Audio-to-Text Transcription.
 * Uses GROQ_API_KEY from server environment variables without requiring any user input.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey =
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

  if (!apiKey) {
    return res.status(503).json({
      error: 'Groq Whisper API Key not configured on the server. Please add GROQ_API_KEY to your server environment variables.',
    });
  }

  try {
    // Read raw request buffer for multipart forwarding
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'multipart/form-data';

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': contentType,
      },
      body: bodyBuffer,
    });

    const responseText = await groqResponse.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!groqResponse.ok) {
      return res.status(groqResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('[api/transcribe Error]', err);
    return res.status(500).json({ error: err.message || 'Audio transcription failed on server.' });
  }
}

