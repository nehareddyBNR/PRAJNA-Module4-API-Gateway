import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult, APIGatewayAuthorizerWithContextResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Standard Context interface expected by all PRAJNA Backend Modules.
 * API Gateway strictly requires all context values to be strings, numbers, or booleans.
 */
export interface AuthorizerContext {
  principalId: string;
  userId: string;
  role: string;
  campusId: string;
  campus: string;
  departmentId: string;
  department: string;
  facultyId: string;
  [key: string]: string | number | boolean | null | undefined;
}

const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
  throw new Error('Missing required environment variables for JWT verification');
}

/**
 * The CognitoJwtVerifier instance is created outside the handler function.
 * This is crucial for performance: it caches the User Pool JWKS (JSON Web Key Set)
 * in memory. On subsequent Lambda invocations (warm starts), it validates the 
 * signature instantly without making external HTTP requests. It automatically 
 * handles key rotation in the background if the JWKS changes.
 */
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id', // Explicitly validate that this is an ID token
  clientId: USER_POOL_CLIENT_ID, // Validate the 'aud' claim
});

/**
 * Helper function to generate an IAM policy for API Gateway.
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context: AuthorizerContext
): APIGatewayAuthorizerResult {
  
  const authResponse: APIGatewayAuthorizerWithContextResult<AuthorizerContext> = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };

  return authResponse;
}

/**
 * Lambda Authorizer Handler for PRAJNA API Gateway.
 */
export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  try {
    console.log('Authorizer invoked for method:', event.methodArn);

    // 1. Read Authorization header
    // API Gateway headers might be lowercased depending on the client/proxy
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader) {
      console.error('Missing Authorization header');
      throw new Error('Unauthorized'); // 401
    }

    // 2. Extract Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      console.error('Invalid Authorization header format');
      throw new Error('Unauthorized'); // 401
    }

    const token = authHeader.split(' ')[1];

    // 3. Verify JWT payload using Cognito JWKS
    // This validates signature, expiration, issuer, and token_use securely.
    let payload;
    try {
      payload = await jwtVerifier.verify(token);
    } catch (err) {
      console.error('Token verification failed:', err);
      throw new Error('Unauthorized'); // 401
    }

    // 4. Read claims (cast to any to access Cognito custom attributes)
    const claims = payload as any;
    const customRole = (claims['custom:role'] as string) || 'UNKNOWN';
    const campus = (claims['custom:campus'] as string) || 'UNKNOWN';
    const department = (claims['custom:department'] as string) || 'UNKNOWN';
    const facultyId = (claims['custom:facultyId'] as string) || claims['sub'] || 'UNKNOWN';

    // Resolve Role via tie-breaker ranking of cognito:groups, falling back to custom:role
    const groups = claims['cognito:groups'] as string[] | undefined;
    const roleRanking: Record<string, number> = {
      ADMIN: 4,
      PVC: 3,
      PROVC: 3,
      IQAC: 3,
      DIRECTOR: 2,
      HOD: 1,
      FACULTY: 0,
    };

    let resolvedRole = customRole;
    if (Array.isArray(groups) && groups.length > 0) {
      let highestRank = -1;
      let highestRole = resolvedRole;
      
      for (const group of groups) {
        const normGroup = group.trim().toUpperCase();
        const rank = roleRanking[normGroup] !== undefined ? roleRanking[normGroup] : -1;
        if (rank > highestRank) {
          highestRank = rank;
          highestRole = normGroup;
        }
      }
      
      // Only override if we found a valid group role
      if (highestRank >= 0) {
        resolvedRole = highestRole;
      }
    }
    const role = resolvedRole;

    // Map Campus claim to ID and Name
    let campusId = 'BENGALURU';
    let campusName = 'Bengaluru Campus';
    const normCampus = String(campus).trim().toUpperCase();
    if (normCampus === 'BENGALURU' || normCampus.includes('BENGALURU')) {
      campusId = 'BENGALURU';
      campusName = 'Bengaluru Campus';
    } else if (normCampus === 'VIZAG' || normCampus.includes('VIZAG')) {
      campusId = 'VIZAG';
      campusName = 'Vizag Campus';
    } else if (normCampus === 'HYDERABAD' || normCampus.includes('HYDERABAD')) {
      campusId = 'HYDERABAD';
      campusName = 'Hyderabad Campus';
    } else {
      campusId = normCampus || 'BENGALURU';
      campusName = String(campus).trim() || 'Bengaluru Campus';
    }

    // Map Department claim to ID and Name
    let departmentId = 'CSE';
    let departmentName = 'Computer Science';
    const normDept = String(department).trim().toUpperCase();
    if (normDept === 'CSE' || normDept.includes('COMPUTER SCIENCE')) {
      departmentId = 'CSE';
      departmentName = 'Computer Science';
    } else if (normDept === 'ECE' || normDept.includes('ELECTRONICS')) {
      departmentId = 'ECE';
      departmentName = 'Electronics & Communication';
    } else if (normDept === 'ME' || normDept.includes('MECHANICAL')) {
      departmentId = 'ME';
      departmentName = 'Mechanical Engineering';
    } else {
      departmentId = normDept || 'CSE';
      departmentName = String(department).trim() || 'Computer Science';
    }

    // 5. Build AuthorizerContext
    // Note: All values MUST be strings, numbers, or booleans to satisfy API Gateway limits
    const authorizerContext: AuthorizerContext = {
      principalId: String(facultyId),
      userId: String(facultyId),
      role: String(role),
      campusId: campusId,
      campus: campusName,
      departmentId: departmentId,
      department: departmentName,
      facultyId: String(facultyId),
    };

    // 6 & 7. Return IAM Allow Policy with injected context
    // We allow access to the requested methodArn if the token is successfully parsed.
    console.log(`Successfully authorized user: ${facultyId} (${role})`);
    
    return generatePolicy(facultyId, 'Allow', event.methodArn, authorizerContext);

  } catch (error) {
    // If we throw exactly "Unauthorized", API Gateway returns a 401.
    // Otherwise, returning a Deny policy returns a 403.
    // For unparseable tokens or missing headers, 401 is appropriate.
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
    
    console.error('Unexpected error in authorizer', error);
    throw new Error('Unauthorized');
  }
};
