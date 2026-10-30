const DEFAULT_API_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://desmonteos-backend.onrender.com';

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  DEFAULT_API_URL;

export const API_BASE_URL = `${API_URL}/api`;
