// Based on: https://chiragrupani.medium.com/writing-unit-tests-in-typescript-d4719b8a0a40
module.exports = {
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testRegex: './test/.*\\.ts$',
  testPathIgnorePatterns: ['./test/helpers.ts', './test/setup.ts',],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  setupFilesAfterEnv: ['./test/setup.ts'],
}