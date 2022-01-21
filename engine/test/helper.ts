import { execSync, } from 'child_process'

// Some of the `jest` tests are very slow and cause
// timeouts on bitbucket pipeline
console.log(`============ testSetupFile Loaded ===========`);
jest.setTimeout(240000);

beforeAll(() => {
  execSync('cd test && docker-compose up -d && sleep 5');
});

afterAll(() => {
  execSync('cd test && docker-compose down');
});

const chars = [
  Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  Array(26).fill('A').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
].flat();
const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
const prefix = Array(7).fill('').map(() => randChar()).join('');