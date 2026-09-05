module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg|ttf|woff|woff2|wav|mp3|m4a|aac)$': '<rootDir>/src/__mocks__/fileMock.js',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
};
