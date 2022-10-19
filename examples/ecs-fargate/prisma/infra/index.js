const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

// TODO replace with your desired project name
const appName = pkg.name;
const cpRole = `${appName}codebuild`;
const region = process.env.AWS_REGION;
const port = 8088;

const codepipelinePolicyArn = 'arn:aws:iam::aws:policy/AWSCodePipelineAdminAccess';
const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const cloudwatchLogsArn = 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess';
const pushEcrPolicyArn = 'arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds';
const assumeServicePolicy = {
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "codepipeline.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    },
  ],
  "Version": "2012-10-17"
};
const cpRoleData = {
  role_name: cpRole,
  assume_role_policy_document: assumeServicePolicy,
  attached_policies_arns: [codepipelinePolicyArn, codebuildPolicyArn, cloudwatchLogsArn, pushEcrPolicyArn]
}

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

  const cpStore = { type: 'S3', location: bucketName };

  const cpData = {
    name: pipelineName,
    artifact_store: cpStore,
    stages: stages,
    service_role_name: cpRole,
  };

  await prisma.iam_role.upsert({
    where: { role_name: cbRole },
    create: cbRoleData,
    update: cbRoleData,
  });

  await prisma.iam_role.upsert({
    where: { role_name: cpRole },
    create: cpRoleData,
    update: cpRoleData,
  });

  await prisma.bucket.create({
    data: cpBucketData
  })

  await prisma.codebuild_project.upsert({
    where: { project_name_region: {project_name: appName, region } },
    create: pjData,
    update: pjData,
  });    

  await prisma.pipeline_declaration.upsert({
    where: { name: pipelineName },
    create: cpData,
    update: cpData,
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`);

  // clean up bucket before finishing
  console.dir(await prisma.$queryRaw`SELECT * FROM s3_clean_bucket(${bucketName});`);
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })