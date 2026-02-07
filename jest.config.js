module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/convex/_generated/api$': '<rootDir>/tests/mocks/convex-generated-api.ts',
    '^@/convex/_generated/dataModel$': '<rootDir>/tests/mocks/convex-generated-dataModel.ts',
    '^@/convex/(.*)$': '<rootDir>/convex/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@inngest/agent-kit$': '<rootDir>/tests/mocks/inngest-agent-kit.ts',
    '^convex/browser$': '<rootDir>/tests/mocks/convex-browser.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/generated/**',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
