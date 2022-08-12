import {
  ECR,
  Repository as RepositoryAws,
  paginateDescribeRepositories,
} from '@aws-sdk/client-ecr'
import {
  ECRPUBLIC,
  Repository as PublicRepositoryAws,
  paginateDescribeRepositories as paginateDescribePubRepositories,
} from '@aws-sdk/client-ecr-public'

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'
import logger from '../../../services/logger'
import { PublicRepository, Repository, RepositoryPolicy, ImageTagMutability, } from './entity'
import { Context, Crud2, MapperBase, ModuleBase, } from '../../interfaces'
import * as metadata from './module.json'

class PublicRepositoryMapper extends MapperBase<PublicRepository> {
  module: AwsEcrModule;
  entity = PublicRepository;
  equals = (a: PublicRepository, b: PublicRepository) =>
    Object.is(a.repositoryName, b.repositoryName)
    && Object.is(a.repositoryArn, b.repositoryArn)
    && Object.is(a.registryId, b.registryId)
    && Object.is(a.repositoryUri, b.repositoryUri)
    && Object.is(a.createdAt?.getTime(), b.createdAt?.getTime());

  publicRepositoryMapper(r: PublicRepositoryAws) {
    const out = new PublicRepository();
    if (!r?.repositoryName) return undefined;
    out.repositoryName = r.repositoryName;
    out.repositoryArn = r.repositoryArn;
    out.registryId = r.registryId;
    out.repositoryUri = r.repositoryUri;
    out.createdAt = r.createdAt ? new Date(r.createdAt) : r.createdAt;
    return out;
  }

  createECRPubRepository = crudBuilderFormat<ECRPUBLIC, 'createRepository', RepositoryAws | undefined>(
    'createRepository',
    (input) => input,
    (res) => res?.repository,
  );
  getECRPubRepository = crudBuilderFormat<ECRPUBLIC, 'describeRepositories', RepositoryAws | undefined>(
    'describeRepositories',
    (name) => ({ repositoryNames: [name], }),
    (res) => (res?.repositories ?? [])[0],
  );
  getECRPubRepositories = paginateBuilder<ECRPUBLIC>(
    paginateDescribePubRepositories,
    'repositories',
  );
  deleteECRPubRepository = crudBuilderFormat<ECRPUBLIC, 'deleteRepository', undefined>(
    'deleteRepository',
    (repositoryName) => ({ repositoryName, }),
    (_res) => undefined,
  );

  cloud = new Crud2({
    create: async (es: PublicRepository[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const result = await this.createECRPubRepository(client.ecrPubClient, {
          repositoryName: e.repositoryName,
        });
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('repositoryArn')) { // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getECRPubRepository(
          client.ecrPubClient,
          result.repositoryName ?? ''
        );
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = this.publicRepositoryMapper(newObject);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        await this.module.publicRepository.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = await ctx.getAwsClient() as AWS;
      if (id) {
        const rawEcr = await this.getECRPubRepository(client.ecrPubClient, id);
        if (!rawEcr) return;
        return this.publicRepositoryMapper(rawEcr);
      } else {
        const ecrs = (await this.getECRPubRepositories(client.ecrPubClient)) ?? [];
        const out = [];
        for (const ecr of ecrs) {
          const newEcr = this.publicRepositoryMapper(ecr);
          if (newEcr) out.push(newEcr);
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: PublicRepository[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the db values with the cloud records.
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.PublicRepository?.[e.repositoryName ?? ''];
        await this.module.publicRepository.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: PublicRepository[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      for (const e of es) {
        await this.deleteECRPubRepository(client.ecrPubClient, e.repositoryName!);
      }
    },
  });

  constructor(module: AwsEcrModule) {
    super();
    this.module = module;
    super.init();
  }
}

class RepositoryMapper extends MapperBase<Repository> {
  module: AwsEcrModule;
  entity = Repository;
  equals = (a: Repository, b: Repository) => Object.is(a.repositoryName, b.repositoryName)
    && Object.is(a.repositoryArn, b.repositoryArn)
    && Object.is(a.registryId, b.registryId)
    && Object.is(a.repositoryUri, b.repositoryUri)
    && Object.is(a.createdAt?.getTime(), b.createdAt?.getTime())
    && Object.is(a.imageTagMutability, b.imageTagMutability)
    && Object.is(a.scanOnPush, b.scanOnPush);

  repositoryMapper(r: RepositoryAws) {
    const out = new Repository();
    if (!r?.repositoryName) return undefined;
    out.repositoryName = r.repositoryName;
    out.repositoryArn = r.repositoryArn;
    out.registryId = r.registryId;
    out.repositoryUri = r.repositoryUri;
    out.createdAt = r.createdAt ? new Date(r.createdAt) : r.createdAt;
    out.imageTagMutability = (r.imageTagMutability as ImageTagMutability) ?? ImageTagMutability.MUTABLE;
    out.scanOnPush = r.imageScanningConfiguration?.scanOnPush ?? false;
    return out;
  }

  createECRRepository = crudBuilderFormat<ECR, 'createRepository', RepositoryAws | undefined>(
    'createRepository',
    (input) => input,
    (res) => res?.repository,
  );
  getECRRepository = crudBuilderFormat<ECR, 'describeRepositories', RepositoryAws | undefined>(
    'describeRepositories',
    (name) => ({ repositoryNames: [name], }),
    (res) => (res?.repositories ?? [])[0],
  );
  getECRRepositories = paginateBuilder<ECR>(
    paginateDescribeRepositories,
    'repositories',
  );
  updateECRRepositoryImageTagMutability = crudBuilderFormat<
    ECR,
    'putImageTagMutability',
    undefined
  >(
    'putImageTagMutability',
    (repositoryName, imageTagMutability) => ({ repositoryName, imageTagMutability, }),
    (_res) => undefined,
  );
  updateECRRepositoryImageScanningConfiguration = crudBuilderFormat<
    ECR,
    'putImageScanningConfiguration',
    undefined
  >(
    'putImageScanningConfiguration',
    (repositoryName, scanOnPush) => ({
      repositoryName,
      imageScanningConfiguration: { scanOnPush, },
    }),
    (_res) => undefined,
  );
  deleteECRRepository = crudBuilderFormat<ECR, 'deleteRepository', undefined>(
    'deleteRepository',
    (repositoryName) => ({ repositoryName, }),
    (_res) => undefined,
  );

  cloud = new Crud2({
    create: async (es: Repository[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const result = await this.createECRRepository(client.ecrClient, {
          repositoryName: e.repositoryName,
          imageTagMutability: e.imageTagMutability,
          imageScanningConfiguration: {
            scanOnPush: e.scanOnPush,
          },
        });
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('repositoryArn')) { // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getECRRepository(client.ecrClient, result.repositoryName ?? '');
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = this.repositoryMapper(newObject);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        await this.module.repository.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = await ctx.getAwsClient() as AWS;
      if (id) {
        const rawEcr = await this.getECRRepository(client.ecrClient, id);
        if (!rawEcr) return;
        return this.repositoryMapper(rawEcr);
      } else {
        const ecrs = (await this.getECRRepositories(client.ecrClient)) ?? [];
        const out = [];
        for (const ecr of ecrs) {
          const outEcr = this.repositoryMapper(ecr);
          if (outEcr) out.push(outEcr);
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: Repository[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Repository?.[e.repositoryName ?? ''];
        let updatedRecord = { ...cloudRecord };
        if (cloudRecord?.imageTagMutability !== e.imageTagMutability) {
          await this.updateECRRepositoryImageTagMutability(
            client.ecrClient,
            e.repositoryName,
            e.imageTagMutability
          );
          const updatedRepository = await this.getECRRepository(client.ecrClient, e.repositoryName);
          if (!updatedRepository) continue;
          updatedRecord = this.repositoryMapper(updatedRepository);
        }
        if (cloudRecord?.scanOnPush !== e.scanOnPush) {
          await this.updateECRRepositoryImageScanningConfiguration(
            client.ecrClient,
            e.repositoryName,
            e.scanOnPush
          );
          const updatedRepository = await this.getECRRepository(client.ecrClient, e.repositoryName);
          if (!updatedRepository) continue;
          updatedRecord = this.repositoryMapper(updatedRepository);
        }
        await this.module.repository.db.update(updatedRecord, ctx);
        out.push(updatedRecord);
      }
      return out;
    },
    delete: async (es: Repository[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      for (const e of es) {
        await this.deleteECRRepository(client.ecrClient, e.repositoryName!);
        // Also need to delete the repository policy associated with this repository,
        // if any
        const policy = await this.module.repositoryPolicy.db.read(ctx, e.repositoryName);
        await this.module.repositoryPolicy.db.delete(policy, ctx);
      }
    },
  });

  constructor(module: AwsEcrModule) {
    super();
    this.module = module;
    super.init();
  }
}

class RepositoryPolicyMapper extends MapperBase<RepositoryPolicy> {
  module: AwsEcrModule;
  entity = RepositoryPolicy;
  entityId = (e: RepositoryPolicy) => e.repository?.repositoryName + '' ?? e.id.toString();
  equals = (a: RepositoryPolicy, b: RepositoryPolicy) => {
    try {
      return Object.is(a.registryId, b.registryId)
        && Object.is(a.repository.repositoryName, b.repository.repositoryName)
        && this.policyComparisonEq(JSON.parse(a.policyText!), JSON.parse(b.policyText!));
    } catch (e) {
      return false;
    }
  };

  async repositoryPolicyMapper(rp: any, ctx: Context) {
    const out = new RepositoryPolicy();
    out.registryId = rp?.registryId;
    out.repository = ctx.memo?.cloud?.Repository?.[rp.repositoryName] ??
      await this.module.repository.cloud.read(ctx, rp?.repositoryName);
    out.policyText = rp?.policyText?.replace(/\n/g, '').replace(/\s+/g, ' ') ?? null;
    return out;
  };
  policyComparisonEq(a: any, b: any): boolean {
    // From https://stackoverflow.com/questions/44792629/how-to-compare-two-objects-with-nested-array-of-object-using-loop
    let same = Object.keys(a).length === Object.keys(b).length;
    if (!same) return same;
    for (const [key, value] of Object.entries(a)) {
      if (typeof value === 'object') {
        same = this.policyComparisonEq(a[key], b[key]);
      } else {
        if (a[key] !== b[key]) {
          same = false;
          break;
        };
      }
    }
    return same;
  }

  setECRRepositoryPolicy = crudBuilder2<ECR, 'setRepositoryPolicy'>(
    'setRepositoryPolicy',
    (input) => input,
  );
  getECRRepositoryPolicy = crudBuilder2<ECR, 'getRepositoryPolicy'>(
    'getRepositoryPolicy',
    (repositoryName) => ({ repositoryName, }),
  );
  deleteECRRepositoryPolicy = crudBuilder2<ECR, 'deleteRepositoryPolicy'>(
    'deleteRepositoryPolicy',
    (repositoryName) => ({ repositoryName, }),
  );

  db = new Crud2<RepositoryPolicy>({
    create: (es: RepositoryPolicy[], ctx: Context) => ctx.orm.save(RepositoryPolicy, es),
    update: (es: RepositoryPolicy[], ctx: Context) => ctx.orm.save(RepositoryPolicy, es),
    delete: (es: RepositoryPolicy[], ctx: Context) => ctx.orm.remove(RepositoryPolicy, es),
    read: async (ctx: Context, repositoryName?: string) => {
      const opts = repositoryName ? {
        where: {
          repositoryName,
        }
      } : {};
      return await ctx.orm.find(RepositoryPolicy, opts);
    },
  });

  cloud: Crud2<RepositoryPolicy> = new Crud2({
    create: async (es: RepositoryPolicy[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const result = await this.setECRRepositoryPolicy(client.ecrClient, {
          repositoryName: e.repository.repositoryName,
          policyText: e.policyText,
        });
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('repositoryName')) { // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getECRRepositoryPolicy(client.ecrClient, result.repositoryName ?? '');
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.repositoryPolicyMapper(newObject, ctx);
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.repositoryPolicy.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      // TODO: Can this function be refactored to be simpler?
      const client = await ctx.getAwsClient() as AWS;
      if (id) {
        const rawRepositoryPolicy = await this.getECRRepositoryPolicy(client.ecrClient, id);
        return await this.repositoryPolicyMapper(rawRepositoryPolicy, ctx);
      } else {
        const repositories = ctx.memo?.cloud?.Repository ?
          Object.values(ctx.memo?.cloud?.Repository) :
          await this.module.repository.cloud.read(ctx);
        const policies: any = [];
        for (const r of repositories) {
          try {
            const rp = await this.getECRRepositoryPolicy(client.ecrClient, r.repositoryName);
            policies.push(rp);
          } catch (_) {
            // We try to retrieve the policy for the repository, but if none it is not an error
            continue;
          }
        }
        const out = [];
        for (const rp of policies) {
          out.push(await this.repositoryPolicyMapper(rp, ctx));
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: RepositoryPolicy[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.RepositoryPolicy?.[e.repository.repositoryName ?? ''] as RepositoryPolicy;
        try {
          if (!this.policyComparisonEq(JSON.parse(cloudRecord.policyText!), JSON.parse(e.policyText!))) {
            const outPolicy = this.module.repositoryPolicy.cloud.create(e, ctx);
            if (outPolicy instanceof RepositoryPolicy) out.push(outPolicy);
            if (outPolicy instanceof Array) {
              for (const pol of outPolicy) {
                if (pol instanceof RepositoryPolicy) out.push(pol);
              }
            }
          }
        } catch (e) {
          logger.error('Error comparing policy records');
        }
        cloudRecord.id = e.id;
        await this.module.repositoryPolicy.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: RepositoryPolicy[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      for (const e of es) {
        try {
          await this.deleteECRRepositoryPolicy(client.ecrClient, e.repository.repositoryName!);
        } catch (e: any) {
          // Do nothing if repository not found. It means the repository got deleted first and
          // the policy has already been removed
          if (e.name !== 'RepositoryNotFoundException') throw e;
        }
      }
    },
  });

  constructor(module: AwsEcrModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsEcrModule extends ModuleBase {
  dependencies = metadata.dependencies; // TODO: Drop this
  publicRepository: PublicRepositoryMapper;
  repository: RepositoryMapper;
  repositoryPolicy: RepositoryPolicyMapper;

  constructor() {
    super();
    this.publicRepository = new PublicRepositoryMapper(this);
    this.repository = new RepositoryMapper(this);
    this.repositoryPolicy = new RepositoryPolicyMapper(this);
    super.init();
  }
}
export const awsEcrModule = new AwsEcrModule();
