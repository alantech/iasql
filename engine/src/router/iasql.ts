import * as express from 'express'
import { ELB, Repository, RepositoryPolicy, Subnet, TargetGroup } from '../entity';
import { TypeormWrapper } from '../services/typeorm';

export const iasql = express.Router();
iasql.use(express.json());

iasql.post('/setup', async (req, res) => {
  const { dbAlias, } = req.body;
  const orm = await TypeormWrapper.createConn(dbAlias);
  let transaction = '';
  try {
    // Create engine target group
    // TODO: pass these variables as environment variables or part of the payload?
    const iasqlEngineTg = 'iasql-engine';
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
    const iasqlPostgresTg = 'iasql-postgres';
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
    const iasqlEngineLb = 'iasql-engine';
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
    const iasqlPostgresLb = 'iasql-postgres';
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
    const iasqlEngineRepository = 'iasql-engine';
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
    res.status(500).end(`failure to setup IaSQL: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${JSON.stringify(e?.metadata ?? [])}\n`);
  } finally {
    await orm?.dropConn();
  }
  res.end('ok');
});
