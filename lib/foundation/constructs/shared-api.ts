/**
 * @fileoverview Shared API Gateway REST API construct for the PRAJNA platform.
 *
 * This construct enforces platform API standards:
 *
 * - CORS enabled by default for the React SPA frontend
 * - Environment-based throttle limits
 * - X-Ray tracing
 * - Dedicated access log group with structured logging
 * - Binary media type support for file uploads/downloads
 * - Consistent naming, stage deployment, and tagging
 *
 * The platform typically has a single shared API Gateway (created by Module 4),
 * and individual modules add resources and methods to it. This construct is
 * used to create that shared API with all standards pre-applied.
 *
 * @example
 * ```typescript
 * const api = new SharedApi(this, 'PlatformApi', {
 *   config,
 *   module: ModuleIdentifier.API,
 *   identifier: 'faculty',
 *   description: 'PRAJNA Faculty Platform API',
 * });
 *
 * // Add a resource for the auth module:
 * const authResource = api.api.root.addResource('auth');
 * ```
 *
 * @module foundation/constructs/shared-api
 */

import { Construct } from 'constructs';
import { Duration, Annotations } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';
import { SharedLogGroup } from './shared-log-group';

// ─────────────────────────────────────────────────────────────────────────────
// CORS Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default CORS configuration for the PRAJNA platform APIs.
 *
 * Uses wildcard origins with `allowCredentials: false` because the CORS
 * specification forbids combining `Access-Control-Allow-Origin: *` with
 * `Access-Control-Allow-Credentials: true`. Browsers reject such responses.
 *
 * When specific origins are provided via {@link SharedApiProps.corsAllowedOrigins},
 * the construct automatically sets `allowCredentials: true` since the origins
 * are no longer wildcards.
 *
 * @see https://fetch.spec.whatwg.org/#cors-protocol-and-credentials
 */
const DEFAULT_CORS_OPTIONS: apigateway.CorsOptions = {
  allowOrigins: apigateway.Cors.ALL_ORIGINS,
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Amz-Date',
    'X-Api-Key',
    'X-Amz-Security-Token',
    'X-Requested-With',
  ],
  // MUST be false when allowOrigins is '*'; CORS spec forbids this combination.
  // The constructor overrides this to true when specific origins are given.
  allowCredentials: false,
  maxAge: Duration.days(1),
};

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedApi} construct.
 */
export interface SharedApiProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The API-specific identifier (e.g., "faculty", "admin"). */
  readonly identifier: string;

  /** Human-readable description of the API. */
  readonly description: string;

  /**
   * Custom CORS options (overrides the platform default entirely).
   *
   * Use this only when you need full control over CORS. For most cases,
   * prefer {@link corsAllowedOrigins} which handles credentials correctly.
   *
   * @default - Platform default CORS (wildcard origins, no credentials).
   */
  readonly corsOptions?: apigateway.CorsOptions;

  /**
   * Specific allowed CORS origins for the API.
   *
   * When provided, these origins replace the wildcard default and
   * `allowCredentials` is automatically set to `true` — enabling the React
   * SPA to send authentication cookies and Authorization headers.
   *
   * In production, always specify this to restrict cross-origin access:
   * ```typescript
   * corsAllowedOrigins: ['https://prajna.yourinstitution.edu']
   * ```
   *
   * Ignored when {@link corsOptions} is provided directly.
   *
   * @default - ALL_ORIGINS (wildcard) with credentials disabled per CORS spec.
   */
  readonly corsAllowedOrigins?: string[];

  /**
   * Whether to enable CORS.
   * @default true
   */
  readonly corsEnabled?: boolean;

  /**
   * Binary media types supported by the API.
   *
   * Required for file upload/download endpoints.
   *
   * @default ['multipart/form-data', 'application/octet-stream']
   */
  readonly binaryMediaTypes?: string[];

  /**
   * Whether to enable access logging.
   * @default true
   */
  readonly accessLogging?: boolean;

  /**
   * API key requirement for methods.
   * @default false
   */
  readonly apiKeyRequired?: boolean;

  /**
   * Minimum compression size in bytes.
   *
   * Responses larger than this value are compressed with gzip.
   *
   * @default - No compression.
   */
  readonly minimumCompressionSize?: number;

  /**
   * The endpoint type for the API.
   * @default REGIONAL
   */
  readonly endpointType?: apigateway.EndpointType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard API Gateway REST API construct.
 *
 * Creates an API Gateway REST API with all platform standards pre-applied.
 * Includes dedicated access log group, CORS configuration, throttle limits
 * from the environment config, and X-Ray tracing.
 *
 * The underlying CDK `RestApi` is exposed via the {@link api} property
 * for adding resources, methods, and authorizers.
 */
export class SharedApi extends Construct {

  /** The underlying CDK API Gateway REST API. */
  public readonly api: apigateway.RestApi;

  /** The generated API name. */
  public readonly apiName: string;

  /** The API execution ARN (for Lambda permissions). */
  public readonly executionArn: string;

  /** The API invoke URL. */
  public readonly url: string;

  /** The API ID. */
  public readonly apiId: string;

  /** The access log group (if access logging is enabled). */
  public readonly accessLogGroup: SharedLogGroup | undefined;

  constructor(scope: Construct, id: string, props: SharedApiProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedApi identifier');
    requireNonEmpty(props.description, 'SharedApi description');

    // ── Name Generation ──────────────────────────────────────────────────
    this.apiName = ResourceNames.apiGateway(
      props.config.stage,
      props.module,
      props.identifier,
    );

    // ── Access Log Group ─────────────────────────────────────────────────
    const enableAccessLogging = props.accessLogging !== false;

    if (enableAccessLogging) {
      this.accessLogGroup = SharedLogGroup.forApiGateway(this, 'AccessLogs', {
        config: props.config,
        module: props.module,
        apiIdentifier: props.identifier,
      });
    }

    // ── CORS ─────────────────────────────────────────────────────
    // Build CORS options carefully to comply with the CORS specification:
    // allowCredentials MUST be false when allowOrigins is '*'. Browsers
    // hard-reject preflight responses that combine both settings.
    const corsEnabled = props.corsEnabled !== false;
    let corsOptions: apigateway.CorsOptions | undefined;

    if (corsEnabled) {
      if (props.corsOptions) {
        // Fully custom CORS — caller has full control and responsibility.
        corsOptions = props.corsOptions;
      } else if (props.corsAllowedOrigins && props.corsAllowedOrigins.length > 0) {
        // Specific origins: credentials are valid per the CORS spec.
        corsOptions = {
          ...DEFAULT_CORS_OPTIONS,
          allowOrigins: props.corsAllowedOrigins,
          allowCredentials: true,
        };
      } else {
        // Wildcard origins: credentials MUST remain false (CORS spec violation
        // otherwise). This is safe for public APIs; for authenticated SPAs use
        // corsAllowedOrigins to restrict to the SPA domain.
        corsOptions = DEFAULT_CORS_OPTIONS;
        if (props.config.isProduction) {
          Annotations.of(this).addWarning(
            '[PRAJNA] SharedApi: This production API is using wildcard CORS origins. ' +
            'Authenticated requests from the React SPA will fail because credentials ' +
            'cannot be enabled with a wildcard origin. Specify corsAllowedOrigins to ' +
            "restrict access (e.g., ['https://prajna.yourinstitution.edu']).",
          );
        }
      }
    }

    // ── Binary Media Types ───────────────────────────────────────────────
    const binaryMediaTypes = props.binaryMediaTypes ?? [
      'multipart/form-data',
      'application/octet-stream',
    ];

    // ── API Gateway Creation ─────────────────────────────────────────────
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: this.apiName,
      description: `[${props.config.stage.toUpperCase()}] ${props.description}`,
      defaultCorsPreflightOptions: corsOptions,
      binaryMediaTypes,
      endpointTypes: [props.endpointType ?? apigateway.EndpointType.REGIONAL],
      apiKeySourceType: props.apiKeyRequired
        ? apigateway.ApiKeySourceType.HEADER
        : undefined,
      minimumCompressionSize: props.minimumCompressionSize,
      cloudWatchRole: true,
      deployOptions: {
        stageName: props.config.apiGateway.stageName,
        tracingEnabled: props.config.apiGateway.tracingEnabled,
        metricsEnabled: props.config.apiGateway.metricsEnabled,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        // Disabled unconditionally: API Gateway data trace logs the full
        // request and response body, which captures faculty PII, auth tokens,
        // and uploaded document metadata — even in dev/QA environments.
        dataTraceEnabled: false,
        throttlingRateLimit: props.config.apiGateway.throttleRateLimit,
        throttlingBurstLimit: props.config.apiGateway.throttleBurstLimit,
        ...(this.accessLogGroup && {
          accessLogDestination: new apigateway.LogGroupLogDestination(
            this.accessLogGroup.logGroup,
          ),
          accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
            caller: true,
            httpMethod: true,
            ip: true,
            protocol: true,
            requestTime: true,
            resourcePath: true,
            responseLength: true,
            status: true,
            user: true,
          }),
        }),
      },
    });

    this.executionArn = this.api.arnForExecuteApi();
    this.url = this.api.url;
    this.apiId = this.api.restApiId;

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Adds a root-level resource to the API.
   *
   * @param pathPart - The resource path part (e.g., "auth", "storage").
   * @returns The created API Gateway Resource.
   *
   * @example
   * ```typescript
   * const authResource = api.addResource('auth');
   * const loginResource = authResource.addResource('login');
   * ```
   */
  addResource(pathPart: string): apigateway.Resource {
    return this.api.root.addResource(pathPart);
  }

  /**
   * Creates a Lambda integration for adding methods to resources.
   *
   * This is a convenience method that creates a properly configured
   * `LambdaIntegration` with proxy mode enabled.
   *
   * @param handler - The Lambda function to integrate.
   * @param options - Optional integration configuration.
   * @returns The Lambda integration.
   */
  static createLambdaIntegration(
    handler: import('aws-cdk-lib/aws-lambda').IFunction,
    options?: apigateway.LambdaIntegrationOptions,
  ): apigateway.LambdaIntegration {
    return new apigateway.LambdaIntegration(handler, {
      proxy: true,
      allowTestInvoke: true,
      ...options,
    });
  }

  /**
   * Adds a usage plan with an API key for rate-limiting external consumers.
   *
   * @param id - The construct ID for the usage plan.
   * @param props - Usage plan configuration.
   * @returns An object containing the usage plan and API key.
   */
  addUsagePlan(
    id: string,
    props: {
      readonly name: string;
      readonly description: string;
      readonly rateLimit: number;
      readonly burstLimit: number;
      readonly quota?: apigateway.QuotaSettings;
    },
  ): { readonly usagePlan: apigateway.UsagePlan; readonly apiKey: apigateway.IApiKey } {
    const apiKey = this.api.addApiKey(`${id}Key`, {
      apiKeyName: `${this.apiName}-${id.toLowerCase()}`,
      description: props.description,
    });

    const usagePlan = this.api.addUsagePlan(`${id}Plan`, {
      name: props.name,
      description: props.description,
      throttle: {
        rateLimit: props.rateLimit,
        burstLimit: props.burstLimit,
      },
      quota: props.quota,
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
    });

    usagePlan.addApiKey(apiKey);

    return { usagePlan, apiKey };
  }

  /**
   * Grants the given principal permission to invoke the API.
   *
   * @param grantee - The principal to grant invoke access to.
   * @returns The grant result.
   */
  grantInvoke(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['execute-api:Invoke'],
      resourceArns: [this.api.arnForExecuteApi()],
    });
  }
}
