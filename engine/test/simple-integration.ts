import { execSync, } from 'child_process'

jest.setTimeout(30000);

// Could use $() but requires nasty escaping
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8', }).trim();

beforeAll(() => {
  // Set up the env file
  execSync('echo AO_ENABLED=true >> .env');
  execSync('echo AO_DOMAIN=https://auth.iasql.com/ >> .env');
  execSync('echo AO_AUDIENCE=https://api.iasql.com >> .env');
  execSync('echo IRONPLANS_TOKEN=${IRONPLANS_TOKEN} >> .env');
  // Build the docker containers
  execSync('docker-compose --env-file .env up --build --detach');
  // Wait for them to be usable
  execSync('while ! curl --output /dev/null --silent --head --fail http://localhost:8088/health; do sleep 1 && echo -n .; done;');
});

afterAll(() => {
  // Dump the logs for potential debugging
  console.log('Engine logs');
  console.log(execSync('docker logs engine_change_engine_1'));
  console.log('Postgres logs');
  console.log(execSync('docker logs engine_postgresql_1'));
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
      --header 'authorization: Bearer ${process.env.IRONPLANS_TOKEN}' \
      --header 'content-type: application/json' \
      --data '{
        "dbAlias": "__${sha}__",
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
        -H 'authorization: Bearer ${process.env.IRONPLANS_TOKEN}' \
        -H "Content-Type: application/json" \
        -f \
        -s \
        -S http://localhost:8088/v1/db/apply \
        -d '{"dbAlias": "__${sha}__"}'
    `);
  });

  it('should run list correctly', () => {
    execSync(`
      curl \
        -H 'authorization: Bearer ${process.env.IRONPLANS_TOKEN}' \
        -f \
        -s \
        -S http://localhost:8088/v1/db/list
    `);
  });

  it('should run remove correctly', () => {
    execSync(`
      curl \
        -H 'authorization: Bearer ${process.env.IRONPLANS_TOKEN}' \
        -f \
        -s \
        -S http://localhost:8088/v1/db/remove/__${sha}__
    `);
  });
});
