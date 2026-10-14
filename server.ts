import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Pandir';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pamarayan123@';
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'pandirstore_secure_jwt_secret_key_prod_v2_2026';
const SESSION_DURATION_SECONDS = 12 * 60 * 60; // 12 Hours

// CORS Configuration - Allows Netlify domains, localhost, and custom domains
const allowedOriginsEnv = process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
const customAllowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map((o) => o.trim().replace(/\/+$/, ''))
  : [];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow non-browser tools (curl, postman, server-to-server)

  // 1. Check custom allowed origins from environment variable
  if (customAllowedOrigins.includes(origin)) return true;

  // 2. Allow any Netlify domain (*.netlify.app)
  if (/^https:\/\/[a-zA-Z0-9-]+\.netlify\.app$/.test(origin)) return true;

  // 3. Allow localhost and loopback interfaces for local testing
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  // 4. Allow Google AI Studio development and preview domains
  if (/^https:\/\/[a-zA-Z0-9-]+\.run\.app$/.test(origin)) return true;

  return false;
}

// Global CORS Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    // Note: When credentials mode is 'include', Access-Control-Allow-Origin MUST NOT be '*'
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // If unknown origin but in permissive mode, echo origin to prevent blocking
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours preflight cache

  // Immediately respond to OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// JSON Body Parser with error handling
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Base64URL encoding/decoding
 */
function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Constant-time safe string equality to prevent timing attacks
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
 * Sign JWT using HMAC-SHA256
 */
function createSignedJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest();
  const encodedSignature = base64urlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verify JWT
 */
interface TokenPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

function verifyJwt(token: string, secret: string): { valid: boolean; payload?: TokenPayload; error?: string } {
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

    const expectedSignature = crypto.createHmac('sha256', secret).update(dataToSign).digest();
    const expectedSigEncoded = base64urlEncode(expectedSignature);

    if (!safeEqual(encodedSignature, expectedSigEncoded)) {
      return { valid: false, error: 'Invalid signature. Token tampered.' };
    }

    const payloadJson = base64urlDecode(encodedPayload);
    const payload: TokenPayload = JSON.parse(payloadJson);

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowInSeconds) {
      return { valid: false, error: 'Session expired' };
    }

    if (payload.role !== 'seller' && payload.role !== 'admin') {
      return { valid: false, error: 'Unauthorized role claim' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Token verification exception' };
  }
}

// =========================================================================
// Health Check Endpoint
// =========================================================================
const handleHealth = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'PANDIRSTORE.ID Authentication API Server',
    time: new Date().toISOString(),
    allowedOrigins: customAllowedOrigins.length > 0 ? customAllowedOrigins : ['*.netlify.app', 'localhost'],
  });
};

app.get('/', handleHealth);
app.get('/api', handleHealth);
app.get('/api/health', handleHealth);

// =========================================================================
// Login Endpoint Handler
// =========================================================================
const handleLogin = async (req: Request, res: Response) => {
  const inputUser = String(req.body.username || '').trim();
  const inputPass = String(req.body.password || '').trim();

  if (!inputUser || !inputPass) {
    return res.status(400).json({
      success: false,
      error: 'Username dan Password wajib diisi.',
    });
  }

  const isUserValid = safeEqual(inputUser, ADMIN_USERNAME);
  const isPassValid = safeEqual(inputPass, ADMIN_PASSWORD);

  if (!isUserValid || !isPassValid) {
    // 100ms delay to thwart timing attacks
    await new Promise((r) => setTimeout(r, 100));
    return res.status(401).json({
      success: false,
      error: 'Username atau Password salah! Akses ditolak.',
    });
  }

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

  return res.status(200).json({
    success: true,
    token,
    user: {
      username: inputUser,
      role: 'seller',
    },
    expiresAt: expiresAtSeconds * 1000,
  });
};

// =========================================================================
// Verify Session Endpoint Handler
// =========================================================================
const handleVerify = (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.body.token) {
    token = String(req.body.token).trim();
  }

  if (!token) {
    return res.status(401).json({
      valid: false,
      error: 'Token otentikasi tidak disertakan.',
    });
  }

  const verification = verifyJwt(token, JWT_SECRET);

  if (!verification.valid || !verification.payload) {
    return res.status(401).json({
      valid: false,
      error: verification.error || 'Token tidak valid atau telah kedaluwarsa.',
    });
  }

  return res.status(200).json({
    valid: true,
    user: {
      username: verification.payload.sub,
      role: verification.payload.role,
    },
    expiresAt: verification.payload.exp * 1000,
  });
};

// =========================================================================
// Logout Endpoint Handler
// =========================================================================
const handleLogout = (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

// Register Routes (Supports both prefixed /api/auth/* and root /auth/* /login)
app.post('/api/auth/login', handleLogin);
app.post('/api/auth/verify', handleVerify);
app.post('/api/auth/logout', handleLogout);

app.post('/auth/login', handleLogin);
app.post('/auth/verify', handleVerify);
app.post('/auth/logout', handleLogout);

app.post('/login', handleLogin);
app.post('/verify', handleVerify);
app.post('/logout', handleLogout);

// Start standalone server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[PANDIRSTORE-API] Server running on port ${PORT}`);
    console.log(`[PANDIRSTORE-API] CORS configured for Netlify domains (*.netlify.app) & custom origins`);
  });
}

export default app;
