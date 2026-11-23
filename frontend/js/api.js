// Ham goi API dung chung, tu dong xu ly JSON, loi mang va ma 401
export class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function apiFetch(url, options = {}) {
  const { method = 'GET', body, redirectOn401 = false } = options;
  const fetchOpts = {
    method,
    credentials: 'same-origin',
    headers: {},
  };

  if (body !== undefined) {
    fetchOpts.headers['Content-Type'] = 'application/json';
    fetchOpts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, fetchOpts);
  } catch (err) {
    throw new ApiError(0, 'Không kết nối được máy chủ, vui lòng thử lại.');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (res.status === 401 && redirectOn401) {
    const current = window.location.pathname.replace(/^\//, '') + window.location.search + window.location.hash;
    window.location.href = `/auth.html?redirect=${encodeURIComponent(current)}`;
    throw new ApiError(401, payload?.message || 'Vui lòng đăng nhập để tiếp tục.');
  }

  if (!res.ok || !payload?.ok) {
    throw new ApiError(
      res.status,
      payload?.message || 'Có lỗi xảy ra, vui lòng thử lại.',
      payload?.errors || null
    );
  }

  return payload.data;
}

export const api = {
  get: (url, opts = {}) => apiFetch(url, { ...opts, method: 'GET' }),
  post: (url, body, opts = {}) => apiFetch(url, { ...opts, method: 'POST', body }),
  put: (url, body, opts = {}) => apiFetch(url, { ...opts, method: 'PUT', body }),
  patch: (url, body, opts = {}) => apiFetch(url, { ...opts, method: 'PATCH', body }),
  del: (url, opts = {}) => apiFetch(url, { ...opts, method: 'DELETE' }),
};
