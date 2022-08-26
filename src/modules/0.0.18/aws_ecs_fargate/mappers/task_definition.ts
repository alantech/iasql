import { ECS, TaskDefinition as AwsTaskDefinition, paginateListTaskDefinitions } from '@aws-sdk/client-ecs';

import { AwsEcsFargateModule } from '..';
import { awsCloudwatchModule, awsEcrModule, awsIamModule } from '../..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import logger from '../../../../services/logger';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { ContainerDefinition, CpuMemCombination, TaskDefinition } from '../entity';

export class TaskDefinitionMapper extends MapperBase<TaskDefinition> {
  module: AwsEcsFargateModule;
  entity = TaskDefinition;
  equals = (a: TaskDefinition, b: TaskDefinition) =>
    Object.is(a.cpuMemory, b.cpuMemory) &&
    Object.is(a.executionRole?.arn, b.executionRole?.arn) &&
    Object.is(a.family, b.family) &&
    Object.is(a.revision, b.revision) &&
    Object.is(a.status, b.status) &&
    Object.is(a.taskDefinitionArn, b.taskDefinitionArn) &&
    Object.is(a.taskRole?.arn, b.taskRole?.arn) &&
    Object.is(a.containerDefinitions.length, b.containerDefinitions.length) &&
    a.containerDefinitions.every(ac => !!b.containerDefinitions.find(bc => this.containersEq(ac, bc)));

  containersEq(a: ContainerDefinition, b: ContainerDefinition) {
    return (
      Object.is(a.cpu, b.cpu) &&
      Object.is(Object.keys(a.envVariables ?? {}).length, Object.keys(b.envVariables ?? {}).length) &&
      Object.keys(a.envVariables ?? {}).every(
        (aevk: string) =>
          !!Object.keys(b.envVariables ?? {}).find(
            (bevk: string) => Object.is(aevk, bevk) && Object.is(a.envVariables[aevk], b.envVariables[bevk])
          )
      ) &&
      Object.is(a.essential, b.essential) &&
      Object.is(a.logGroup?.logGroupArn, b.logGroup?.logGroupArn) &&
      Object.is(a.memory, b.memory) &&
      Object.is(a.memoryReservation, b.memoryReservation) &&
      Object.is(a.name, b.name) &&
      Object.is(a.containerPort, b.containerPort) &&
      Object.is(a.hostPort, b.hostPort) &&
      Object.is(a.protocol, b.protocol) &&
      Object.is(a.publicRepository?.repositoryName, b.publicRepository?.repositoryName) &&
      Object.is(a.repository?.repositoryName, b.repository?.repositoryName) &&
      Object.is(a.image, b.image) &&
      Object.is(a.digest, b.digest) &&
      Object.is(a.tag, b.tag)
    );
  }

  createTaskDefinition = crudBuilderFormat<ECS, 'registerTaskDefinition', AwsTaskDefinition | undefined>(
    'registerTaskDefinition',
    input => input,
    res => res?.taskDefinition
  );
  getTaskDefinition = crudBuilderFormat<ECS, 'describeTaskDefinition', AwsTaskDefinition | undefined>(
    'describeTaskDefinition',
    taskDefinition => ({ taskDefinition }),
    res => res?.taskDefinition
  );
  deleteTaskDefinition = crudBuilder2<ECS, 'deregisterTaskDefinition'>(
    'deregisterTaskDefinition',
    taskDefinition => ({
      taskDefinition,
    })
  );

  async getTaskDefinitions(client: ECS) {
    const taskDefinitions: any[] = [];
    const activeTaskDefinitionArns: string[] = [];
    const activePaginator = paginateListTaskDefinitions(
      {
        client,
      },
      {
        status: 'ACTIVE',
        maxResults: 100,
      }
    );
    for await (const page of activePaginator) {
      activeTaskDefinitionArns.push(...(page.taskDefinitionArns ?? []));
    }
    // Look for INACTIVE task definitons being used
    const clusters = (await this.module.cluster.getClusters(client)) ?? [];
    const services =
      (await this.module.service.getServices(
        client,
        clusters.map(c => c.clusterArn!)
      )) ?? [];
    const servicesTasks = services.map(s => s.taskDefinition!) ?? [];
    for (const st of servicesTasks) {
      if (!activeTaskDefinitionArns.includes(st)) {
        taskDefinitions.push(await this.getTaskDefinition(client, st));
      }
    }
    // Do not run them in parallel to avoid AWS throttling error
    for (const arn of activeTaskDefinitionArns) {
      taskDefinitions.push(await this.getTaskDefinition(client, arn));
    }
    return {
      taskDefinitions,
    };
  }

  async containerDefinitionMapper(c: any, ctx: Context) {
    const out = new ContainerDefinition();
    out.cpu = c?.cpu;
    out.envVariables = {};
    c.environment.map((ev: { name: string; value: string }) => {
      out.envVariables[ev.name] = ev.value;
    });
    out.essential = c.essential;
    out.memory = c.memory;
    out.memoryReservation = c.memoryReservation;
    out.name = c.name;
    const portMapping = c.portMappings?.pop();
    out.containerPort = portMapping?.containerPort;
    out.hostPort = portMapping?.hostPort;
    out.protocol = portMapping?.protocol;
    let containerImage;
    if (c?.image?.includes('@')) {
      // Image with digest
      const split = c.image.split('@');
      containerImage = split[0];
      out.digest = split[1];
    } else if (c?.image?.includes(':')) {
      // Image with tag
      const split = c.image.split(':');
      containerImage = split[0];
      out.tag = split[1];
    } else {
      // Just image name
      containerImage = c?.image;
    }
    if (containerImage?.includes('amazonaws.com')) {
      // Private ECR
      const parts = containerImage.split('/');
      const repositoryName = parts[parts.length - 1] ?? null;
      try {
        const repository =
          (await awsEcrModule.repository.db.read(ctx, repositoryName)) ??
          (await awsEcrModule.repository.cloud.read(ctx, repositoryName));
        out.repository = repository;
      } catch (e) {
        // Repository could have been deleted
        logger.error('Repository not found', e as any);
        out.repository = undefined;
      }
    } else if (containerImage?.includes('public.ecr.aws')) {
      // Public ECR
      const parts = containerImage.split('/');
      const publicRepositoryName = parts[parts.length - 1] ?? null;
      try {
        const publicRepository =
          (await awsEcrModule.publicRepository.db.read(ctx, publicRepositoryName)) ??
          (await awsEcrModule.publicRepository.cloud.read(ctx, publicRepositoryName));
        out.publicRepository = publicRepository;
      } catch (e) {
        // Repository could have been deleted
        logger.error('Repository not found', e as any);
        out.publicRepository = undefined;
      }
    }
    if (!out.repository && !out.publicRepository) {
      out.image = containerImage;
    }
    // TODO: eventually handle more log drivers
    if (c.logConfiguration?.logDriver === 'awslogs') {
      const groupName = c.logConfiguration.options['awslogs-group'];
      const logGroup =
        (await awsCloudwatchModule.logGroup.db.read(ctx, groupName)) ??
        (await awsCloudwatchModule.logGroup.cloud.read(ctx, groupName));
      out.logGroup = logGroup;
    }
    return out;
  }

  async taskDefinitionMapper(td: any, ctx: Context) {
    const out = new TaskDefinition();
    out.containerDefinitions = [];
    for (const tdc of td.containerDefinitions) {
      const cd = await this.containerDefinitionMapper(tdc, ctx);
      out.containerDefinitions.push(cd);
    }
    out.cpuMemory = `vCPU${+(td.cpu ?? '256') / 1024}-${+(td.memory ?? '512') / 1024}GB` as CpuMemCombination;
    if (td.executionRoleArn) {
      const roleName = awsIamModule.role.roleNameFromArn(td.executionRoleArn, ctx);
      // there can be hundreds of task defintions so don't do an aws call for each
      if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
        try {
          out.executionRole =
            (await awsIamModule.role.db.read(ctx, roleName)) ??
            (await awsIamModule.role.cloud.read(ctx, roleName));
        } catch (e) {
          // Role could have been deleted
          logger.error('Role not found', e as any);
          out.executionRole = undefined;
        }
      } else {
        out.executionRole =
          (await awsIamModule.role.db.read(ctx, roleName)) ?? ctx?.memo?.cloud?.Role?.[roleName ?? ''];
      }
    }
    out.family = td.family;
    out.revision = td.revision;
    out.status = td.status;
    out.taskDefinitionArn = td.taskDefinitionArn;
    if (td.taskRoleArn) {
      const roleName = awsIamModule.role.roleNameFromArn(td.taskRoleArn, ctx);
      // there can be hundreds of task defintions so don't do an aws call for each
      if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
        try {
          out.taskRole =
            (await awsIamModule.role.db.read(ctx, roleName)) ??
            (await awsIamModule.role.cloud.read(ctx, roleName));
        } catch (e) {
          // Role could have been deleted
          logger.error('Role not found', e as any);
          out.taskRole = undefined;
        }
      } else {
        out.taskRole =
          (await awsIamModule.role.db.read(ctx, roleName)) ?? ctx?.memo?.cloud?.Role?.[roleName ?? ''];
      }
    }
    return out;
  }

  cloud = new Crud2({
    create: async (es: TaskDefinition[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const res = [];
      for (const e of es) {
        const containerDefinitions =
          e.containerDefinitions?.map(c => {
            const container: any = { ...c };
            let image;
            if (c.image) {
              image = c.image;
            } else if (c.repository) {
              if (!c.repository?.repositoryUri) {
                throw new Error('Repository need to be created first');
              }
              image = c.repository.repositoryUri;
            } else if (c.publicRepository) {
              if (!c.publicRepository?.repositoryUri) {
                throw new Error('Public repository need to be created first');
              }
              image = c.publicRepository.repositoryUri;
            } else {
              logger.error('How the DB constraint have been ignored?');
            }
            if (c.digest) {
              container.image = `${image}@${c.digest}`;
            } else if (c.tag) {
              container.image = `${image}:${c.tag}`;
            } else {
              container.image = image;
            }
            if (container.logGroup) {
              // TODO: improve log configuration
              container.logConfiguration = {
                logDriver: 'awslogs',
                options: {
                  'awslogs-group': container.logGroup.logGroupName,
                  'awslogs-region': client.region,
                  'awslogs-stream-prefix': `awslogs-${c.name}`,
                },
              };
            }
            if (c.envVariables && Array.isArray(c.envVariables))
              throw new Error('Invalid environment variables format');
            container.environment = Object.keys(c.envVariables ?? {}).map((evk: string) => ({
              name: evk,
              value: `${c.envVariables[evk]}`,
            }));
            if (container.containerPort && container.hostPort && container.protocol) {
              container.portMappings = [
                {
                  containerPort: container.containerPort,
                  hostPort: container.hostPort,
                  protocol: container.protocol,
                },
              ];
            }
            return container;
          }) ?? [];
        if (!containerDefinitions.length)
          throw new Error(
            `Task definition ${e.family}${
              e.revision ? `:${e.revision}` : ''
            } does not have any container associated.`
          );
        const input: any = {
          family: e.family,
          containerDefinitions,
          requiresCompatibilities: ['FARGATE'],
          networkMode: 'awsvpc',
          taskRoleArn: e.taskRole?.arn,
          executionRoleArn: e.executionRole?.arn,
        };
        if (e.cpuMemory) {
          const [cpuStr, memoryStr] = e.cpuMemory.split('-');
          const cpu = cpuStr.split('vCPU')[1];
          input.cpu = `${+cpu * 1024}`;
          const memory = memoryStr.split('GB')[0];
          input.memory = `${+memory * 1024}`;
        }
        const result = await this.createTaskDefinition(client.ecsClient, input);
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('taskDefinitionArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getTaskDefinition(client.ecsClient, result.taskDefinitionArn ?? '');
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.taskDefinitionMapper(newObject, ctx);
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Keep container definition ids to avoid duplicates
        e.containerDefinitions?.forEach(c => {
          newEntity?.containerDefinitions?.forEach((nc: any) => {
            if (nc.name === c.name) {
              nc.id = c.id;
              // TODO KEEP TRACK OF PORT AND ENV IDS?
            }
          });
        });
        // Save the record back into the database to get the new fields updated
        await this.module.taskDefinition.db.update(newEntity, ctx);
        res.push(newEntity);
      }
      return res;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawTaskDef = await this.getTaskDefinition(client.ecsClient, id);
        if (!rawTaskDef) return;
        if (!rawTaskDef.compatibilities?.includes('FARGATE')) return;
        return await this.taskDefinitionMapper(rawTaskDef, ctx);
      } else {
        const taskDefs = ((await this.getTaskDefinitions(client.ecsClient)).taskDefinitions ?? []).filter(
          td => td.compatibilities.includes('FARGATE')
        );
        const tds = [];
        for (const td of taskDefs) {
          tds.push(await this.taskDefinitionMapper(td, ctx));
        }
        return tds;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: TaskDefinition[], ctx: Context) => {
      const res = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.TaskDefinition?.[e.taskDefinitionArn ?? ''];
        // Any change in a task definition will imply the creation of a new revision and to restore
        // the previous value.
        const newRecord = { ...e };
        cloudRecord.id = e.id;
        cloudRecord.containerDefinitions.map((crc: ContainerDefinition) => {
          const c = e.containerDefinitions.find(ec => this.containersEq(ec, crc));
          if (!!c) crc.id = c.id;
        });
        newRecord.id = undefined;
        newRecord.taskDefinitionArn = undefined;
        newRecord.containerDefinitions = newRecord.containerDefinitions.map(c => {
          c.id = undefined;
          return c;
        });
        await this.module.taskDefinition.db.create(newRecord, ctx);
        await this.module.taskDefinition.db.update(cloudRecord, ctx);
        res.push(cloudRecord);
      }
      return res;
    },
    delete: async (es: TaskDefinition[], ctx: Context) => {
      // Do not delete task if it is being used by a service
      const services = ctx.memo?.cloud?.Service
        ? Object.values(ctx.memo?.cloud?.Service)
        : await this.module.service.cloud.read(ctx);
      const client = (await ctx.getAwsClient()) as AWS;
      const esWithServiceAttached = [];
      const esToDelete = [];
      for (const e of es) {
        if (Object.values(services).find((s: any) => s.task?.taskDefinitionArn === e.taskDefinitionArn)) {
          esWithServiceAttached.push(e);
        } else {
          if (e.status === 'INACTIVE') {
            const dbTd = await this.module.taskDefinition.db.read(ctx, e.taskDefinitionArn);
            // Temporarily create again the task definition inactive if deleted from DB to avoid
            // infinite loops. ? Eventually, forbid task definitons to be deleted from database.
            if (!dbTd || (Array.isArray(dbTd) && !dbTd.length)) {
              await this.module.taskDefinition.db.create(e, ctx);
            }
          } else {
            esToDelete.push(e);
          }
        }
      }
      for (const e of esToDelete) {
        await this.deleteTaskDefinition(client.ecsClient, e.taskDefinitionArn!);
      }
      if (esWithServiceAttached.length)
        throw new Error('Some tasks could not be deleted. They are attached to an existing service.');
    },
  });

  constructor(module: AwsEcsFargateModule) {
    super();
    this.module = module;
    super.init();
  }
}
