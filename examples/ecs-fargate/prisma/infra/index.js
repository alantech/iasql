const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

// TODO replace with your desired project name
const appName = pkg.name;
const region = process.env.AWS_REGION;
const port = 8088;
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

  // generate buildspec and store into an s3 bucket
  const repoName = `${appName}-repository`;
  const buildSpecRes = await prisma.$queryRaw`SELECT generate_put_ecr_image_build_spec(${region}, 'latest', ${repoName}, ${repoUri}, 'examples/ecs-fargate/prisma/app')`;
  const buildSpec = buildSpecRes[0]['generate_put_ecr_image_build_spec'];

  await prisma.

  // generate a pipeline for building image
  const stages = JSON.stringify([
    {
      name: 'Source',
      actions: [
        {
          name: 'SourceAction',
          actionTypeId: {
            category: 'Source',
            owner: 'ThirdParty',
            version: '1',
            provider: 'GitHub',
          },
          configuration: {
            Owner: 'iasql',
            Repo: ghUrl,
            Branch: 'main',
            OAuthToken: `${process.env.GH_PAT}`,
          },
          outputArtifacts: [
            {
              name: 'Source',
            },
          ],
        },
      ],
    },
    {
      name: 'Build',
      actions: [
        {
          inputArtifacts: [
            {
              name: 'Source',
            },
          ],
          name: 'Build',
          actionTypeId: {
            category: 'Build',
            owner: 'AWS',
            version: '1',
            provider: 'AWS CodeBuild',
          },
          configuration: {
            ProjectName: `${appName}`,
            PrimarySource: 'Source'
          },
          outputArtifacts: [
            {
              name: "Image"
            }
          ]
        },
      ],
    },
  ]);


  const pjData = {
    project_name: appName,
    region,
    source_type: 'GITHUB',
    service_role_name: cbRole,
    source_location: ghUrl,
    build_spec: buildSpec,
  };
  await prisma.codebuild_project.upsert({
    where: { project_name_region: {project_name: appName, region } },
    create: pjData,
    update: pjData,
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`)

  await prisma.codebuild_build_import.create({
    data: {
      project_name: appName,
      region
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