module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/*.ts',
    '!src/test/**',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 5,
      statements: 5
    }
  },
  setupFilesAfterEnv: ['./src/tests/setup.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/tests/mocks/vscode.ts'
  }
}; 