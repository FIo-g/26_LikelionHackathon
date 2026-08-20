export type RawAuthEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
};

export interface AuthOrigin {
  baseURL: string;
  trustedOrigins: string[];
}

const INVALID_AUTH_ORIGIN = "INVALID_AUTH_ORIGIN";
export const INVALID_AUTH_ORIGIN_ERROR = INVALID_AUTH_ORIGIN;

const ensureLocalhost = (url: URL, allowLoopbackOnly = true): string => {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  if (allowLoopbackOnly && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  if (url.username || url.password) {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  return url.origin;
};

const parseOrigin = (value: string, options: { allowHttp: boolean; allowLoopbackOnly: boolean }): string => {
  if (!value || value.includes("*") || /\s/.test(value)) {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  const isAbsolute = /^https?:\/\//i.test(value);
  const parsed = new URL(isAbsolute ? value : `https://${value}`);

  if (!isAbsolute && parsed.pathname !== "/") {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  if (!options.allowHttp && parsed.protocol !== "https:") {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  if (options.allowHttp && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(INVALID_AUTH_ORIGIN);
  }

  const base = ensureLocalhost(parsed, options.allowLoopbackOnly);
  if (parsed.protocol === "http:" && options.allowHttp) {
    return base;
  }

  return base;
};

export const resolveAuthOrigin = (env: RawAuthEnv): AuthOrigin => {
  if (env.VERCEL_ENV === "preview") {
    if (!env.VERCEL_URL) {
      throw new Error(INVALID_AUTH_ORIGIN);
    }

    const origin = parseOrigin(env.VERCEL_URL, { allowHttp: false, allowLoopbackOnly: false });
    return {
      baseURL: origin,
      trustedOrigins: [origin],
    };
  }

  if (env.VERCEL_ENV === "production") {
    const candidate = env.BETTER_AUTH_URL;
    if (!candidate) {
      throw new Error(INVALID_AUTH_ORIGIN);
    }

    const origin = parseOrigin(candidate, { allowHttp: false, allowLoopbackOnly: false });
    return {
      baseURL: origin,
      trustedOrigins: [origin],
    };
  }

  const fallback = env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
  if ((env.NODE_ENV ?? "development") !== "development" && env.NODE_ENV !== "test") {
    const candidate = parseOrigin(fallback, { allowHttp: false, allowLoopbackOnly: false });
    return {
      baseURL: candidate,
      trustedOrigins: [candidate],
    };
  }

  const origin = parseOrigin(fallback, { allowHttp: true, allowLoopbackOnly: true });
  return {
    baseURL: origin,
    trustedOrigins: [origin],
  };
};
