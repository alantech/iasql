const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

// TODO replace with your desired project name
const appName = pkg.name;
const cbRole = `${appName}codebuild`;
const ghToken = process.env.GH_PAT;
const port = 8088;
const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const cloudwatchLogsArn = 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess';
const pushEcrPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess';
const assumeServicePolicy = {
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
          "Service": "codebuild.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    },
  ],
  "Version": "2012-10-17"
};
const ghUrl = 'https://github.com/iasql/iasql-engine';

const prisma = new PrismaClient()

async function main() {
  const ecsData = {
    app_name: appName,
    public_ip: true,
    app_port: port,
    image_tag: 'latest'
  };
  await prisma.ecs_simplified.upsert({
    where: { app_name: appName},
    create: ecsData,
    update: ecsData,
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`)

  await prisma.source_credentials_import.create({
    data: {
      token: ghToken,
      source_type: 'GITHUB',
      auth_type: 'PERSONAL_ACCESS_TOKEN',
    }
  })

  const repoUri = (await prisma.ecs_simplified.findFirst({
    where: { app_name: appName },
    select: { repository_uri: true }
  })).repository_uri;

  const cbData = {
    role_name: cbRole,
    assume_role_policy_document: assumeServicePolicy,
    attached_policies_arns: [codebuildPolicyArn, cloudwatchLogsArn, pushEcrPolicyArn]
  }
  await prisma.role.upsert({
    where: { role_name: cbRole },
    create: cbData,
    update: cbData,
  });

  const buildSpec = `
    version: 0.2

    phases:
      pre_build:
        commands:
          - echo Logging in to Amazon ECR...
          - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${repoUri}
      build:
        commands:
          - echo Building the Docker image...
          - docker build -t ${appName}-repository examples/ecs-fargate/prisma/app
          - docker tag ${appName}-repository:latest ${repoUri}:latest
      post_build:
        commands:
          - echo Pushing the Docker image...
          - docker push ${repoUri}:latest
  `;

  const pjData = {
    project_name: appName,
    source_type: 'GITHUB',
    service_role_name: cbRole,
    source_location: ghUrl,
    build_spec: buildSpec,
  };
  await prisma.codebuild_project.upsert({
    where: { project_name: appName},
    create: pjData,
    update: pjData,
  });
  await prisma.codebuild_build_import.create({
    data: {
      project_name: appName,
    }
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`)
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })