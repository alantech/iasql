import { execSync } from 'child_process';

import logger from '../../src/services/logger';

jest.setTimeout(30000);

// Could use $() but requires nasty escaping
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

beforeAll(() => {
  // Build the docker containers
  execSync('docker build -t iasql:latest .');
  execSync('docker run -p 5432:5432 -e IASQL_ENV=ci --name iasql -d iasql');
  // Wait for them to be usable
  execSync(
    'while ! psql postgres://postgres:test@localhost:5432/iasql_metadata -b -q -c "SELECT iasql_engine_health()"; do sleep 1 && echo -n .; done;',
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
      psql \
      "postgres://postgres:test@localhost:5432/iasql_metadata" \
      -t \
      -c \
      "SELECT json_agg(c)->0 FROM iasql_connect('__${sha}__') as c;"
    `);
  });

  it('should run list correctly', () => {
    execSync(`
      psql \
      "postgres://postgres:test@localhost:5432/iasql_metadata" \
      -t \
      -c \
      "SELECT * FROM iasql_db_list();"
    `);
  });

  it('should run remove correctly', () => {
    execSync(`
      psql \
      "postgres://postgres:test@localhost:5432/iasql_metadata" \
      -t \
      -c \
      "SELECT iasql_disconnect('__${sha}__');"
    `);
  });
});
