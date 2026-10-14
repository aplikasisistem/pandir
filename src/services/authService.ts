/**
 * Client-Side Authentication Service for PANDIRSTORE.ID Seller Admin.
 *
 * Configurable API Base URL via VITE_API_URL or REACT_APP_API_URL.
 * Runs 100% natively on Netlify Serverless Functions without needing
 * an external server, with automatic direct-fallback to /.netlify/functions/auth.
 */

const TOKEN_STORAGE_KEY = 'pandirstore_auth_token';

export interface AuthResponse {
  success: boolean;
  token?: string;
  error?: string;
  user?: {
    username: string;
    role: string;
  };
  expiresAt?: number;
  diagnostic?: {
    endpoint: string;
    status?: number;
    corsHint?: boolean;
  };
}

export interface VerifyResponse {
  valid: boolean;
  user?: {
    username: string;
    role: string;
  };
  error?: string;
}

/**
 * Resolves the primary URL for auth endpoints based on environment variable VITE_API_URL.
 * If running on a live domain (like pandirstore.netlify.app) and VITE_API_URL points to localhost,
 * it automatically ignores the localhost URL and uses the native same-origin Netlify Function!
 */
export function getAuthApiEndpoint(action: 'login' | 'verify' | 'logout'): string {
  const envUrl = (
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta as any).env?.REACT_APP_API_URL ||
    ''
  ).trim();

  // If live in browser and envUrl mistakenly points to localhost, ignore it and use same-origin Netlify Functions
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))
  ) {
    return `/api/auth/${action}`;
  }

  if (!envUrl) {
    // Default same-origin endpoint for Netlify Functions & local dev proxy
    return `/api/auth/${action}`;
  }

  // Strip trailing slashes
  const cleanBase = envUrl.replace(/\/+$/, '');

  if (cleanBase.endsWith('/api/auth')) {
    return `${cleanBase}/${action}`;
  }
  if (cleanBase.endsWith('/api')) {
    return `${cleanBase}/auth/${action}`;
  }
  return `${cleanBase}/api/auth/${action}`;
}

/**
 * Returns secondary direct Netlify function URL in case /api/auth rewrite is bypassed
 */
export function getDirectNetlifyFunctionUrl(): string {
  return '/.netlify/functions/auth';
}

/**
 * Returns the currently active backend API server URL (for diagnostics and UI hints)
 */
export function getActiveApiBase(): string {
  const envUrl = (
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta as any).env?.REACT_APP_API_URL ||
    ''
  ).trim();

  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))
  ) {
    return 'Netlify Serverless Function (Auto-Fallback from localhost)';
  }

  if (!envUrl) {
    return 'Netlify Serverless Functions (Same-Origin /api/auth)';
  }
  return envUrl;
}

export const authService = {
  getActiveApiBase,
  getEndpoint: getAuthApiEndpoint,

  /**
   * Sends user credentials via secure POST to Netlify Functions / Backend API.
   * Includes smart direct-fallback to /.netlify/functions/auth if /api/auth/login returns 404.
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    const primaryEndpoint = getAuthApiEndpoint('login');
    const directFallbackEndpoint = getDirectNetlifyFunctionUrl();
    const isSameOrigin = !primaryEndpoint.startsWith('http');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const postPayload = JSON.stringify({
      action: 'login',
      username,
      password,
    });

    try {
      let response: Response;
      let activeEndpoint = primaryEndpoint;

      try {
        response = await fetch(primaryEndpoint, {
          method: 'POST',
          signal: controller.signal,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: postPayload,
        });
      } catch (firstErr) {
        // If same-origin /api/auth fails or is not found, try direct Netlify Function URL
        if (isSameOrigin && directFallbackEndpoint !== primaryEndpoint) {
          activeEndpoint = directFallbackEndpoint;
          response = await fetch(directFallbackEndpoint, {
            method: 'POST',
            signal: controller.signal,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: postPayload,
          });
        } else {
          throw firstErr;
        }
      }

      // If primary returned 404 on same origin, attempt direct Netlify function URL
      if (response.status === 404 && isSameOrigin && directFallbackEndpoint !== primaryEndpoint) {
        activeEndpoint = directFallbackEndpoint;
        response = await fetch(directFallbackEndpoint, {
          method: 'POST',
          signal: controller.signal,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: postPayload,
        });
      }

      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // Non-JSON response (e.g., HTML from SPA redirect)
      }

      // Handle specific HTTP Status codes
      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: data?.error || 'Username atau Password salah! Akses ditolak.',
            diagnostic: { endpoint: activeEndpoint, status: response.status },
          };
        }

        if (response.status === 404) {
          return {
            success: false,
            error: `Endpoint otentikasi tidak ditemukan (HTTP 404) di: ${activeEndpoint}.\n\nPastikan Netlify Functions aktif dan file netlify/functions/auth.ts sudah ter-deploy di Netlify.`,
            diagnostic: { endpoint: activeEndpoint, status: 404 },
          };
        }

        if (response.status >= 500) {
          return {
            success: false,
            error: `Server otentikasi mengalami kendala (HTTP ${response.status}). Periksa log Netlify Functions di dashboard Netlify.`,
            diagnostic: { endpoint: activeEndpoint, status: response.status },
          };
        }

        return {
          success: false,
          error: data?.error || `Gagal otentikasi dari server (HTTP ${response.status}).`,
          diagnostic: { endpoint: activeEndpoint, status: response.status },
        };
      }

      if (!data || !data.success || !data.token) {
        return {
          success: false,
          error: data?.error || 'Format respon dari server otentikasi tidak sesuai (kemungkinan file functions belum siap).',
          diagnostic: { endpoint: activeEndpoint, status: response.status },
        };
      }

      // Store only the cryptographically signed server token in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user,
        expiresAt: data.expiresAt,
        diagnostic: { endpoint: activeEndpoint, status: 200 },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[authService] Login request failure:', err);

      const clientOrigin = typeof window !== 'undefined' ? window.location.origin : 'domain Netlify Anda';

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {
          success: false,
          error: 'Perangkat Anda sedang offline. Silakan periksa koneksi internet Anda.',
          diagnostic: { endpoint: primaryEndpoint },
        };
      }

      if (err.name === 'AbortError') {
        return {
          success: false,
          error: `Waktu koneksi ke server otentikasi habis (Timeout 15s).\n\nTarget URL: ${primaryEndpoint}\n\nServer belum merespons. Silakan coba klik tombol login sekali lagi.`,
          diagnostic: { endpoint: primaryEndpoint },
        };
      }

      // NetworkError / Failed to fetch
      return {
        success: false,
        error: `Gagal menghubungi server otentikasi di:\n→ ${primaryEndpoint}\n\nSolusi & Pemeriksaan:\n1. Jika Anda ingin menjalankan 100% di Netlify (tanpa server backend terpisah): Pastikan VITE_API_URL di Netlify Environment Variables dikosongkan/dihapus agar aplikasi otomatis memakai Netlify Serverless Functions bawaan.\n2. Jika menggunakan backend eksternal: Pastikan server aktif dan mengizinkan CORS dari ${clientOrigin}.`,
        diagnostic: { endpoint: primaryEndpoint, corsHint: true },
      };
    }
  },

  /**
   * Verifies the active cryptographic session token with Netlify Functions / server.
   */
  async verifySession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return false;
    }

    const primaryEndpoint = getAuthApiEndpoint('verify');
    const directFallbackEndpoint = getDirectNetlifyFunctionUrl();
    const isSameOrigin = !primaryEndpoint.startsWith('http');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const payload = JSON.stringify({
      action: 'verify',
      token,
    });

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    try {
      let response: Response;

      try {
        response = await fetch(primaryEndpoint, {
          method: 'POST',
          signal: controller.signal,
          credentials: 'include',
          headers,
          body: payload,
        });
      } catch (firstErr) {
        if (isSameOrigin && directFallbackEndpoint !== primaryEndpoint) {
          response = await fetch(directFallbackEndpoint, {
            method: 'POST',
            signal: controller.signal,
            credentials: 'include',
            headers,
            body: payload,
          });
        } else {
          throw firstErr;
        }
      }

      if (response.status === 404 && isSameOrigin && directFallbackEndpoint !== primaryEndpoint) {
        response = await fetch(directFallbackEndpoint, {
          method: 'POST',
          signal: controller.signal,
          credentials: 'include',
          headers,
          body: payload,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.clearSession();
        return false;
      }

      const data: VerifyResponse = await response.json().catch(() => ({ valid: false }));
      if (!data.valid) {
        this.clearSession();
        return false;
      }

      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[authService] Session verification check failed:', err);
      return false;
    }
  },

  /**
   * Cleans up all authentication tokens and sessions
   */
  async logout(): Promise<void> {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
    const primaryEndpoint = getAuthApiEndpoint('logout');
    const directFallbackEndpoint = getDirectNetlifyFunctionUrl();
    const isSameOrigin = !primaryEndpoint.startsWith('http');

    if (token) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const payload = JSON.stringify({ action: 'logout' });
        const headers = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        };

        try {
          await fetch(primaryEndpoint, {
            method: 'POST',
            signal: controller.signal,
            credentials: 'include',
            headers,
            body: payload,
          });
        } catch {
          if (isSameOrigin) {
            await fetch(directFallbackEndpoint, {
              method: 'POST',
              signal: controller.signal,
              credentials: 'include',
              headers,
              body: payload,
            }).catch(() => {});
          }
        }

        clearTimeout(timeoutId);
      } catch {
        // Ignore logout network errors
      }
    }

    this.clearSession();
  },

  /**
   * Removes cached tokens and clears legacy storage keys
   */
  clearSession(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem('gamestore_seller_auth');
    }
  },

  /**
   * Returns current token string if available
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  },
};
