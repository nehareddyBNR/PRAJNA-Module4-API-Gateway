// Set up environment variables before importing
process.env.USER_POOL_ID = 'ap-south-1_test';
process.env.USER_POOL_CLIENT_ID = 'client_test';

import { APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
const { handler } = require('../../src/auth/authorizer/index');

const mockVerify = jest.fn();
(global as any).mockVerifyImpl = mockVerify;

jest.mock('aws-jwt-verify', () => {
  return {
    CognitoJwtVerifier: {
      create: jest.fn().mockImplementation(() => {
        return {
          verify: (token: string) => (global as any).mockVerifyImpl(token),
        };
      }),
    },
  };
});

describe('Cognito Lambda Authorizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createEvent = (authHeader?: string): APIGatewayRequestAuthorizerEvent => {
    return {
      type: 'REQUEST',
      methodArn: 'arn:aws:execute-api:ap-south-1:123456789012:apiId/stage/GET/path',
      headers: authHeader ? { Authorization: authHeader } : {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
    } as any;
  };

  test('throws error if Authorization header is missing', async () => {
    const event = createEvent();
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });

  test('throws error if Authorization header does not start with Bearer', async () => {
    const event = createEvent('Basic dGVzdDp0ZXN0');
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });

  test('returns Allow policy with mapped flat context on successful token verification', async () => {
    mockVerify.mockResolvedValue({
      'custom:role': 'FACULTY',
      'custom:campus': 'BENGALURU',
      'custom:department': 'CSE',
      'custom:facultyId': 'faculty-123',
      sub: 'sub-123',
    });

    const event = createEvent('Bearer token123');
    const result = await handler(event);

    expect(result.principalId).toBe('faculty-123');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    
    // Check injected context fields
    const context = result.context!;
    expect(context.userId).toBe('faculty-123');
    expect(context.role).toBe('FACULTY');
    expect(context.campusId).toBe('BENGALURU');
    expect(context.campus).toBe('Bengaluru Campus');
    expect(context.departmentId).toBe('CSE');
    expect(context.department).toBe('Computer Science');
    expect(context.facultyId).toBe('faculty-123');
  });

  test('handles human-readable campus and department values and maps them correctly', async () => {
    mockVerify.mockResolvedValue({
      'custom:role': 'HOD',
      'custom:campus': 'Vizag Campus',
      'custom:department': 'Electronics & Communication',
      'custom:facultyId': 'faculty-456',
      sub: 'sub-456',
    });

    const event = createEvent('Bearer token456');
    const result = await handler(event);

    const context = result.context!;
    expect(context.campusId).toBe('VIZAG');
    expect(context.campus).toBe('Vizag Campus');
    expect(context.departmentId).toBe('ECE');
    expect(context.department).toBe('Electronics & Communication');
  });

  test('uses sub claim when custom:facultyId is missing', async () => {
    mockVerify.mockResolvedValue({
      'custom:role': 'ADMIN',
      'custom:campus': 'HYDERABAD',
      'custom:department': 'Mechanical Engineering',
      sub: 'sub-789',
    });

    const event = createEvent('Bearer token789');
    const result = await handler(event);

    expect(result.principalId).toBe('sub-789');
    const context = result.context!;
    expect(context.userId).toBe('sub-789');
    expect(context.facultyId).toBe('sub-789');
    expect(context.campusId).toBe('HYDERABAD');
    expect(context.campus).toBe('Hyderabad Campus');
    expect(context.departmentId).toBe('ME');
    expect(context.department).toBe('Mechanical Engineering');
  });

  test('resolves role using cognito:groups tie-breaker when multiple groups exist', async () => {
    mockVerify.mockResolvedValue({
      'custom:role': 'FACULTY',
      'cognito:groups': ['FACULTY', 'HOD', 'DIRECTOR', 'UNKNOWN_GROUP'],
      'custom:campus': 'BENGALURU',
      'custom:department': 'CSE',
      'custom:facultyId': 'faculty-123',
      sub: 'sub-123',
    });

    const event = createEvent('Bearer token123');
    const result = await handler(event);

    const context = result.context!;
    // DIRECTOR (rank 2) is highest among ['FACULTY' (0), 'HOD' (1), 'DIRECTOR' (2)]
    expect(context.role).toBe('DIRECTOR');
  });

  test('throws error if verifier fails', async () => {
    mockVerify.mockRejectedValue(new Error('Invalid token'));

    const event = createEvent('Bearer badtoken');
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });
});
