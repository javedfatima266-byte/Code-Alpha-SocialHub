import app from '../index.js';

export default function handler(req, res) {
  const original = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'] || req.headers['x-forwarded-uri'];
  if (original && original.startsWith('/api')) {
    req.url = original;
  } else if (!req.url.startsWith('/api')) {
    const [_, search] = req.url.split('?');
    const qs = search ? `?${search}` : '';
    req.url = `/api/auth/logout${qs}`;
  }
  return app(req, res);
}

