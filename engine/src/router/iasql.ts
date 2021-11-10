import * as express from 'express'
import { Cluster, Container, ELB, Listener, Repository, RepositoryPolicy, SecurityGroup, Service, Subnet, TargetGroup, TaskDefinition } from '../entity'
import { TypeormWrapper } from '../services/typeorm'
import { writeFileSync } from 'fs';

export const iasql = express.Router();
iasql.use(express.json());

iasql.get('/setup/:dbAlias', async (req, res) => {
  const { dbAlias, } = req.params;
  const orm = await TypeormWrapper.createConn(dbAlias);
  let transaction = '';
  try {
    const defaultVpc = 'vpc-41895538';
    const defaultSubnets = (await orm.find(Subnet, {
      where: {
        vpcId: { vpcId: defaultVpc },
      },
      relations: ["vpcId"],
    })).map((sn: any) => `'${sn.subnetId}'`);
    // Create engine target group
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlEngineTg = 'iasql-engine-target-group';
    const iasqlEngineTgPort = 8088;
    const engineTg = await orm.findOne(TargetGroup, {
      where:
        { targetGroupName: iasqlEngineTg }
    });
    if (!engineTg) {
      transaction += `
        select * from create_target_group(
          '${iasqlEngineTg}', 'ip', ${iasqlEngineTgPort}, '${defaultVpc}', 'TCP'
        );
      `;
    }
    // Create postgres target group
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlPostgresTg = 'iasql-postgres-target-group';
    const iasqlPostgresTgPort = 5432;
    const postgresTg = await orm.findOne(TargetGroup, {
      where:
        { targetGroupName: iasqlPostgresTg }
    });
    if (!postgresTg) {
      transaction += `
        select * from create_target_group(
          '${iasqlPostgresTg}', 'ip', ${iasqlPostgresTgPort}, '${defaultVpc}', 'TCP'
        );
      `;
    }
    // Create engine load balancer
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlEngineLb = 'iasql-engine-load-balancer';
    const engineLb = await orm.findOne(ELB, {
      where:
        { loadBalancerName: iasqlEngineLb }
    });
    if (!engineLb) {
      const subnets = (await orm.find(Subnet, {
        where: {
          vpcId: { vpcId: defaultVpc },
        },
        relations: ["vpcId"],
      })).map((sn: any) => `'${sn.subnetId}'`);
      transaction += `
        select * from create_load_balancer(
          '${iasqlEngineLb}', 'internet-facing', '${defaultVpc}', 'network', array[${subnets.join(',')}], 'ipv4'
        );
      `;
    }
    // Create engine load balancer listener
    const engineListener = await orm.findOne(Listener, { where: { port: iasqlEngineTgPort } });
    if (!engineListener) {
      transaction += `
        select create_listener('${iasqlEngineLb}', ${iasqlEngineTgPort}, 'TCP', 'forward', '${iasqlEngineTg}');
      `;
    }
    // Create postgres load balancer
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlPostgresLb = 'iasql-postgres-load-balancer';
    const postgresLb = await orm.findOne(ELB, {
      where:
        { loadBalancerName: iasqlPostgresLb }
    });
    if (!postgresLb) {
      const subnets = (await orm.find(Subnet, {
        where: {
          vpcId: { vpcId: defaultVpc },
        },
        relations: ["vpcId"],
      })).map((sn: any) => `'${sn.subnetId}'`);
      transaction += `
        select * from create_load_balancer(
          '${iasqlPostgresLb}', 'internet-facing', '${defaultVpc}', 'network', array[${subnets.join(',')}], 'ipv4'
        );
      `;
    }
    // Create posgres load balancer listener
    const postgresListener = await orm.findOne(Listener, { where: { port: iasqlPostgresTgPort } });
    if (!postgresListener) {
      transaction += `
        select create_listener('${iasqlPostgresLb}', ${iasqlPostgresTgPort}, 'TCP', 'forward', '${iasqlPostgresTg}');
      `;
    }
    // Create elastic container registry repository
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlEngineRepository = 'iasql-engine-repository';
    const engineRepository = await orm.findOne(Repository, {
      where:
        { repositoryName: iasqlEngineRepository }
    });
    if (!engineRepository) {
      transaction += `
        select * from create_ecr_repository('${iasqlEngineRepository}');
      `;
    }
    // Attach policy to container registry repository
    const iasqlEngineRepositoryPolicy = '{ "Version" : "2012-10-17", "Statement" : [ { "Sid" : "new statement", "Effect" : "Allow", "Principal" : { "AWS" : "arn:aws:iam::257682470237:user/automate" }, "Action" : [ "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CreateRepository", "ecr:DeleteRepositoryPolicy", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetAuthorizationToken", "ecr:GetDownloadUrlForLayer", "ecr:GetLifecyclePolicy", "ecr:GetLifecyclePolicyPreview", "ecr:GetRepositoryPolicy", "ecr:ListImages", "ecr:ListTagsForResource", "ecr:SetRepositoryPolicy" ] } ]}	';
    const engineRepositoryPolicy = await orm.findOne(RepositoryPolicy, {
      where: {
        repository: { repositoryName: iasqlEngineRepository },
      },
      relations: ["repository"],
    });
    if (!engineRepositoryPolicy) {
      transaction += `
        select * from create_ecr_repository_policy(
          '${iasqlEngineRepository}', '${iasqlEngineRepositoryPolicy}'
        );
      `;
    }
    // create cluster if it do not exist
    const iasqlCluster = 'iasql-cluster';
    const cluster = await orm.findOne(Cluster, { where: { name: iasqlCluster, } });
    if (!cluster) {
      transaction += `
        select * from create_ecs_cluster('${iasqlCluster}');
      `;
    }
    // create engine container
    const iasqlEngineContainer = 'iasql-engine-container';
    const iasqlEnginePort = 8088;
    const iasqlEngineEnvironment = {
      PORT: iasqlEnginePort,
    };
    const engineContainer = await orm.findOne(Container, { where: { name: iasqlEngineContainer, } })
    if (!engineContainer) {
      transaction += `
        select * from create_container_definition(
          '${iasqlEngineContainer}', true, 8192, ${iasqlEnginePort}, ${iasqlEnginePort}, 'tcp',
          '${JSON.stringify(iasqlEngineEnvironment)}', 'latest',
          _ecr_repository_name := '${engineRepository.repositoryName}'
        );
      `;
    }
    // create engine task definition
    const iasqlEngineFamily = 'iasql-engine-task-definition';
    const engineTaskDefiniton = await orm.findOne(TaskDefinition, { where: { family: iasqlEngineFamily }, order: { revision: 'DESC' } });
    const enginetaskDefinitionRevision = engineTaskDefiniton?.revision ? +engineTaskDefiniton.revision + 1 : 1;
    const engineEcsRoleArn = 'arn:aws:iam::257682470237:role/ecsTaskExecutionRole';
    const engineCpuMem = '2vCPU-8GB';
    const engineCompatibility = 'FARGATE';
    const engineNetworkType = 'awsvpc';
    transaction += `
      select *
      from create_task_definition(
        '${iasqlEngineFamily}', ${enginetaskDefinitionRevision}, '${engineEcsRoleArn}', '${engineEcsRoleArn}',
        '${engineNetworkType}', array['${engineCompatibility}']::compatibility_name_enum[], '${engineCpuMem}', array['${iasqlEngineContainer}']
      );
    `;
    // create engine security group
    const iasqlEngineSg = 'iasql-engine-security-group';
    const engineSg = await orm.findOne(SecurityGroup, { where: { groupName: iasqlEngineSg } });
    if (!engineSg) {
      transaction += `
        select *
        from create_security_group(
          '${iasqlEngineSg}', '${iasqlEngineSg}',
          '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ${iasqlEnginePort}, "toPort": ${iasqlEnginePort}, "cidrIpv4": "0.0.0.0/0"}]'
        );
      `;
    }
    // create engine service
    const iasqlEngineService = 'iasql-engine-service';
    const engineDesiredCount = 1;
    const engineLaunchType = 'FARGATE';
    const engineSchedulingStrategy = 'REPLICA';
    const engineAssignPublicIp = 'ENABLED'; // It have to be enabled to access repository
    const engineService = await orm.findOne(Service, { where: { name: iasqlEngineService } });
    if (!engineService) {
      transaction += `
        select *
        from create_ecs_service(
          '${iasqlEngineService}', '${iasqlCluster}', '${iasqlEngineFamily}', '${enginetaskDefinitionRevision}', ${engineDesiredCount}, '${engineLaunchType}',
          '${engineSchedulingStrategy}', array[${defaultSubnets}], array['${iasqlEngineSg}'], '${engineAssignPublicIp}', '${iasqlEngineTg}'
        );
      `;
    } else {
      // Create update path with new task definiton
    }

    // create postgres container
    const iasqlPostgresContainer = 'iasql-postgres-container';
    const iasqlPostgresPort = 5432;
    const iasqlPostgresEnvironment = {
      PORT: iasqlPostgresPort,
      POSTGRES_PASSWORD: 'test',
    };
    const iasqlPostgresImage = 'postgres';
    const iasqlPostgresImageTag = '13.4';
    const postgresContainer = await orm.findOne(Container, { where: { name: iasqlPostgresContainer, } })
    if (!postgresContainer) {
      transaction += `
        select * from create_container_definition(
          '${iasqlPostgresContainer}', true, 8192, ${iasqlPostgresPort}, ${iasqlPostgresPort}, 'tcp',
          '${JSON.stringify(iasqlPostgresEnvironment)}', '${iasqlPostgresImageTag}',
          _docker_image := '${iasqlPostgresImage}'
        );
      `;
    }
    // create postgres task definition
    const iasqlPostgresFamily = 'iasql-postgres-task-definition';
    const postgresTaskDefiniton = await orm.findOne(TaskDefinition, { where: { family: iasqlPostgresFamily }, order: { revision: 'DESC' } });
    const postgresTaskDefinitonRevision = postgresTaskDefiniton?.revision ? +postgresTaskDefiniton.revision + 1 : 1;
    const postgresEcsRoleArn = 'arn:aws:iam::257682470237:role/ecsTaskExecutionRole';
    const postgresCpuMem = '2vCPU-8GB';
    const postgresCompatibility = 'FARGATE';
    const postgresNetworkType = 'awsvpc';
    transaction += `
      select *
      from create_task_definition(
        '${iasqlPostgresFamily}', ${postgresTaskDefinitonRevision}, '${postgresEcsRoleArn}', '${postgresEcsRoleArn}',
        '${postgresNetworkType}', array['${postgresCompatibility}']::compatibility_name_enum[], '${postgresCpuMem}', array['${iasqlPostgresContainer}']
      );
    `;
    // create postgres security group
    const iasqlPostgresSg = 'iasql-postgres-security-group';
    const postgresSg = await orm.findOne(SecurityGroup, { where: { groupName: iasqlPostgresSg } });
    if (!postgresSg) {
      transaction += `
        select *
        from create_security_group(
          '${iasqlPostgresSg}', '${iasqlPostgresSg}',
          '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ${iasqlPostgresPort}, "toPort": ${iasqlPostgresPort}, "cidrIpv4": "0.0.0.0/0"}]'
        );
      `;
    }
    // create postgres service
    const iasqlPostgresService = 'iasql-postgres-service';
    const postgresDesiredCount = 1;
    const postgresLaunchType = 'FARGATE';
    const postgresSchedulingStrategy = 'REPLICA';
    const postgresAssignPublicIp = 'ENABLED'; // It have to be enabled to access repository
    const postgresService = await orm.findOne(Service, { where: { name: iasqlPostgresService } });
    if (!postgresService) {
      transaction += `
        select *
        from create_ecs_service(
          '${iasqlPostgresService}', '${iasqlCluster}', '${iasqlPostgresFamily}', '${postgresTaskDefinitonRevision}', ${postgresDesiredCount}, '${postgresLaunchType}',
          '${postgresSchedulingStrategy}', array[${defaultSubnets}], array['${iasqlPostgresSg}'], '${postgresAssignPublicIp}', '${iasqlPostgresTg}'
        );
      `;
    } else {
      // Create update path with new task definiton
    }
    if (transaction !== '') {
      console.log(transaction);
      await orm.query(`
        BEGIN;
        ${transaction}
        COMMIT;
      `);
    }
  } catch (e: any) {
    res.status(500).end(`failure to setup IaSQL's base components: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
  } finally {
    await orm?.dropConn();
  }
  res.end('ok');
});

iasql.get('/flush/:dbAlias', async (req, res) => {
  const { dbAlias, } = req.params;
  const orm = await TypeormWrapper.createConn(dbAlias);

  try {
    const iasqlEngineService = 'iasql-engine-service';
    await orm.query(`
        delete from service where name = '${iasqlEngineService}';
      `);
  } catch (e) {
    console.log(`Error deleting service ${e}`);
  }
  try {
    const iasqlEngineFamily = 'iasql-engine-task-definition';
    await orm.query(`
        delete from task_definition where family = '${iasqlEngineFamily}';
      `);
  } catch (e) {
    console.log(`Error deleting task_definition ${e}`);
  }
  try {
    const engineContainer = 'iasql-engine-container';
    await orm.query(`
        delete from container where name = '${engineContainer}';
      `);
  } catch (e) {
    console.log(`Error deleting container ${e}`);
  }

  try {
    const iasqlPostgresService = 'iasql-postgres-service';
    await orm.query(`
        delete from service where name = '${iasqlPostgresService}';
      `);
  } catch (e) {
    console.log(`Error deleting service ${e}`);
  }
  try {
    const iasqlPostgresFamily = 'iasql-postgres-task-definition';
    await orm.query(`
        delete from task_definition where family = '${iasqlPostgresFamily}';
      `);
  } catch (e) {
    console.log(`Error deleting task_definition ${e}`);
  }
  try {
    const postgresContainer = 'iasql-postgres-container';
    await orm.query(`
    delete from container where name = '${postgresContainer}';
    `);
  } catch (e) {
    console.log(`Error deleting container ${e}`);
  }

  try {
    const iasqlCluster = 'iasql-cluster';
    await orm.query(`
        delete from cluster where name = '${iasqlCluster}';
      `);
  } catch (e) {
    console.log(`Error deleting cluster ${e}`);
  }

  await orm?.dropConn();
  res.end('ok');
});

iasql.post('/genBuildAndPush', async (req, res) => {
  const { dbAlias, awsRegion, awsProfile, imageTag, } = req.body;
  const orm = await TypeormWrapper.createConn(dbAlias);
  try {
    // Get repository
    const iasqlEngineRepository = 'iasql-engine-repository';
    const engineRepository = await orm.findOne(Repository, { where: { repositoryName: iasqlEngineRepository } });
    // Docker login
    const script = `#!/bin/bash

aws ecr get-login-password --region ${awsRegion} --profile ${awsProfile} | docker login --username AWS --password-stdin ${engineRepository.repositoryUri}
docker build -t ${engineRepository.repositoryUri}:${imageTag ?? 'latest'} .
docker push ${engineRepository.repositoryUri}:${imageTag ?? 'latest'}`;
    writeFileSync('build-and-push.sh', script);
  } catch (e: any) {
    res.status(500).end(`failure to generate build and push IaSQL's script: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
  } finally {
    await orm?.dropConn();
  }
  res.end('ok');
});
