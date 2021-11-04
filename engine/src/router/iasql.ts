import * as express from 'express'
import { Cluster, ELB, Repository, RepositoryPolicy, Subnet, TargetGroup, TaskDefinition } from '../entity'
import { TypeormWrapper } from '../services/typeorm'

export const iasql = express.Router();
iasql.use(express.json());

iasql.post('/setup/base', async (req, res) => {
  const { dbAlias, } = req.body;
  const orm = await TypeormWrapper.createConn(dbAlias);
  let transaction = '';
  try {
    // Create engine target group
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlEngineTg = 'iasql-engine-target-group';
    const iasqlEngineTgPort = 8088;
    const defaultVpc = 'vpc-41895538';
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

iasql.post('/setup/core', async (req, res) => {
  const { dbAlias, } = req.body;
  const orm = await TypeormWrapper.createConn(dbAlias);
  try {
    // create cluster if it do not exist
    const iasqlCluster = 'iasql-cluster';
    if (!(await orm.findOne(Cluster, { where: { name: iasqlCluster, } }))) {
      await orm.query(`
        select * from create_ecs_cluster('${iasqlCluster}');
      `);
    }
    // create engine container
    const defaultVpc = 'vpc-41895538';
    const engineContainer = 'iasql-engine-container';
    const iasqlEnginePort = 8088;
    const iasqlEngineEnvironment = {
      PORT: iasqlEnginePort,
    };
    const iasqlEngineRepository = await orm.findOne(Repository, { where: { repositoryName: 'iasql-engine-repository' } });
    if (!iasqlEngineRepository) res.status(500).end('Repository not found');
    const createEngineContainerDefinition = await orm.query(`
      select *
      from create_container_definition(
        '${engineContainer}', '${iasqlEngineRepository.repositoryUri}:latest', true, 8192, ${iasqlEnginePort},
        ${iasqlEnginePort}, 'tcp', '${JSON.stringify(iasqlEngineEnvironment)}'
      );
    `);
    const engineContainerId = createEngineContainerDefinition?.pop()?.create_container_definition ?? null;
    // create engine task definition
    const iasqlEngineFamily = 'iasql-engine-task-definition';
    const engineCurrentVersion = await orm.findOne(TaskDefinition, { where: { family: iasqlEngineFamily }, order: { revision: 'DESC' } });
    const engineEcsRoleArn = 'arn:aws:iam::257682470237:role/ecsTaskExecutionRole';
    const engineCpuMem = '2vCPU-8GB';
    const engineCompatibility = 'FARGATE';
    const engineNetworkType = 'awsvpc';
    try {
      await orm.query(`
        select *
        from create_task_definition(
          '${iasqlEngineFamily}', ${engineCurrentVersion?.revision ? +engineCurrentVersion.revision + 1 : 1}, '${engineEcsRoleArn}', '${engineEcsRoleArn}',
          '${engineNetworkType}', array['${engineCompatibility}']::compatibility_name_enum[], '${engineCpuMem}', array[${engineContainerId}]
        );
      `);
    } catch (e: any) {
      // delete created container
      await orm.query(`
        delete from container where id = ${engineContainerId};
      `);
      res.status(500).end(`failure to setup IaSQL's base components: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
    }
    // create engine security group
    const iasqlEngineSg = 'iasql-engine-security-group';
    await orm.query(`
      select *
      from create_security_group(
        '${iasqlEngineSg}', '${iasqlEngineSg}', '${defaultVpc}',
        '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ${iasqlEnginePort}, "toPort": ${iasqlEnginePort}, "cidrIpv4": "0.0.0.0/0"}]'
      );
    `);
    // create postgres container
    const postgresContainer = 'iasql-postgres-container';
    const iasqlPostgresPort = 5432;
    const iasqlPostgresEnvironment = {
      PORT: iasqlPostgresPort,
      POSTGRES_PASSWORD: 'test',
    };
    const iasqlPostgresImage = 'postgres:13.4';
    const createPostgresContainerDefinition = await orm.query(`
      select *
      from create_container_definition(
        '${postgresContainer}', '${iasqlPostgresImage}', true, 8192, ${iasqlPostgresPort},
        ${iasqlPostgresPort}, 'tcp', '${JSON.stringify(iasqlPostgresEnvironment)}'
      );
    `);
    const postgresContainerId = createPostgresContainerDefinition?.pop()?.create_container_definition ?? null;
    // create postgres task definition
    const iasqlPostgresFamily = 'iasql-postgres-task-definition';
    const postgresCurrentVersion = await orm.findOne(TaskDefinition, { where: { family: iasqlPostgresFamily }, order: { revision: 'DESC' } });
    const postgresEcsRoleArn = 'arn:aws:iam::257682470237:role/ecsTaskExecutionRole';
    const postgresCpuMem = '2vCPU-8GB';
    const postgresCompatibility = 'FARGATE';
    const postgresNetworkType = 'awsvpc';
    try {
      await orm.query(`
        select *
        from create_task_definition(
          '${iasqlPostgresFamily}', ${postgresCurrentVersion?.revision ? +postgresCurrentVersion.revision + 1 : 1}, '${postgresEcsRoleArn}', '${postgresEcsRoleArn}',
          '${postgresNetworkType}', array['${postgresCompatibility}']::compatibility_name_enum[], '${postgresCpuMem}', array[${postgresContainerId}]
        );
      `);
    } catch (e: any) {
      // delete created container
      await orm.query(`
        delete from container where id = ${postgresContainerId};
      `);
      res.status(500).end(`failure to setup IaSQL's base components: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
    }
    // create postgres security group
    const iasqlPostgresSg = 'iasql-postgres-security-group';
    await orm.query(`
      select *
      from create_security_group(
        '${iasqlPostgresSg}', '${iasqlPostgresSg}', '${defaultVpc}',
        '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ${iasqlPostgresPort}, "toPort": ${iasqlPostgresPort}, "cidrIpv4": "0.0.0.0/0"}]'
      );
    `);
  } catch (e: any) {
    res.status(500).end(`failure to setup IaSQL's core components: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
  } finally {
    await orm?.dropConn();
  }
  res.end('ok');
});

iasql.post('/setup/service', async (req, res) => {
  const { dbAlias, } = req.body;
  const orm = await TypeormWrapper.createConn(dbAlias);
  try {
    const iasqlCluster = 'iasql-cluster';
    const defaultVpc = 'vpc-41895538';
    const subnets = (await orm.find(Subnet, {
      where: {
        vpcId: { vpcId: defaultVpc },
      },
      relations: ["vpcId"],
    })).map((sn: any) => `'${sn.subnetId}'`);
    const iasqlEngineFamily = 'iasql-engine-task-definition';
    // create engine service
    const iasqlEngineService = 'iasql-engine-service';
    const engineDesiredCount = 1;
    const engineLaunchType = 'FARGATE';
    const engineSchedulingStrategy = 'REPLICA';
    const engineAssignPublicIp = 'ENABLED'; // It have to be enabled to access repository
    const iasqlEngineTargetGroup = 'iasql-engine-target-group';
    const iasqlEngineSg = 'iasql-engine-security-group';
    const engineCurrentTaskDefinition = await orm.findOne(TaskDefinition, { where: { family: iasqlEngineFamily }, order: { revision: 'DESC' } });
    await orm.query(`
      select *
      from create_ecs_service(
        '${iasqlEngineService}', '${iasqlCluster}', '${engineCurrentTaskDefinition.familyRevision}', ${engineDesiredCount}, '${engineLaunchType}',
        '${engineSchedulingStrategy}', array[${subnets}], array['${iasqlEngineSg}'], '${engineAssignPublicIp}', '${iasqlEngineTargetGroup}'
      );
    `);

    const iasqlPostgresFamily = 'iasql-postgres-task-definition';
    const iasqlPostgresSg = 'iasql-postgres-security-group';
    // create postgres service
    const iasqlPostgresService = 'iasql-postgres-service';
    const postgresDesiredCount = 1;
    const postgresLaunchType = 'FARGATE';
    const postgresSchedulingStrategy = 'REPLICA';
    const postgresAssignPublicIp = 'ENABLED'; // It have to be enabled to access repository
    const iasqlPostgresTargetGroup = 'iasql-postgres-target-group';
    const postgresCurrentTaskDefinition = await orm.findOne(TaskDefinition, { where: { family: iasqlPostgresFamily }, order: { revision: 'DESC' } });
    await orm.query(`
      select *
      from create_ecs_service(
        '${iasqlPostgresService}', '${iasqlCluster}', '${postgresCurrentTaskDefinition.familyRevision}', ${postgresDesiredCount}, '${postgresLaunchType}',
        '${postgresSchedulingStrategy}', array[${subnets}], array['${iasqlPostgresSg}'], '${postgresAssignPublicIp}', '${iasqlPostgresTargetGroup}'
      );
    `);
  } catch (e: any) {
    res.status(500).end(`failure to setup IaSQL's core components: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
  } finally {
    await orm?.dropConn();
  }
  res.end('ok');
});

iasql.delete('/flush/core/:dbAlias', async (req, res) => {
  const { dbAlias, } = req.params;
  const orm = await TypeormWrapper.createConn(dbAlias);

  try {
    const iasqlEngineSg = 'iasql-engine-security-group';
    await orm.query(`
      delete from security_group_rule sgr
        using security_group sg
      where sg.id = sgr.security_group_id and sg.group_name = '${iasqlEngineSg}';
    `);
    await orm.query(`
      delete from security_group where group_name = '${iasqlEngineSg}';
    `);
  } catch (e) {
    console.log(`Error deleting security_group ${e}`);
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
    const iasqlPostgresSg = 'iasql-postgres-security-group';
    await orm.query(`
      delete from security_group_rule sgr
        using security_group sg
      where sg.id = sgr.security_group_id and sg.group_name = '${iasqlPostgresSg}';
    `);
    await orm.query(`
        delete from security_group where group_name = '${iasqlPostgresSg}';
      `);
  } catch (e) {
    console.log(`Error deleting security_group ${e}`);
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

iasql.delete('/flush/services/:dbAlias', async (req, res) => {
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
    const iasqlPostgresService = 'iasql-postgres-service';
    await orm.query(`
        delete from service where name = '${iasqlPostgresService}';
      `);
  } catch (e) {
    console.log(`Error deleting service ${e}`);
  }

  await orm?.dropConn();
  res.end('ok');
});
