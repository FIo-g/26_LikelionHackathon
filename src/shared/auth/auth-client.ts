import { createAuthClient } from "better-auth/react";

const origin =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://127.0.0.1:3000";

const baseURL = `${origin.replace(/\/$/, "")}/api/auth`;

export const authClient = createAuthClient({
  baseURL,
});
