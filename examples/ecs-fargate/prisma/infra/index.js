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
  execSync(`aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${repoUri}`)

  console.log('Building image...')
  execSync(`docker build -t ${APP_NAME}-repository ${__dirname}/../app`);

  console.log('Tagging image...')
  execSync(`docker tag ${APP_NAME}-repository:latest ${repoUri}:latest`);

  console.log('Pushing image...')
  execSync(`docker push ${repoUri}:latest`);
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })