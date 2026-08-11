/* API client — every call goes through here with consistent error handling.
   Sessions are sent three ways so authentication works even through proxies
   that strip cookies or headers:
     1. httpOnly cookie (normal browsers)
     2. `Authorization: Bearer` header
     3. `?token=` query parameter (used as a fallback — URLs are never
        stripped by proxies). Attachment URLs also carry it so images,
        audio and documents load directly in <img>/<audio>/<a> tags. */
'use strict';

let authToken = null;
export function setToken(t) { authToken = t || null; }
export function getToken() { return authToken; }

/** Append the session token to any path (used for direct asset URLs). */
export function authedUrl(path) {
  if (!authToken || !path) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}token=${encodeURIComponent(authToken)}`;
}

export async function api(path, opts = {}) {
  // Never let a request hang forever — users need clear errors instead.
  const hasFile = opts.body instanceof FormData;
  const timeoutMs = hasFile ? 120000 : 30000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const headers = { ...(opts.headers || {}) };
    if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    let url = path;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
      url = authedUrl(path);
    }
    const res = await fetch(url, {
      credentials: 'include',
      ...opts,
      signal: controller ? controller.signal : undefined,
      headers,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      // If the session died mid-use, let the app react (redirect to login)
      // instead of showing a dead dashboard.
      if (res.status === 401 && authToken && !String(path).includes('/auth/login') && !String(path).includes('/auth/register')) {
        setToken(null);
        try { sessionStorage.removeItem('as_token'); } catch (_) { /* ignore */ }
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw err;
    }
    return data;
  } catch (err) {
    if (controller && err.name === 'AbortError') {
      throw new Error(hasFile ? 'Upload timed out. Please try again.' : 'The request timed out. Please try again.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body || {}) });
export const patch = (p, body) => api(p, { method: 'PATCH', body: JSON.stringify(body || {}) });
export const del = (p) => api(p, { method: 'DELETE' });
export const postForm = (p, formData) => api(p, { method: 'POST', body: formData });
