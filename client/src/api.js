const TOKEN_KEY = 'nasl_daraxti_token';

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* brauzer xotirasi yopiq bo'lishi mumkin */
  }
}

async function request(method, url, body, { blob = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Serverga ulanib bo'lmadi");
  }

  if (res.status === 401 && !url.startsWith('/api/auth/login')) onUnauthorized();

  if (!res.ok) {
    let message = 'Xatolik yuz berdi';
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      /* JSON emas */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (blob) return res.blob();
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  meta: () => request('GET', '/api/meta'),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  me: () => request('GET', '/api/auth/me'),
  changePassword: (current_password, new_password) =>
    request('POST', '/api/auth/change-password', { current_password, new_password }),

  members: () => request('GET', '/api/members'),
  createMember: (data) => request('POST', '/api/members', data),
  updateMember: (id, data) => request('PUT', `/api/members/${id}`, data),
  deleteMember: (id) => request('DELETE', `/api/members/${id}`),
  upcoming: (limit = 6) => request('GET', `/api/members/upcoming-birthdays?limit=${limit}`),

  googleLinks: (ids) => request('GET', `/api/calendar/google?ids=${ids.join(',')}`),
  icsBlob: (ids) => request('GET', `/api/calendar/ics?ids=${ids.join(',')}`, undefined, { blob: true }),

  users: () => request('GET', '/api/users'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PATCH', `/api/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/api/users/${id}`),
};
