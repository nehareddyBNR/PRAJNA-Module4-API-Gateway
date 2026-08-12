# Module 4 - API Gateway Integration Guide

**Owner:** B. Neha Reddy | **SME:** Balaji | **Status:** Built, synthesized, awaiting BL (M13-M18) deployment | **Last updated:** 2026-07

This is the contract other modules need to integrate with the shared API Gateway. If you own M13-M18 (or any future business module needing gateway routes), read this before asking Neha anything - it is probably answered here.

---

## 1. Architecture decision (locked)

**REST API v1**, not HTTP API v2.

This was a real conflict during build: Bhanu's M4 requirements doc recommended v2 (cost/latency). Balaji's integration guide (2026-06-24, describing already-deployed, already-tested infrastructure) shows v1, built on SharedApi, with apigw.RequestAuthorizer wrapping M3's authorizer Lambda - which returns a classic IAM Allow-policy response, a REQUEST-authorizer-shaped output that v2's SIMPLE response format does not natively match without unverified changes to M3's Lambda.

**Resolution (confirmed by Bhanu, 2026-07):** v1 is the direction. No rebuild pending. Do not re-raise v2 without first getting Balaji to confirm M3's authorizer has been tested against a v2 invocation event shape - it has not been, as of this writing.

## 2. How to get your Lambda bound to a route

Module 4 does not create or own your Lambda. You publish its ARN to SSM; Module 4 imports it.

SSM path convention:
/prajna/{stage}/{moduleId}/{routeId}-fn-arn

Example: /prajna/dev/approval/start-fn-arn

Publish this using SharedParameter (Module 1's construct) from your own stack - do not hand-write the SSM path string, use the same helper Module 4 reads with.

Known naming mismatch, unresolved as of this writing: ApprovalParameters in lib/foundation/constants/ssm-parameters.ts currently publishes M13 ARNs under different hand-named identifiers (e.g. createRequestFunctionArn) rather than the {routeId}-fn-arn pattern above. If you are M13, either align to the {routeId}-fn-arn pattern, or tell Neha the actual identifiers you are using so lib/api/route-manifest.ts can be corrected - right now it assumes the generic pattern and will report your routes as MISSING-ARN even once you are deployed, until this is reconciled.

## 3. The 30-route manifest

The full list (module, route, method, path, auth) lives in lib/api/route-manifest.ts - that file is the single source of truth, not this doc. If your route is not listed there, it will never bind regardless of what you publish to SSM. Ask Neha to add it.

**30 routes over 26 handler ARNs** - four ARNs serve more than one route: M14's `scoring-config` (GET + PUT /scoring-config, POST /scoring-config/preview), M16's `get-notifications` (/notifications + /notifications/count) and `mark-read` (/{notificationId}/read + /read-all). Those handlers branch internally on method and path.

**No route is held any more (2026-08-12).** M16's 6 routes and M18's 6 routes came off hold once BL deleted the M16 self-registration block and M18's temporary unauthenticated RestApi (B-044; BL's stage-guards.test.ts now asserts zero API Gateway resources in every BL stack, in every stage).

**M18 is 6 routes, not 8.** `hod-review` and `director-review` were deleted (B-059 / B-103) - M13 owns the APAR review chain now: submitAppraisal starts a STANDARD workflow via POST /approval/start, and HoD/Director act through POST /approval/{requestId}/action. Those two ARNs no longer exist; do not ask for them back.

## 4. Auth contract

Three modes, set per-route in the manifest:

- JWT (default) - Cognito-authenticated browser/faculty routes. Your Lambda receives context via event.requestContext.authorizer.* (flat structure): userId, role, campusId, campus, departmentId, department, facultyId. This comes from Module 3's authorizer, not from Module 4 - if a field is missing or wrong, that is an M3 question, not an M4 one.
- IAM - service-to-service (SigV4). Supported by the gateway (RouteAuth.IAM exists in the manifest type), but no route currently uses it. If you are M16 calling M7, this needs a manifest entry added first - raise with Neha and Bhanu together, since M7 is not in the 28-route table at all right now.
- NONE - public, unauthenticated. Only /approval/health uses this, deliberately, as the deploy health gate. Do not request this for any route carrying faculty data.

## 5. What happens if your ARN is not in SSM yet

Nothing breaks. Module 4 deploys and runs fine with zero routes bound. Run the preflight script (below) any time to check current status; routes bind automatically on the next cdk deploy once your ARN appears.

npm run resolve-routes -- --stage dev

Produces build/M4-ROUTE-REPORT.<stage>.md - one row per route, status one of BOUND / MISSING-ARN / HOLD / AUTH-TODO.

## 5a. After YOU deploy: ask for a stage publish (INFRA-2)

API Gateway REST points a stage at a specific deployment snapshot. Adding resources to the gateway from your own stack does **not** publish them - your routes exist on the API and still return 404 on the stage until someone calls CreateDeployment, and a module that does not own the gateway cannot trigger one. BL hit exactly this on 2026-08-07 and fixed it by hand.

**Module 4 owns stage redeployment.** After any deploy that touches gateway routes, run (or ask Neha to run):

npm run redeploy -- --stage dev

It reads the API id from /prajna/{stage}/api/api-id and publishes the current resources to the stage. Do not create your own apigateway.Deployment - two owners of the same stage is worse than the 404.

## 6. CORS

Centralized at the API Gateway level (SharedApi). Allowed headers: Authorization, Content-Type. Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS. Do not add CORS headers in your own Lambda - if you do, you will get duplicate-header errors in the browser, not better CORS.

Origins are a **deploy parameter**, not a code change: `cdk deploy -c corsOrigins=https://a,https://b`. Without it, prod defaults to `https://prajna.gitam.edu` (the confirmed dashboard origin, B-052 - the `dashboard.` subdomain this used to carry was never real) and non-prod to http://localhost:3000. Dev is permissive, so a wrong prod origin is invisible until cutover - send Neha the confirmed list rather than assuming.

## 7. Discovery - the gateway's own URL

Published to SSM at /prajna/{stage}/api/api-endpoint the moment Module 4 deploys - does not wait for any routes to be bound. This is the B-038 switch: once this resolves, Bhanu cuts M16's self-registration block over to gateway discovery.

⚠️ **api-endpoint ends with a trailing slash.** It is CDK's `RestApi.url`, which always does. The natural `` `${apiBase}/score/${id}` `` produces `.../dev//score/...`, and API Gateway answers **403 Missing Authentication Token** for that unbound double-slash path - which reads as an auth failure and sends people off debugging their JWT. Three teams have lost time to this (M7, M18, M24). Strip it:

const base = apiEndpoint.replace(/\/$/, '');

## 8. Escalation

- Architecture / auth contract questions -> Balaji (owns Module 3, SME on this module)
- Route manifest / binding status / BL handshake -> Bhanu (B-002 thread)
- Anything specific to lib/api/* code itself -> Neha
