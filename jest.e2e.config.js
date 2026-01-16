module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  globalSetup: '<rootDir>/tests/e2e/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/e2e/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.ts'],
  testTimeout: 30000, // 30 seconds for e2e tests
  maxWorkers: 1, // Run e2e tests serially to avoid race conditions
  maxConcurrency: 1, // Only one test file at a time
};
