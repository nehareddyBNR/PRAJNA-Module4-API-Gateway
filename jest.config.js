module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>/test'],

  testMatch: ['**/*.test.ts'],

  moduleFileExtensions: ['ts', 'js'],

  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts'
  ],

  coverageDirectory: 'coverage',

  clearMocks: true,

  passWithNoTests: true,

  verbose: true
};
