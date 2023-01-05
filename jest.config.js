// Based on: https://chiragrupani.medium.com/writing-unit-tests-in-typescript-d4719b8a0a40
module.exports = {
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testRunner: 'jest-circus/runner',
  testEnvironment: './jest-environment-fail-fast.js',
  testRegex: './test/.*\\.ts$',
  testPathIgnorePatterns: ['./test/helpers.ts',],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
}