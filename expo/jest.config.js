module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Jest 30 also discovers .cjs. This node:test suite runs in its own CI step.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/scripts/security-forks\\.test\\.cjs$'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg|ttf|woff|woff2|wav|mp3|m4a|aac)$': '<rootDir>/src/__mocks__/fileMock.js',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
};
