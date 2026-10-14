/**
 * Netlify Serverless Function for PANDIRSTORE.ID Admin Authentication
 *
 * Runs 100% natively on Netlify without needing an external Express server.
 * Handles:
 * - POST /api/auth/login or /.netlify/functions/auth
 * - POST /api/auth/verify or /.netlify/functions/auth
 * - POST /api/auth/logout or /.netlify/functions/auth
 * - GET  /api/auth (Health check)
 *
 * Security Features:
 * 1. 100% Server-side credential validation against Netlify environment variables.
 * 2. Constant-time string comparison (timingSafeEqual) to prevent timing attacks.
 * 3. Cryptographically signed JWT tokens (HMAC-SHA256) with expiration timestamps.
 * 4. Zero external npm dependencies - uses native Node.js crypto module.
 * 5. Dynamic CORS origin reflection supporting https://pandirstore.netlify.app.
 */

import crypto from 'crypto';

// Environment variables configured in Netlify Dashboard
// Netlify -> Site configuration -> Environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Pandir';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pamarayan123@';
const JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || 'pandirstore_secure_jwt_secret_key_prod_v2_2026';

// Session duration: 12 hours
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

/**
 * Dynamic CORS and Security Headers supporting credentials and Netlify origins
 */
function getCorsHeaders(event?: any) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

/**
 * Base64URL encoding/decoding helper
 */
function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Constant-time safe string equality to thwart timing attacks
 */
function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Sign a JWT using HMAC-SHA256
 */
function createSignedJwt(payload: Record<string, unknown>, secret: string): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest();

  const encodedSignature = base64urlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verify a JWT signature and expiration
 */
interface TokenPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

function verifyJwt(
  token: string,
  secret: string
): { valid: boolean; payload?: TokenPayload; error?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token missing' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    // Verify cryptographic signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest();
    const expectedSigEncoded = base64urlEncode(expectedSignature);

    if (!safeEqual(encodedSignature, expectedSigEncoded)) {
      return { valid: false, error: 'Invalid signature. Token tampered.' };
    }

    // Parse payload
    const payloadJson = base64urlDecode(encodedPayload);
    const payload: TokenPayload = JSON.parse(payloadJson);

    // Verify expiration timestamp
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowInSeconds) {
      return { valid: false, error: 'Session expired' };
    }

    // Verify role claim
    if (payload.role !== 'seller' && payload.role !== 'admin') {
      return { valid: false, error: 'Unauthorized role claim' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Token verification exception' };
  }
}

/**
 * Netlify Function Handler
 */
export const handler = async (event: any) => {
  // 1. Handle HTTP OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: getCorsHeaders(event),
      body: '',
    };
  }

  const rawPath = String(event.path || '').toLowerCase();
  let body: Record<string, any> = {};

  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      body = {};
    }
  }

  // 2. Health check route (GET or explicit health action)
  if (event.httpMethod === 'GET' || body.action === 'health' || rawPath.endsWith('/health')) {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        status: 'ok',
        service: 'PANDIRSTORE.ID Netlify Auth Function',
        time: new Date().toISOString(),
        site: 'https://pandirstore.netlify.app',
      }),
    };
  }

  // 3. Determine requested action intelligently
  let action = body.action;
  if (!action) {
    if (rawPath.includes('login') || (body.username && body.password)) {
      action = 'login';
    } else if (rawPath.includes('verify') || body.token || event.headers?.authorization) {
      action = 'verify';
    } else if (rawPath.includes('logout')) {
      action = 'logout';
    } else {
      action = 'login'; // Default fallback
    }
  }

  // ================================================================
  // ACTION: LOGIN (Server-Side Authentication)
  // ================================================================
  if (action === 'login') {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
      };
    }

    const inputUser = String(body.username || '').trim();
    const inputPass = String(body.password || '').trim();

    if (!inputUser || !inputPass) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'Username dan Password wajib diisi.',
        }),
      };
    }

    // Verify credentials securely against server environment variables
    const isUserValid = safeEqual(inputUser, ADMIN_USERNAME);
    const isPassValid = safeEqual(inputPass, ADMIN_PASSWORD);

    if (!isUserValid || !isPassValid) {
      // Artificial delay (100ms) to prevent brute-force timing analysis
      await new Promise((r) => setTimeout(r, 100));

      return {
        statusCode: 401,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: 'Username atau Password salah! Akses ditolak.',
        }),
      };
    }

    // Generate signed session JWT
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = nowInSeconds + SESSION_DURATION_SECONDS;

    const token = createSignedJwt(
      {
        sub: inputUser,
        role: 'seller',
        iat: nowInSeconds,
        exp: expiresAtSeconds,
      },
      JWT_SECRET
    );

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        success: true,
        token,
        user: {
          username: inputUser,
          role: 'seller',
        },
        expiresAt: expiresAtSeconds * 1000,
      }),
    };
  }

  // ================================================================
  // ACTION: VERIFY (Cryptographic Token Validation)
  // ================================================================
  if (action === 'verify') {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (body.token) {
      token = String(body.token).trim();
    }

    if (!token) {
      return {
        statusCode: 401,
        headers: getCorsHeaders(event),
        body: JSON.stringify({ valid: false, error: 'Token tidak disertakan.' }),
      };
    }

    const verification = verifyJwt(token, JWT_SECRET);

    if (!verification.valid || !verification.payload) {
      return {
        statusCode: 401,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          valid: false,
          error: verification.error || 'Token tidak valid atau kedaluwarsa.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        valid: true,
        user: {
          username: verification.payload.sub,
          role: verification.payload.role,
        },
        expiresAt: verification.payload.exp * 1000,
      }),
    };
  }

  // ================================================================
  // ACTION: LOGOUT
  // ================================================================
  if (action === 'logout') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ success: true, message: 'Logged out successfully.' }),
    };
  }

  // Fallback for unknown actions
  return {
    statusCode: 404,
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      error: 'Endpoint tidak ditemukan. Gunakan action: login, verify, logout, atau health.',
    }),
  };
};
