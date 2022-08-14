import {
  CreateSecretCommandInput,
  DescribeSecretCommandInput,
  PutSecretValueCommandInput,
  SecretListEntry,
  SecretsManager,
  UpdateSecretCommandInput,
  paginateListSecrets,
} from "@aws-sdk/client-secrets-manager"
import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
  paginateBuilder,
} from "../../../services/aws_macros"
import { Context, Crud2, MapperBase, ModuleBase, } from "../../interfaces"
import { Secret, } from "./entity/secret"

class SecretMapper extends MapperBase<Secret> {
  module: AwsSecretsManagerModule;
  entity = Secret;
  equals = (a: Secret, b: Secret) =>
    Object.is(a.description, b.description) && !a.value; // if password is set we need to update it,

  secretsMapper(secret: SecretListEntry) {
    const out = new Secret();
    if (!secret.Name) return undefined;
    out.name = secret.Name;
    if (secret.Description) out.description = secret.Description;
    return out;
  }

  createSecret = crudBuilderFormat<
    SecretsManager,
    "createSecret",
    string | undefined
  >(
    "createSecret",
    (input) => input,
    (res) => (!!res ? res.Name : undefined)
  );

  async putSecretValue(
    client: SecretsManager,
    input: PutSecretValueCommandInput
  ) {
    const res = await client.putSecretValue(input);
    if (res) {
      return res;
    }
    return undefined;
  }

  async updateSecret(
    client: SecretsManager,
    input: UpdateSecretCommandInput
  ) {
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
    return result ? result : undefined;
  }

  getAllSecrets = paginateBuilder<SecretsManager>(
    paginateListSecrets,
    "SecretList"
  );

  deleteSecret = crudBuilder2<SecretsManager, "deleteSecret">(
    "deleteSecret",
    (input) => input
  );

  cloud = new Crud2({
    updateOrReplace: (_a: Secret, _b: Secret) => 'update',
    create: async (secrets: Secret[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const secret of secrets) {
        if (secret.value) {
          const input: CreateSecretCommandInput = {
            Name: secret.name,
            Description: secret.description,
            SecretString: secret.value!,
          };

          const secretName = await this.createSecret(
            client.secretsClient,
            input
          );
          if (secretName) {
            // retry until we ensure is created
            let rawSecret;
            let i = 0;
            do {
              await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s

              rawSecret = await this.getSecret(
                client.secretsClient,
                secretName
              );
              i++;
            } while (!rawSecret && (i<30));
            secret.name = secretName;
            // we never store the secret value
            secret.value = null;
            await this.module.secret.db.update(secret, ctx);
            out.push(secret);
          }
        }
      }
      return out;
    },

    read: async (ctx: Context, secretName?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (secretName) {
        const rawSecret = await this.getSecret(
          client.secretsClient,
          secretName
        );
        if (!rawSecret) return;
        const res = this.secretsMapper(rawSecret);
        return res;
      } else {
        const rawSecrets =
          (await this.getAllSecrets(client.secretsClient)) ?? [];
        const out = [];
        for (const i of rawSecrets) {
          const sec = this.secretsMapper(i);
          if (sec) out.push(sec);
        }
        return out;
      }
    },
    update: async (secrets: Secret[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const secret of secrets) {
        const cloudRecord = ctx?.memo?.cloud?.Secret?.[secret.name ?? ""];
        const isUpdate = Object.is(
          this.module.secret.cloud.updateOrReplace(cloudRecord, secret),
          'update'
        );
        if (isUpdate) {
          if (secret.description !== cloudRecord.description) {
            // we need to update the secret description
            const input: UpdateSecretCommandInput = {
              SecretId: secret.name,
              Description: secret.description,
            };
            await this.updateSecret(client.secretsClient, input);
          }

          if (secret.value !== cloudRecord.value) {
            // we need to update the value
            if (secret.value) {
              const input: PutSecretValueCommandInput = {
                SecretId: secret.name,
                SecretString: secret.value,
              };
              await this.putSecretValue(client.secretsClient, input);
            }
          }

          // modify the database, without saving the secret
          secret.value = null;
          await this.module.secret.db.update(secret, ctx);
          out.push(secret);
        }
      }
      return out;
    },
    delete: async (secrets: Secret[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const secret of secrets) {
        if (secret.name) {
          await this.deleteSecret(client.secretsClient, {
            SecretId: secret.name,
            ForceDeleteWithoutRecovery: true,
          });
        }
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
export const awsSecretsManagerModule = new AwsSecretsManagerModule();
