const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

// TODO replace with your desired project name
const appName = pkg.name;
const cbRole = `${appName}codebuild`;
const ghToken = process.env.GH_PAT;
const region = process.env.AWS_REGION;
const port = 8088;
const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const cloudwatchLogsArn = 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess';
const pushEcrPolicyArn = 'arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds';
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
  await prisma.iam_role.upsert({
    where: { role_name: cbRole },
    create: cbData,
    update: cbData,
  });

  // In Prisma's queryRaw template variables cannot be used inside SQL string literals so pass the whole string as a variable
  const repoName = `${appName}-repository`;
  const buildSpecRes = await prisma.$queryRaw`SELECT generate_put_ecr_image_build_spec(${region}, 'latest', ${repoName}, ${repoUri}, 'examples/ecs-fargate/prisma/app')`;
  const buildSpec = buildSpecRes[0]['generate_put_ecr_image_build_spec'];

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

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`)

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