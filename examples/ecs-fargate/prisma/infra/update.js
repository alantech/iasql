const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

const REGION = process.env.AWS_REGION ?? '';

// TODO replace with your desired project name
const APP_NAME = pkg.name;

const prisma = new PrismaClient()

async function main() {
  const repo_uri = (await prisma.ecs_simplified.findFirst({
    where: { app_name: APP_NAME},
    select: { repository_uri: true }
  })).repository_uri;

  console.log('Docker login...')
  execSync(`aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${repo_uri}`)

  console.log('Building image...')
  execSync(`docker build -t ${APP_NAME}-repository ${__dirname}/../app`);

  console.log('Tagging image...')
  execSync(`docker tag ${APP_NAME}-repository:latest ${repo_uri}:latest`);

  console.log('nPushing image...')
  execSync(`docker push ${repo_uri}:latest`);

  console.log('Force new deployment')
  await prisma.ecs_simplified.update({
    where: { name: APP_NAME },
    data: { force_new_deployment: true }
  });
  const apply = await prisma.$queryRaw`SELECT * from iasql_apply();`
  console.dir(apply)
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })