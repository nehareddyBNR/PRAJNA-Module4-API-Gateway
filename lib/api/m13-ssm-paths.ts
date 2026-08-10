/**
 * @fileoverview M13 (Approval) SSM parameter path helpers for Module 4 route binding.
 * 
 * This provides the M4 binding convention paths (routeId-fn-arn) that M13 publishes to.
 * These mirror the ApprovalParameters helpers in @prajna-platform/platform-foundation
 * but are local to M4 until the npm package is updated.
 * 
 * @module lib/api/m13-ssm-paths
 */

import { ResourceNames } from '@prajna-platform/platform-foundation';
import { ModuleIdentifier, Stage } from '@prajna-platform/platform-foundation';

/**
 * M4 binding convention paths for Module 13 (Approval) Lambda ARNs.
 * M13 publishes each Lambda ARN to BOTH the Foundation convention
 * (e.g., create-request-function-arn) AND the M4 convention (e.g., start-fn-arn).
 */
export class M13M4BindingPaths {
  
  /** M4 binding: POST /approval/start */
  static startFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'start-fn-arn');
  }

  /** M4 binding: POST /approval/{requestId}/action */
  static submitActionFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'submit-action-fn-arn');
  }

  /** M4 binding: POST /approval/{requestId}/resubmit */
  static resubmitFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'resubmit-fn-arn');
  }

  /** M4 binding: GET /approval/{requestId} */
  static getStatusFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'get-status-fn-arn');
  }

  /** M4 binding: GET /approval/pending */
  static getPendingFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'get-pending-fn-arn');
  }

  /** M4 binding: GET /approval/pending/me/count */
  static pendingMineCountFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'pending-mine-count-fn-arn');
  }

  /** M4 binding: GET /approval/health (public) */
  static healthFnArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'health-fn-arn');
  }
}