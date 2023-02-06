import {
  CreateSecretCommandInput,
  DescribeSecretCommandInput,
  SecretListEntry,
  SecretsManager,
  UpdateSecretCommandInput,
  paginateListSecrets,
  CreateSecretCommandOutput,
} from '@aws-sdk/client-secrets-manager';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../interfaces';
import { Secret } from './entity/secret';

class SecretMapper extends MapperBase<Secret> {
  module: AwsSecretsManagerModule;
  entity = Secret;
  equals = (a: Secret, b: Secret) =>
    Object.is(a.description, b.description) && Object.is(a.versionId, b.versionId) && !a.value; // if secret is set we need to update it,

  secretsMapper(secret: SecretListEntry, region: string) {
    const out = new Secret();
    if (!secret.Name) return undefined;
    out.name = secret.Name;
    if (secret.Description) out.description = secret.Description;

    // version id will be the AWSCURRENT one
    out.versionId = undefined;
    if (secret.SecretVersionsToStages) {
      for (const [key, value] of Object.entries(secret.SecretVersionsToStages)) {
        if (value[0] && value[0] === 'AWSCURRENT') {
          out.versionId = key;
          break;
        }
      }
    }
    out.region = region;
    return out;
  }

  createSecret = crudBuilderFormat<SecretsManager, 'createSecret', CreateSecretCommandOutput>(
    'createSecret',
    input => input,
    res => res!,
  );

  async updateSecret(client: SecretsManager, input: UpdateSecretCommandInput) {
    const res = await client.updateSecret(input);
    if (res) {
      return res;
    }
    return undefined;
  }

  async getSecret(client: SecretsManager, secretId: string) {
    const input: DescribeSecretCommandInput = {
      SecretId: secretId,
    };
    const result = await client.describeSecret(input);
    if (result) {
      const secret: SecretListEntry = {
        Name: result.Name,
        Description: result.Description,
        SecretVersionsToStages: result.VersionIdsToStages,
      };
      return secret;
    }
    return undefined;
  }

  getAllSecrets = paginateBuilder<SecretsManager>(paginateListSecrets, 'SecretList');

  deleteSecret = crudBuilder2<SecretsManager, 'deleteSecret'>('deleteSecret', input => input);

  cloud = new Crud2({
    create: async (secrets: Secret[], ctx: Context) => {
      const out = [];
      for (const secret of secrets) {
        const client = (await ctx.getAwsClient(secret.region)) as AWS;
        if (secret.value) {
          const input: CreateSecretCommandInput = {
            Name: secret.name,
            Description: secret.description,
            SecretString: secret.value!,
          };

          const secretAWS = await this.createSecret(client.secretsClient, input);
          if (!secretAWS) {
            throw new Error('Secret not properly created in AWS');
          }
          // retry until we ensure is created
          let rawSecret;
          let i = 0;
          do {
            await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s

            rawSecret = await this.getSecret(client.secretsClient, secretAWS.Name!);
            i++;
          } while (!rawSecret && i < 30);
          secret.name = secretAWS.Name!;
          if (secretAWS.VersionId) secret.versionId = secretAWS.VersionId;
          // we never store the secret value
          secret.value = null;
          await this.module.secret.db.update(secret, ctx);
          out.push(secret);
        }
      }
      return out;
    },

    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { region, name } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawSecret = await this.getSecret(client.secretsClient, name);
          if (rawSecret) return this.secretsMapper(rawSecret, region);
        }
      } else {
        const out: Secret[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawSecrets = (await this.getAllSecrets(client.secretsClient)) ?? [];
            for (const i of rawSecrets) {
              const sec = this.secretsMapper(i, region);
              if (sec) out.push(sec);
            }
          }),
        );
        return out;
      }
    },
    update: async (secrets: Secret[], ctx: Context) => {
      const out = [];
      for (const secret of secrets) {
        const cloudRecord = ctx?.memo?.cloud?.Secret?.[this.entityId(secret)];
        const client = (await ctx.getAwsClient(secret.region)) as AWS;
        const input: UpdateSecretCommandInput = {
          SecretId: secret.name,
          Description: secret.description,
        };
        if (secret.value) {
          input.SecretString = secret.value;
        }
        const updatedSecret = await this.updateSecret(client.secretsClient, input);
        if (!updatedSecret) {
          throw new Error('Secret not properly updated in AWS');
        }

        let finalSecret: Secret | undefined;
        let i = 0;
        do {
          // retrieve updated secret to avoid race conditions
          await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s

          const rawSecret = await this.getSecret(client.secretsClient, secret.name);
          finalSecret = this.secretsMapper(rawSecret!, secret.region);
          i++;
          if (!finalSecret) continue;
          if (secret.value && finalSecret.versionId !== cloudRecord.versionId) {
            secret.versionId = finalSecret.versionId;
            break;
          }
          if (!secret.value && finalSecret.versionId) {
            secret.versionId = cloudRecord.versionId;
            break;
          }
        } while (i < 30);

        if (!finalSecret) {
          throw new Error('Secret not properly returned');
        }
        if (secret.value && finalSecret.versionId === cloudRecord.versionId) {
          throw new Error('Secret has not been modified');
        }

        // modify the database, without saving the secret
        secret.value = null;
        await this.module.secret.db.update(secret, ctx);
        out.push(secret);
      }
      return out;
    },
    delete: async (secrets: Secret[], ctx: Context) => {
      for (const secret of secrets) {
        const client = (await ctx.getAwsClient(secret.region)) as AWS;
        if (secret.name) {
          await this.deleteSecret(client.secretsClient, {
            SecretId: secret.name,
            ForceDeleteWithoutRecovery: true,
          });
        }

        // wait until the secret is not present
        let rawSecret;
        let i = 0;
        do {
          await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s

          rawSecret = await this.getSecret(client.secretsClient, secret.name);
          i++;
        } while (rawSecret && i < 30);
      }
    },
  });

  constructor(module: AwsSecretsManagerModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsSecretsManagerModule extends ModuleBase {
  secret: SecretMapper;

  constructor() {
    super();
    this.secret = new SecretMapper(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-secret-integration.ts#Secrets Manager Integration Testing#Code examples
 * ```
 */
export const awsSecretsManagerModule = new AwsSecretsManagerModule();
