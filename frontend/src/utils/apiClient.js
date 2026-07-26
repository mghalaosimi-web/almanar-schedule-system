/**
 * @file apiClient.js
 * @description مصنع عميل API الموحد — يُلحق رأس المصادقة تلقائياً.
 * Lightweight API client factory that auto-attaches the Authorization header.
 *
 * Usage:
 *   import { getApiClient } from '../utils/apiClient';
 *   const api = getApiClient();
 *   const res = await api.get('/api/schedules');
 *   const res = await api.post('/api/auth/logout', {});
 *
 * This does NOT replace the existing axios calls in existing components —
 * it is available for new code and optional migration.
 */

import axios from 'axios';
import { API_URL } from '../config';
import { SESSION_KEYS } from './constants';

/**
 * Returns a thin API client bound to the current session token.
 * Re-reads the token on every call so it always reflects the current session.
 */
export function getApiClient() {
  const token = localStorage.getItem(SESSION_KEYS.TOKEN);
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  return {
    /**
     * Performs a GET request with auth headers.
     * @param {string} path - API path starting with '/' (e.g. '/api/schedules')
     * @param {Object} [config] - Additional axios config to merge
     */
    get: (path, config = {}) =>
      axios.get(`${API_URL}${path}`, {
        ...config,
        headers: { ...authHeader, ...config.headers },
      }),

    /**
     * Performs a POST request with auth headers.
     * @param {string} path - API path starting with '/'
     * @param {*} data - Request body
     * @param {Object} [config] - Additional axios config to merge
     */
    post: (path, data, config = {}) =>
      axios.post(`${API_URL}${path}`, data, {
        ...config,
        headers: { ...authHeader, ...config.headers },
      }),

    /**
     * Performs a PUT request with auth headers.
     * @param {string} path - API path starting with '/'
     * @param {*} data - Request body
     * @param {Object} [config] - Additional axios config to merge
     */
    put: (path, data, config = {}) =>
      axios.put(`${API_URL}${path}`, data, {
        ...config,
        headers: { ...authHeader, ...config.headers },
      }),

    /**
     * Performs a DELETE request with auth headers.
     * @param {string} path - API path starting with '/'
     * @param {Object} [config] - Additional axios config to merge
     */
    delete: (path, config = {}) =>
      axios.delete(`${API_URL}${path}`, {
        ...config,
        headers: { ...authHeader, ...config.headers },
      }),
  };
}
