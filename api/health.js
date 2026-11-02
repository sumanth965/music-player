export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'Swar Video API Operational',
    version: '1.0.0',
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString(),
  });
};
