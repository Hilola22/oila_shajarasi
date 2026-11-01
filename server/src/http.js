// Juda kichik HTTP yordamchilar: router, JSON o'qish, xatolar.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class Reply {
  constructor(status, body = null, headers = {}) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

export const created = (body) => new Reply(201, body);
export const noContent = () => new Reply(204);

export function createRouter() {
  const routes = [];

  function add(method, pattern, handlers) {
    const keys = [];
    const source = pattern.replace(/:([a-zA-Z_]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    routes.push({ method, re: new RegExp(`^${source}/?$`), keys, handlers });
  }

  return {
    get: (p, ...h) => add('GET', p, h),
    post: (p, ...h) => add('POST', p, h),
    put: (p, ...h) => add('PUT', p, h),
    patch: (p, ...h) => add('PATCH', p, h),
    delete: (p, ...h) => add('DELETE', p, h),
    find(method, pathname) {
      let pathMatched = false;
      for (const route of routes) {
        const m = route.re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (route.method !== method) continue;
        const params = {};
        try {
          route.keys.forEach((key, i) => {
            params[key] = decodeURIComponent(m[i + 1]);
          });
        } catch {
          throw new HttpError(400, "Manzil noto'g'ri");
        }
        return { route, params, pathMatched: true };
      }
      return { route: null, params: {}, pathMatched };
    },
  };
}

export async function readJson(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "So'rov hajmi juda katta");
    chunks.push(chunk);
  }
  if (size === 0) return {};
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('application/json')) {
    throw new HttpError(415, "Content-Type: application/json bo'lishi kerak");
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, "JSON noto'g'ri");
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, "So'rov tanasi JSON obyekt bo'lishi kerak");
  }
  return data;
}

export function sendJson(res, status, data, headers = {}) {
  if (status === 204 || data === null || data === undefined) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}
