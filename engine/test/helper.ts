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
