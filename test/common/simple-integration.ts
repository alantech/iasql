import { execSync, } from 'child_process'
import { MIN_CLI_VERSION, } from '../../src/router/index'

jest.setTimeout(30000);

// Could use $() but requires nasty escaping
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8', }).trim();

beforeAll(() => {
  // Set up the env file
  execSync('echo A0_ENABLED=true >> .env');
  execSync('echo A0_DOMAIN=https://auth.iasql.com/ >> .env');
  execSync('echo A0_AUDIENCE=https://api.iasql.com >> .env');
  // Build the docker containers
  execSync('docker-compose --env-file .env up --build --detach');
  // Wait for them to be usable
  execSync('while ! curl --output /dev/null --silent --head --fail http://localhost:8088/health; do sleep 1 && echo -n .; done;');
});

afterAll(() => {
  // Dump the logs for potential debugging
  console.log('Engine logs');
  console.log(execSync('docker logs iasql-engine_change_engine_1', { encoding: 'utf8', }));
  console.log('Postgres logs');
  console.log(execSync('docker logs iasql-engine_postgresql_1', { encoding: 'utf8', }));
  // Terminate the docker container
  execSync('docker stop $(docker ps -q)');
});

describe('Basic integration testing', () => {
  it('should run new correctly', () => {
    // `execSync` throws on error, so this should be good
    execSync(`
      curl \
      --request POST \
      --url 'http://localhost:8088/v1/db/new/' \
      --show-error --silent --fail \
      --header 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
      --header 'content-type: application/json' \
      --header 'cli-version: ${MIN_CLI_VERSION}' \
      --data '{
        "dbAlias": "__${sha}__",
        "awsRegion": "us-east-1",
        "awsAccessKeyId": "${process.env.AWS_ACCESS_KEY_ID}",
        "awsSecretAccessKey": "${process.env.AWS_SECRET_ACCESS_KEY}"
      }'
    `);
  });

  it('should run new correctly without a dbAlias', () => {
    execSync(`
      curl \
      --request POST \
      --url 'http://localhost:8088/v1/db/new/' \
      --show-error --silent --fail \
      --header 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
      --header 'content-type: application/json' \
      --header 'cli-version: ${MIN_CLI_VERSION}' \
      --data '{
        "awsRegion": "us-east-1",
        "awsAccessKeyId": "${process.env.AWS_ACCESS_KEY_ID}",
        "awsSecretAccessKey": "${process.env.AWS_SECRET_ACCESS_KEY}"
      }'
    `);
  });

  it('should run apply correctly', () => {
    execSync(`
      curl \
        -X POST \
        -H 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
        -H 'Content-Type: application/json' \
        -H 'cli-version: ${MIN_CLI_VERSION}' \
        -f \
        -s \
        -S http://localhost:8088/v1/db/apply \
        -d '{"dbAlias": "__${sha}__"}'
    `);
  });

  it('should error when installing module without deps', () => {
    expect(() => {
      execSync(`
        curl \
          -H 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
          -f \
          -s \
          -S http://localhost:8088/v1/module/install
          -d '{"dbAlias": "__${sha}__", "list": ["aws_ec2@0.0.1"]}'
      `);
    }).toThrow();
  });

  it('should error without a cli version', () => {
    expect(() => {
      execSync(`
        curl \
          -H 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
          -f \
          -s \
          -S http://localhost:8088/v1/db/list
      `);
    }).toThrow();
  });

  it('should error with an old cli version', () => {
    expect(() => {
      execSync(`
        curl \
          -H 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
          -H 'cli-version: 0.1' \
          -f \
          -s \
          -S http://localhost:8088/v1/db/list
      `);
    }).toThrow();
  });

  it('should run list correctly', () => {
    execSync(`
      curl \
        -H 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
        -H 'cli-version: ${MIN_CLI_VERSION}' \
        -f \
        -s \
        -S http://localhost:8088/v1/db/list
    `);
  });

  it('should run remove correctly', () => {
    execSync(`
      curl \
        -H 'authorization: Bearer ${process.env.A0_IASQL_API_TOKEN}' \
        -H 'cli-version: ${MIN_CLI_VERSION}' \
        -f \
        -s \
        -S http://localhost:8088/v1/db/remove/__${sha}__
    `);
  });
});