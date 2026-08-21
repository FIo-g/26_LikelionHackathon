# Operations and privacy policy

## Liveness and readiness

`GET /api/health` is a non-authenticated liveness signal. It returns only `{ "status": "ok" }` with `Cache-Control: no-store`; it does not query, export, or reveal account, plan, analysis, narration, database, or provider state.

`GET /api/ready` is the deployment readiness signal. It performs only `SELECT 1` against the configured PostgreSQL runtime database through a singleton one-connection pool, with a 750 ms connection/probe budget. An aborted or failed probe destroys the acquired connection before returning the generic `503 { "status": "unavailable" }`; a healthy probe returns `200 { "status": "ready" }`. Neither response contains failure details, credentials, database identifiers, user data, or export data.

## Runtime logging

Operational logs may contain only fixed event names, outcome classes, fixed failure-reason classes, and rounded durations. They must never include user IDs, email addresses, session IDs, database identifiers, prompts, model input/output bodies, API keys, tokens, narration IDs, analysis IDs, plan IDs, record content, or exported data. Error reporting integrations must use the same allowlist and disable request-body capture.

The narration runtime emits the fixed `narration_generation` event with `ready` or `template-fallback` and a duration. A fallback can additionally include one of `provider-unavailable`, `timeout`, `invalid-output`, `unsupported-claim`, `provider-refusal`, or `provider-error`; it intentionally omits all target and narration identifiers.

## Release and migration boundaries

Vercel runtime receives only the pooled `DATABASE_URL`, Better Auth settings, rate-limit setting, and OpenAI runtime settings. `MIGRATION_DATABASE_URL` is never a Vercel runtime variable. It is held only by the manually approved `guarded database migration` workflow environment, which runs after a provider backup and before release promotion.

The `preview release` workflow is separately approval-gated. Every current workflow has only `contents: read`; Vercel deployment access is provided by the scoped `VERCEL_TOKEN` secret, with no GitHub deployment write permission. The workflow validates release configuration without printing values, builds/deploys the preview, and runs the remote-only smoke suite against the deployment URL Vercel returns.
