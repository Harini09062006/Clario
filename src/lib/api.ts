/**
 * Clario Unified API Client Configuration
 * Allows configuring a remote backend (e.g., Render, Fly.io) via VITE_API_BASE_URL
 * while seamlessly falling back to relative paths for Vercel Serverless / local dev.
 */

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
).trim().replace(/\/+$/, '');

/**
 * Constructs an absolute or relative API URL based on environment configuration.
 * e.g., apiUrl('/api/documents/ask') -> 'https://clario-backend.onrender.com/api/documents/ask' or '/api/documents/ask'
 */
export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
}
