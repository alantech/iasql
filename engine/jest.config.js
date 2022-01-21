// Based on: https://chiragrupani.medium.com/writing-unit-tests-in-typescript-d4719b8a0a40
module.exports = {
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testRegex: './test/.*\\.ts$',
  testPathIgnorePatterns: ['./test/helpers.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  ignot
}