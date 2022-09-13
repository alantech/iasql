const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

const REGION = process.env.AWS_REGION ?? '';
const PORT = 8088;

// TODO replace with your desired project name
const APP_NAME = pkg.name;

const prisma = new PrismaClient()

async function main() {
  const data = {
    app_name: APP_NAME,
    public_ip: true,
    app_port: PORT,
    image_tag: 'latest'
  };
  await prisma.ecs_simplified.upsert({
    where: { app_name: APP_NAME},
    create: data,
    update: data,
  });

  const apply = await prisma.$queryRaw`SELECT * from iasql_apply();`
  console.dir(apply)

  const repoUri = (await prisma.ecs_simplified.findFirst({
    where: { app_name: APP_NAME },
    select: { repository_uri: true }
  })).repository_uri;

  console.log('Docker login...')
  console.log(execSync(
    `aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${repoUri}`,
    { stdio: 'pipe', encoding: 'utf8', }, // Output stdout/err through the parent process
  ));

  console.log('Building image...')
  console.log(execSync(
    `docker build -t ${APP_NAME}-repository ${__dirname}/../app`,
    { stdio: 'pipe', encoding: 'utf8', },
  ));

  console.log('Tagging image...')
  console.log(execSync(
    `docker tag ${APP_NAME}-repository:latest ${repoUri}:latest`,
    { stdio: 'pipe', encoding: 'utf8', },
  ));

  console.log('Pushing image...')
  console.log(execSync(
    `docker push ${repoUri}:latest`,
    { stdio: 'pipe', encoding: 'utf8', },
  ));
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })