/**
 * Client-Side Authentication Service for PANDIRSTORE.ID Seller Admin.
 *
 * All credentials verification and session signing are executed strictly
 * on the server (Netlify Serverless Functions / Backend API).
 *
 * No plaintext passwords or hardcoded secret checks exist in the frontend.
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
}

export interface VerifyResponse {
  valid: boolean;
  user?: {
    username: string;
    role: string;
  };
  error?: string;
}

export const authService = {
  /**
   * Sends user credentials via secure POST to the serverless function.
   * Credentials are never stored or evaluated on the client.
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        return {
          success: false,
          error: data.error || 'Username atau Password salah! Akses ditolak.',
        };
      }

      // Store only the cryptographically signed server token in sessionStorage (clears when browser tab closes)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user,
        expiresAt: data.expiresAt,
      };
    } catch (err) {
      console.error('Server-side login verification error:', err);
      return {
        success: false,
        error: 'Gagal menghubungi server otentikasi. Silakan periksa koneksi internet Anda.',
      };
    }
  },

  /**
   * Verifies the active cryptographic session token with the server.
   * Modifying client state in DevTools console will NOT bypass this,
   * because the server checks the HMAC signature.
   */
  async verifySession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'verify',
          token,
        }),
      });

      if (!response.ok) {
        this.clearSession();
        return false;
      }

      const data: VerifyResponse = await response.json();
      if (!data.valid) {
        this.clearSession();
        return false;
      }

      return true;
    } catch (err) {
      console.warn('Session verification error:', err);
      // If offline, check if token format is present but do not blindly trust invalid tokens
      return false;
    }
  },

  /**
   * Cleans up all authentication tokens and sessions
   */
  async logout(): Promise<void> {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;

    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'logout' }),
        });
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
