/**
 * @fileoverview Reusable IAM policy statements for Amazon DynamoDB.
 *
 * Provides least-privilege DynamoDB policy statements scoped to specific
 * tables and indexes.
 *
 * @module foundation/iam/dynamodb-policy
 */

import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Reusable IAM policy statements for DynamoDB operations.
 */
export class DynamoDbPolicy {

  private constructor() {}

  /**
   * Allows reading items from a table (GetItem, Query, Scan).
   *
   * @param tableArn - The DynamoDB table ARN.
   * @returns A policy statement granting read operations.
   */
  static readStatement(tableArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'DynamoDBRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:BatchGetItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:ConditionCheckItem',
      ],
      resources: [tableArn, `${tableArn}/index/*`],
    });
  }

  /**
   * Allows writing items to a table (PutItem, UpdateItem, DeleteItem).
   *
   * @param tableArn - The DynamoDB table ARN.
   * @returns A policy statement granting write operations.
   */
  static writeStatement(tableArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'DynamoDBWrite',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:BatchWriteItem',
      ],
      resources: [tableArn],
    });
  }

  /**
   * Allows full CRUD operations on a table and its indexes.
   *
   * @param tableArn - The DynamoDB table ARN.
   * @returns An array of policy statements granting full CRUD access.
   */
  static readWriteStatements(tableArn: string): iam.PolicyStatement[] {
    return [
      DynamoDbPolicy.readStatement(tableArn),
      DynamoDbPolicy.writeStatement(tableArn),
    ];
  }

  /**
   * Allows querying a specific Global Secondary Index.
   *
   * @param tableArn - The DynamoDB table ARN.
   * @param indexName - The GSI name.
   * @returns A policy statement scoped to the specific index.
   */
  static queryIndexStatement(tableArn: string, indexName: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'DynamoDBQueryIndex',
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Query'],
      resources: [`${tableArn}/index/${indexName}`],
    });
  }

  /**
   * Allows reading DynamoDB Streams for event-driven processing.
   *
   * @param tableArn - The DynamoDB table ARN.
   * @returns A policy statement granting stream read access.
   */
  static streamReadStatement(tableArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'DynamoDBStreamRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:DescribeStream',
        'dynamodb:ListStreams',
      ],
      resources: [`${tableArn}/stream/*`],
    });
  }

  /**
   * Allows describing a table (metadata only, no data access).
   *
   * @param tableArn - The DynamoDB table ARN.
   * @returns A policy statement granting describe access.
   */
  static describeStatement(tableArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'DynamoDBDescribe',
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:DescribeTable', 'dynamodb:DescribeTimeToLive'],
      resources: [tableArn],
    });
  }

  /**
   * Allows DynamoDB transactions (TransactWriteItems, TransactGetItems).
   *
   * @param tableArns - ARNs of all tables involved in transactions.
   * @returns A policy statement granting transactional access.
   */
  static transactionStatements(tableArns: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'DynamoDBTransactions',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:ConditionCheckItem',
      ],
      resources: tableArns,
    });
  }
}
