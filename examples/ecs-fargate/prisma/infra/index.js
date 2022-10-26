const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

function getPrefix() {
  const lowerCaseLetters = Array(26)
    .fill('a')
    .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const digits = Array(10)
    .fill('0')
    .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const chars = [lowerCaseLetters, digits].flat();
  const randChar = ()  => chars[Math.floor(Math.random() * chars.length)];
  const randLetter = () => lowerCaseLetters[Math.floor(Math.random() * lowerCaseLetters.length)];
  return (
    randLetter() +
    Array(6)
      .fill('')
      .map(() => randChar())
      .join('')
  );
}

// TODO replace with your desired project name
const appName = pkg.name;
const pipelineName = `${appName}-pipeline`;
const prefix = getPrefix();
const cbRole = `${appName}codebuild`;
const cpRole = `${appName}codepipeline`;
const region = process.env.AWS_REGION;
const port = 8088;
const bucketName = `${prefix}-${appName}-bucket`;


const codepipelinePolicyArn = 'arn:aws:iam::aws:policy/AWSCodePipelineFullAccess';
const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const cloudwatchLogsArn = 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess';
const pushEcrPolicyArn = 'arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds';
const s3PolicyArn = 'arn:aws:iam::aws:policy/AmazonS3FullAccess';

const assumeServicePolicy = {
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'codepipeline.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
  Version: '2012-10-17',
};
const assumeServicePolicyCodebuild = {
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'codebuild.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
  Version: '2012-10-17',
};

const cbRoleData = {
  role_name: cbRole,
  assume_role_policy_document: assumeServicePolicyCodebuild,
  attached_policies_arns: [codebuildPolicyArn, cloudwatchLogsArn, pushEcrPolicyArn, s3PolicyArn]
}
const cpRoleData = {
  role_name: cpRole,
  assume_role_policy_document: assumeServicePolicy,
  attached_policies_arns: [codepipelinePolicyArn, codebuildPolicyArn, s3PolicyArn],
};

const cpBucketData = {
  name: bucketName,
  region: region
}

const prisma = new PrismaClient();

async function main() {
  const ecsData = {
    app_name: appName,
    public_ip: true,
    app_port: port,
    image_tag: 'latest',
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

  const repoName = `${appName}-repository`;
  const buildSpecRes = await prisma.$queryRaw`SELECT generate_put_ecr_image_build_spec(${region}, 'latest', ${repoName}, ${repoUri}, '$CODEBUILD_SRC_DIR/examples/ecs-fargate/prisma/app')`;
  const buildSpec = buildSpecRes[0]['generate_put_ecr_image_build_spec'];

  const pjData = {
    project_name: appName,
    source_type: 'CODEPIPELINE',
    service_role_name: cbRole,
    build_spec: buildSpec,
  };

  // generate a pipeline for building image
  const stages = [
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
            Repo: 'iasql-engine',
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
            provider: 'CodeBuild',
          },
          configuration: {
            ProjectName: appName,
            PrimarySource: 'Source',
          },
          outputArtifacts: [
            {
              name: 'Image',
            },
          ],
        },
      ],
    },
  ];
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
    where: { name_region: { name: pipelineName, region }},
    create: cpData,
    update: cpData,
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`);

  // clean up bucket before finishing
  console.dir(await prisma.$queryRaw`SELECT * FROM s3_clean_bucket(${bucketName});`);
}

main()
  .catch(e => {
    console.log(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
