import { execSync } from 'child_process';

import logger from '../../src/services/logger';

jest.setTimeout(30000);

// Could use $() but requires nasty escaping
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

beforeAll(() => {
  // Build the docker containers
  execSync('docker build -t iasql:latest .');
  execSync('docker run -p 5432:5432 -p 8088:8088 -e IASQL_ENV=ci --name iasql -d iasql');
  // Wait for them to be usable
  execSync(
    'while ! curl --output /dev/null --silent --head --fail http://localhost:8088/health; do sleep 1 && echo -n .; done;',
  );
});

afterAll(() => {
  // Dump the logs for potential debugging
  logger.info('Engine logs');
  logger.info(execSync('docker logs iasql', { encoding: 'utf8' }));
  // Terminate the docker container
  execSync('docker stop $(docker ps -q)');
});

describe('Basic integration testing', () => {
  it('should run new correctly', () => {
    // `execSync` throws on error, so this should be good
    execSync(`
      curl \
      --request POST \
      --url 'http://localhost:8088/v1/db/connect/' \
      --show-error --silent --fail \
      --header 'content-type: application/json' \
      --data '{
        "dbAlias": "__${sha}__"
      }'
    `);
  });

  it('should run export correctly', () => {
    execSync(`
      curl \
        -X POST \
        -H 'Content-Type: application/json' \
        -f \
        -s \
        -S http://localhost:8088/v1/db/export \
        -d '{"dbAlias": "__${sha}__"}'
    `);
  });

  it('should run list correctly', () => {
    execSync(`
      curl \
        -f \
        -s \
        -S http://localhost:8088/v1/db/list
    `);
  });

  it('should run remove correctly', () => {
    execSync(`
      curl \
        -f \
        -s \
        -S http://localhost:8088/v1/db/disconnect/__${sha}__
    `);
  });
});
