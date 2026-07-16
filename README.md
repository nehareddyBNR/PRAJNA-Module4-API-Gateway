# PRAJNA Platform — Module 4: API Gateway & Middleware

**Module Owner:** B. Neha Reddy | **SME:** Balaji | **Status:** Built, synthesized, awaiting BL (M13–M18) deployment | **Last updated:** 2026-07

AI-powered faculty companion platform for GITAM University. Serverless-first, built on AWS CDK (TypeScript). This repo contains Module 1 (CDK Foundation), Module 3 (Auth & User Management), Module 6 (File Storage), and Module 4 (API Gateway & Middleware — this module).

---

## 1. What Module 4 is

Module 4 fronts every business module (M13–M18) behind one shared REST API. It owns:
- Routing (binding backend Lambdas to HTTP paths)
- Authentication wiring (JWT / IAM authorizers)
- Throttling
- CORS (centralized — no per-Lambda CORS)
- WAF (rate limiting + AWS managed rule sets)
- Access logging to CloudWatch

Module 4 does **NOT** own business logic or the backend Lambdas themselves — every Lambda is imported by ARN from SSM Parameter Store, never hardcoded.

---

## 2. Architecture decision — REST API v1 (locked)

**This is REST API v1**, built on `SharedApi` (`lib/foundation/constructs/shared-api.ts`), using `apigateway.RequestAuthorizer` to wrap Module 3's authorizer Lambda. **Not HTTP API v2.**

### Why this matters and how it was decided

During build, there was a real, documented conflict:
- Bhanu's M4 requirements doc recommended **HTTP API v2** (lower cost, lower latency).
- Balaji's integration guide (dated 2026-06-24, describing already-deployed, already-tested infrastructure) showed **REST API v1**, built on `SharedApi`, with `apigw.RequestAuthorizer`.

The deciding factor: Module 3's authorizer Lambda generates a classic **IAM Allow-policy response** — a REQUEST-authorizer-shaped output. HTTP API v2's native SIMPLE response format does not match this without unverified changes to the M3 Lambda. Since M3's authorizer was only ever tested against v1, and auth is a security-critical path (a mismatch would break every authenticated request platform-wide), v1 was chosen as the lower-risk path.

**Resolution, confirmed by Bhanu (2026-07):** v1 is the final direction. No rebuild pending. Do not re-raise v2 without first getting Balaji to confirm M3's authorizer has actually been tested against a v2 invocation event shape — it has not been, as of this writing.

---

## 3. Repo structure (Module 4)
lib/api/
route-manifest.ts       — single source of truth for all 28 routes (edit this to add/change routes)
api-authorizer.ts        — imports M3's authorizer Lambda via SSM, wraps as RequestAuthorizer
route-manager.ts         — binds routes: resource creation, Lambda integration, CfnPermission, auth
waf.ts                   — WAF WebACL (rate-based rule + AWS managed core rule set) + stage association
outputs.ts                — publishes SSM parameters (api-id, root-resource-id, api-endpoint, api-execution-arn) + CfnOutputs
api-gateway-stack.ts     — top-level stack wiring SharedApi + Authorizer + RouteManager + WAF + Outputs
scripts/
resolve-routes.ts         — preflight script: checks live SSM for each route's Lambda ARN before deploy
test/api/
route-manifest.test.ts   — manifest correctness tests (28 routes, hold logic, auth rules)
.github/workflows/
deploy-module-4.yml      — CI: resolve routes → build → synth → deploy → post-deploy health gate

---

## 4. Setup

```bash
npm install
```

---

## 5. Before every deploy — resolve routes (required)

Checks SSM Parameter Store for each of the 28 routes' Lambda ARNs and writes a bound/missing/held report. `RouteManager` will throw an error at synth time if this hasn't been run first.

```bash
npm run resolve-routes -- --stage dev
```

This writes two files:
- `build/resolved-routes.<stage>.json` — consumed by CDK at synth time
- `build/M4-ROUTE-REPORT.<stage>.md` — human-readable status per route: `BOUND` / `MISSING-ARN` / `HOLD` / `AUTH-TODO`

Requires AWS credentials with `ssm:GetParameter` access to `/prajna/{stage}/*`.

---

## 6. Build, test, synth

```bash
npm run build
npm test -- test/api
npx cdk synth --context stage=dev
```

---

## 7. Deploy

```bash
npx cdk deploy --context stage=dev --all
```

Routes bind automatically as business modules (M13–M18) publish their ARNs to SSM — **no code change needed on Module 4's side**. Re-run `resolve-routes` and redeploy any time to pick up newly-live modules.

---

## 8. How to add or change a route

Edit `lib/api/route-manifest.ts` only. Every other file (`route-manager.ts`, the preflight script, tests) reads from this manifest — nothing else needs to change.

---

## 9. Integration contract — for M13–M18 (Business Logic) module owners

### 9.1 How to get your Lambda bound to a route

Module 4 does not create or own your Lambda. You publish its ARN to SSM; Module 4 imports it.

**SSM path convention:**
/prajna/{stage}/{moduleId}/{routeId}-fn-arn
Example: `/prajna/dev/approval/start-fn-arn`

Publish this using `SharedParameter` (Module 1's construct) from your own stack — do not hand-write the SSM path string.

**⚠️ Known naming mismatch, unresolved as of this writing:** `ApprovalParameters` in `lib/foundation/constants/ssm-parameters.ts` currently publishes M13 ARNs under different hand-named identifiers (e.g. `createRequestFunctionArn`) rather than the `{routeId}-fn-arn` pattern above. If you're M13, either align to the `{routeId}-fn-arn` pattern, or tell Neha the actual identifiers you're using so `route-manifest.ts` can be corrected — otherwise your routes will show `MISSING-ARN` forever, even once deployed.

### 9.2 The 28-route manifest

The full list (module, route, method, path, auth) lives in `lib/api/route-manifest.ts` — that file is the single source of truth. If your route isn't listed there, it will never bind regardless of what you publish to SSM.

**M16 (6 routes) and M18 (8 routes) are currently on HOLD** in the manifest — they will not bind even with a valid ARN in SSM — pending Bhanu's confirmation that:
- M16's self-registration block has been removed
- M18's temporary unauthenticated RestApi has been deleted

Once confirmed, the `hold` field for those routes needs to be removed from the manifest.

### 9.3 Auth contract

Three modes, set per-route in the manifest:

- **JWT** (default) — Cognito-authenticated browser/faculty routes. Your Lambda receives context via `event.requestContext.authorizer.*` (flat structure): `userId`, `role`, `campusId`, `campus`, `departmentId`, `department`, `facultyId`. This comes from Module 3's authorizer, not Module 4 — if a field is missing or wrong, that's an M3 question.
- **IAM** — service-to-service (SigV4). Supported by the gateway in code, but **no route currently uses it**. The M16→M7 service-to-service path is not yet representable — M7 isn't in the 28-route manifest at all. Open question, needs Neha + Bhanu together.
- **NONE** — public, unauthenticated. Only `/approval/health` uses this, deliberately, as the post-deploy health gate. Never request this for a faculty-data route.

### 9.4 What happens if your ARN isn't in SSM yet

Nothing breaks. Module 4 deploys and runs fine with zero routes bound. Routes bind automatically on the next `cdk deploy` once your ARN appears in SSM.

### 9.5 CORS

Centralized at the API Gateway level. Allowed headers: `Authorization`, `Content-Type`. Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`. **Do not add CORS headers in your own Lambda** — doing so causes duplicate-header errors in the browser, not better CORS.

### 9.6 Discovery — the gateway's own URL

Published to SSM at `/prajna/{stage}/api/api-endpoint` the moment Module 4 deploys — does not wait for any routes to be bound. This is the **B-038 switch**: once this resolves, Bhanu cuts M16's self-registration block over to gateway discovery.

### 9.7 Escalation

- Architecture / auth contract questions → **Balaji** (owns Module 3, SME on this module)
- Route manifest / binding status / BL handshake → **Bhanu** (B-002 thread)
- Anything specific to `lib/api/*` code itself → **Neha**

---

## 10. Current known limitations (honest status, not resolved yet)

- **Per-route throttling is not implemented** — one uniform throttle setting applies to the whole API, not distinct limits per individual route.
- **No route uses `RouteAuth.IAM` yet** — the M16→M7 service-to-service path has no manifest entry. See 9.3 above.
- **Test coverage is thin** — only `route-manifest.ts` has unit tests (5/5 passing). `route-manager.ts`, `api-authorizer.ts`, `waf.ts`, `outputs.ts`, and `api-gateway-stack.ts` have none yet.
- **Prod CORS origin is a placeholder** (`https://dashboard.prajna.gitam.edu` in `bin/prajna.ts`) — confirm the real dashboard domain with the M24 owner before any production deploy.
- **End-to-end testing against real M13–M18 Lambdas has not happened** — cannot happen until those modules deploy and publish their ARNs.
- **Actual `cdk deploy` to the shared PRAJNA AWS account has not been run** by this module owner — deployment is being handled separately.

---

## 11. Verified working (as of last local run)

- `npm run build` — clean, no errors
- `npm test -- test/api` — 5/5 passing
- `npx cdk synth --context stage=dev` — succeeds across all 4 stacks (Foundation, Auth, Storage, Api)
- `npm run resolve-routes -- --stage dev` — runs correctly (currently reports 0/28 bound, expected since BL modules aren't deployed yet)