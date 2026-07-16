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
 * NOTE: This convention does NOT match how `ApprovalParameters` in
 * `lib/foundation/constants/ssm-parameters.ts` currently publishes M13 ARNs
 * (it uses named getters like `createRequestFunctionArn`, not a generic
 * `{routeId}-fn-arn` pattern). Flagged in the handoff report — reconcile
 * with Bhanu before binding M13 routes for real, or `valueForStringParameter`
 * will read a parameter that was never written.
 *
 * @module lib/api/route-manifest
 */

import { ModuleIdentifier } from '../foundation/constants/naming';

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
   * Set true to skip binding even if present in this file — used for the
   * M16 / M18 holds until Bhanu confirms the BL-side unblocks are done.
   * RouteManager reports these as AUTH-TODO/HOLD rather than binding them.
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
// M14 — Score (1 route)
// ─────────────────────────────────────────────────────────────────────────
const SCORE_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.SCORE, routeId: 'get-score', method: 'GET', path: '/score/{facultyId}', auth: RouteAuth.JWT },
];

// ─────────────────────────────────────────────────────────────────────────
// M15 — Leaderboard (2 routes)
// ─────────────────────────────────────────────────────────────────────────
const LEADERBOARD_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.LEADERBOARD, routeId: 'get-rankings', method: 'GET', path: '/leaderboard', auth: RouteAuth.JWT },
  { moduleId: ModuleIdentifier.LEADERBOARD, routeId: 'get-my-ranking', method: 'GET', path: '/leaderboard/rankings/{facultyId}', auth: RouteAuth.JWT },
];

// ─────────────────────────────────────────────────────────────────────────
// M16 — Notification (6 routes / 4 Lambdas) — ON HOLD until Bhanu confirms
// the self-registration block is cut. Do NOT remove `hold` until confirmed.
// ─────────────────────────────────────────────────────────────────────────
const NOTIFICATION_HOLD = 'B-002: blocked on Bhanu confirming M16 self-registration block deletion';
const NOTIFICATION_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'get-notifications', method: 'GET', path: '/notifications', auth: RouteAuth.JWT, hold: NOTIFICATION_HOLD },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'get-notifications', method: 'GET', path: '/notifications/count', auth: RouteAuth.JWT, hold: NOTIFICATION_HOLD },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'mark-read', method: 'PATCH', path: '/notifications/{id}/read', auth: RouteAuth.JWT, hold: NOTIFICATION_HOLD },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'mark-read', method: 'PATCH', path: '/notifications/{notificationId}/read', auth: RouteAuth.JWT, hold: NOTIFICATION_HOLD },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'get-preferences', method: 'GET', path: '/notifications/preferences', auth: RouteAuth.JWT, hold: NOTIFICATION_HOLD },
  { moduleId: ModuleIdentifier.NOTIFICATION, routeId: 'update-preferences', method: 'PUT', path: '/notifications/preferences', auth: RouteAuth.JWT, hold: NOTIFICATION_HOLD },
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
// M18 — APAR (8 routes) — ON HOLD until Bhanu confirms temp RestApi deleted
// ─────────────────────────────────────────────────────────────────────────
const APAR_HOLD = 'B-002: blocked on Bhanu confirming M18 temp unauthenticated RestApi deletion';
const APAR_ROUTES: RouteDefinition[] = [
  { moduleId: ModuleIdentifier.APAR, routeId: 'open-cycle', method: 'POST', path: '/apar/cycles', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'create-draft', method: 'POST', path: '/apar/drafts', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'ai-assist', method: 'POST', path: '/apar/ai-assist', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'submit', method: 'POST', path: '/apar/{aparId}/submit', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'self-assessment', method: 'PUT', path: '/apar/{aparId}/self-assessment', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'hod-review', method: 'POST', path: '/apar/{aparId}/review/hod', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'director-review', method: 'POST', path: '/apar/{aparId}/review/director', auth: RouteAuth.JWT, hold: APAR_HOLD },
  { moduleId: ModuleIdentifier.APAR, routeId: 'calculate-score', method: 'GET', path: '/apar/score/{facultyId}/{year}', auth: RouteAuth.JWT, hold: APAR_HOLD },
];

/** All 28 routes across M13–M18. */
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