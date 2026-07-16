import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';

export interface PrajnaCognitoGroupsProps {
  /** The full environment configuration object. */
  readonly config: PrajnaEnvironmentConfig;

  /** The ID of the User Pool where groups will be created. */
  readonly userPoolId: string;

  /** The module identifier. */
  readonly module: ModuleIdentifier;
}

/**
 * Creates the standard set of User Groups for the PRAJNA platform.
 */
export class PrajnaCognitoGroups extends Construct {
  
  /** The created User Pool Groups mapped by their exact group name. */
  public readonly groups: Map<string, cognito.CfnUserPoolGroup>;

  /** The standard list of group names. */
  public readonly groupNames: string[];

  constructor(scope: Construct, id: string, props: PrajnaCognitoGroupsProps) {
    super(scope, id);

    requireNonEmpty(props.userPoolId, 'userPoolId');

    this.groups = new Map<string, cognito.CfnUserPoolGroup>();
    
    // Standard platform user groups as defined in Phase 1
    this.groupNames = [
      'ADMIN',
      'PVC',
      'IQAC',
      'DIRECTOR',
      'HOD',
      'FACULTY'
    ];

    for (const groupName of this.groupNames) {
      const group = new cognito.CfnUserPoolGroup(this, `Group-${groupName}`, {
        userPoolId: props.userPoolId,
        groupName: groupName,
        description: `PRAJNA ${groupName} Role - provisioned for ${props.config.environmentName}`,
      });
      
      this.groups.set(groupName, group);
    }

    // Apply platform standard module tags to all groups created in this construct
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }
}
