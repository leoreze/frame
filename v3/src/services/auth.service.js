import crypto from 'crypto';

const COOKIE_NAME = 'frame_crm_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getSecret() {
  return process.env.CRM_SESSION_SECRET || process.env.OPENAI_API_KEY || 'frame-crm-dev-secret';
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function createSession(username) {
  const payload = {
    username,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function readCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

export function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authenticate(req, res, next) {
  const cookies = readCookies(req.headers.cookie || '');
  const session = verifySession(cookies[COOKIE_NAME]);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
  }
  req.crmUser = session;
  next();
}

export function requireCrmCredentials(username, password) {
  const expectedUser = process.env.CRM_USER || 'admin';
  const expectedPass = process.env.CRM_PASSWORD || '123456';
  return username === expectedUser && password === expectedPass;
}
