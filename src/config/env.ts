/**
 * Environment variables configuration
 */

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
export const NODE_ENV = import.meta.env.MODE || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT ? parseInt(import.meta.env.VITE_API_TIMEOUT) : 30000;
