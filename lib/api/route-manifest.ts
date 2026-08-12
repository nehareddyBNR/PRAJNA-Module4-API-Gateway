/**
 * @fileoverview Route manifest for Module 4 — API Gateway & Middleware.
 *
 * This is the SINGLE SOURCE OF TRUTH for every route the shared API exposes.
 * RouteManager reads this file and does the binding; you should never need
 * to touch route-manager.ts to add/remove/change a route — edit this file.
 *
 * SSM ARN path convention (per Bhanu's manifest, B-002):
 *   /prajna/{stage}/{moduleId}/{routeId}-fn-arn
 *
 * NOTE: For Module 13 (Approval), the naming convention has been RECONCILED.
 * M13 now publishes Lambda ARNs to BOTH the Foundation convention
 * (e.g., create-request-function-arn) AND the M4 convention (e.g., start-fn-arn)
 * via ApprovalParameters helpers in @prajna-platform/platform-foundation.
 * The resolve-routes.ts script uses these helpers for M13 routes.
 *
 * @module lib/api/route-manifest
 */

import { ModuleIdentifier } from '@prajna-platform/platform-foundation';

/** Auth mode required for a route. */
export enum RouteAuth {
  /** Cognito JWT authorizer (default for browser routes). */
  JWT = 'JWT',
  /** AWS_IAM / SigV4 — service-to-service routes. */
  IAM = 'IAM',
  /** No authorizer — public route. MUST be justified (health checks only). */
  NONE = 'NONE',
}

export interface RouteDefinition {
  /** Owning business module (used to build the SSM ARN path). */
  readonly moduleId: ModuleIdentifier;
  /** routeId segment used in the SSM path: /prajna/{stage}/{moduleId}/{routeId}-fn-arn */
  readonly routeId: string;
  /** HTTP method. */
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Full API path, API Gateway {param} syntax. */
  readonly path: string;
  /** Auth mode for this route. */
  readonly auth: RouteAuth;
  /**
   * Set to a reason string to skip binding even though the row is present
   * here — the mechanism used for the (now lifted) M16 / M18 holds while BL
   * still self-registered those routes. RouteManager reports held rows as
   * HOLD rather than binding them. No route is held as of 2026-08-12.
   */
  readonly hold?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// M13 — Approval (7 routes)
// ─────────────────────────────────────────────────────────────────────────
const APPROVAL_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'start', method: 'POST', path: '/approval/start', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'submit-action', method: 'POST', path: '/approval/{requestId}/action', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'resubmit', method: 'POST', path: '/approval/{requestId}/resubmit', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'get-status', method: 'GET', path: '/approval/{requestId}', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'get-pending', method: 'GET', path: '/approval/pending', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'pending-mine-count', method: 'GET', path: '/approval/pending/me/count', auth: RouteAuth.JWT },
  // Public, unauthenticated — this is the post-deploy health gate target.
  { moduleId: ModuleIdentifier.APPROVAL, routeId: 'health', method: 'GET', path: '/approval/health', auth: RouteAuth.NONE },
];

// ─────────────────────────────────────────────────────────────────────────
// M14 — Score (5 routes / 3 Lambdas)
//
// `scoring-config` is ONE handler serving three methods — it branches on
// method and on the `/preview` suffix (BL: scoringConfig.handler.ts:155),
// so all three rows resolve the same `score/scoring-config-fn-arn`.
// ADMIN/IQAC-only enforcement lives in the handler, not in the gateway.
// ─────────────────────────────────────────────────────────────────────────
const SCORE_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.SCORE, routeId: 'get-score', method: 'GET', path: '/score/{facultyId}', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.SCORE, routeId: 'get-contributions', method: 'GET', path: '/score/{facultyId}/contributions', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.SCORE, routeId: 'scoring-config', method: 'GET', path: '/scoring-config', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.SCORE, routeId: 'scoring-config', method: 'PUT', path: '/scoring-config', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.SCORE, routeId: 'scoring-config', method: 'POST', path: '/scoring-config/preview', auth: RouteAuth.JWT },
];

// ─────────────────────────────────────────────────────────────────────────
// M15 — Leaderboard (2 routes)
// ─────────────────────────────────────────────────────────────────────────
const LEADERBOARD_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.LEADERBOARD, routeId: 'get-rankings', method: 'GET', path: '/leaderboard', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.LEADERBOARD, routeId: 'get-my-ranking', method: 'GET', path: '/leaderboard/rankings/{facultyId}', auth: RouteAuth.JWT },
];

// ─────────────────────────────────────────────────────────────────────────
// M16 — Notification (6 routes / 4 Lambdas)
//
// HOLD LIFTED 2026-08-12 (B-044 §1). BL deleted the self-registration block
// in notification-engine-stack.ts on 2026-07-31; lib/__tests__/stage-guards.test.ts
// asserts zero API Gateway resources in every BL stack, in every stage, so the
// duplicate-registration risk that forced the hold cannot come back silently.
// `get-notifications` and `mark-read` each serve two paths — one Lambda apiece,
// branching on the resolved path (BL: getNotifications.handler.ts:34, markRead
// falls through to mark-all when no notificationId is present).
// ─────────────────────────────────────────────────────────────────────────
const NOTIFICATION_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'get-notifications', method: 'GET', path: '/notifications', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'get-notifications', method: 'GET', path: '/notifications/count', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'mark-read', method: 'PATCH', path: '/notifications/{notificationId}/read', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'mark-read', method: 'PATCH', path: '/notifications/read-all', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'get-preferences', method: 'GET', path: '/notifications/preferences', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'update-preferences', method: 'PUT', path: '/notifications/preferences', auth: RouteAuth.JWT },
];

// ─────────────────────────────────────────────────────────────────────────
// M17 — Reports (4 routes)
// ─────────────────────────────────────────────────────────────────────────
const REPORTS_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.REPORTS, routeId: 'generate', method: 'POST', path: '/reports/generate', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.REPORTS, routeId: 'get-status', method: 'GET', path: '/reports/{reportId}', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.REPORTS, routeId: 'list', method: 'GET', path: '/reports', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.REPORTS, routeId: 'readiness', method: 'GET', path: '/reports/readiness', auth: RouteAuth.JWT },
];

// ─────────────────────────────────────────────────────────────────────────
// M18 — APAR (6 routes)
//
// HOLD LIFTED 2026-08-12 (B-044 §2). BL deleted M18's own public, unauthenticated
// RestApi on 2026-07-31 — that construct was B-003 and the reason for the hold.
//
// B-103 / B-059: `hod-review` and `director-review` are GONE. M13 owns the APAR
// review chain now — submitAppraisal starts a STANDARD workflow via
// POST /approval/start, and HoD/Director act through POST /approval/{requestId}/action.
// BL deleted those two handlers, so those ARNs no longer exist; binding them
// would have produced 500s at cutover. Do NOT re-add them.
// ─────────────────────────────────────────────────────────────────────────
const APAR_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.APAR, routeId: 'open-cycle', method: 'POST', path: '/apar/cycles', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APAR, routeId: 'create-draft', method: 'POST', path: '/apar/drafts', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APAR, routeId: 'ai-assist', method: 'POST', path: '/apar/ai-assist', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APAR, routeId: 'submit', method: 'POST', path: '/apar/{aparId}/submit', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APAR, routeId: 'self-assessment', method: 'PUT', path: '/apar/{aparId}/self-assessment', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.APAR, routeId: 'calculate-score', method: 'GET', path: '/apar/score/{facultyId}/{year}', auth: RouteAuth.JWT },
];

/** All 30 routes across M13–M18, resolving to BL's 26 published handler ARNs. */
export const ROUTE_MANIFEST: RouteDefinition[] = [
  ...APPROVAL_ROUTES,
  ...SCORE_ROUTES,
  ...LEADERBOARD_ROUTES,
  ...NOTIFICATION_ROUTES,
  ...REPORTS_ROUTES,
  ...APAR_ROUTES,
];

/** Routes eligible to bind right now (no active hold). */
export function bindableRoutes(): RouteDefinition[] {
  return ROUTE_MANIFEST.filter((r) => !r.hold);
}

/** Routes currently withheld, with their reason — used for the handoff report. */
export function heldRoutes(): RouteDefinition[] {
  return ROUTE_MANIFEST.filter((r) => !!r.hold);
}