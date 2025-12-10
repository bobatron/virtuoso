/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^electron$': '<rootDir>/src/__mocks__/electron.ts',
    '^electron-store$': '<rootDir>/src/__mocks__/electron-store.ts',
    '^@xmpp/client$': '<rootDir>/src/__mocks__/@xmpp/client.ts',
    '^ltx$': '<rootDir>/src/__mocks__/ltx.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@xmpp)/)',
  ],
};
