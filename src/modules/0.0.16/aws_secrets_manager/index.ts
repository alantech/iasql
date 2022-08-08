import {
  CreateSecretCommandInput,
  DescribeSecretCommandInput,
  SecretsManager,
  PutSecretValueCommandInput,
  UpdateSecretCommandInput,
  paginateListSecrets,
  SecretListEntry,
} from "@aws-sdk/client-secrets-manager";
import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
  paginateBuilder,
} from "../../../services/aws_macros";
import { Context, Crud2, Mapper2, Module2 } from "../../interfaces";
import * as metadata from "./module.json";
import { Secret } from "./entity/secret";

const createSecret = crudBuilderFormat<
  SecretsManager,
  "createSecret",
  string | undefined
>(
  "createSecret",
  (input) => input,
  (res) => (!!res ? res.Name : undefined)
);

async function putSecretValue(
  client: SecretsManager,
  input: PutSecretValueCommandInput
) {
  const res = await client.putSecretValue(input);
  if (res) {
    return res;
  }
  return undefined;
}

async function updateSecret(
  client: SecretsManager,
  input: UpdateSecretCommandInput
) {
  const res = await client.updateSecret(input);
  if (res) {
    return res;
  }
  return undefined;
}

async function getSecret(client: SecretsManager, secretId: string) {
  const input: DescribeSecretCommandInput = {
    SecretId: secretId,
  };
  const result = await client.describeSecret(input);
  if (result) {
    const secret: SecretListEntry = {
      Name: result.Name,
      Description: result.Description,
    };
  }
  return undefined;
}

const getAllSecrets = paginateBuilder<SecretsManager>(
  paginateListSecrets,
  "SecretList"
);

const deleteSecret = crudBuilder2<SecretsManager, "deleteSecret">(
  "deleteSecret",
  (input) => input
);

export const AwsSecretsManagerModule: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      secretsMapper: async (secret: SecretListEntry, ctx: Context) => {
        const out = new Secret();
        if (!secret.Name) return undefined;
        out.name = secret.Name;
        if (secret.Description) out.description = secret.Description;
        return out;
      },
    },
    mappers: {
      secret: new Mapper2<Secret>({
        entity: Secret,
        equals: (a: Secret, b: Secret) =>
          Object.is(a.description, b.description) && !a.value, // if password is set, we need to update it,
        source: "db",
        cloud: new Crud2({
          updateOrReplace: (a: Secret, b: Secret) => {
            return "update";
          },
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
                const secretName = await createSecret(
                  client.secretsClient,
                  input
                );
                if (secretName) {
                  secret.name = secretName;
                  // we never store the secret value
                  secret.value = null;
                  await AwsSecretsManagerModule.mappers.secret.db.update(secret, ctx);
                  out.push(secret);
                }
              }
            }
            return out;
          },

          read: async (ctx: Context, secretName?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (secretName) {
              const rawSecret = await getSecret(
                client.secretsClient,
                secretName
              );
              const res = AwsSecretsManagerModule.utils.secretsMapper(rawSecret, ctx);
            } else {
              const rawSecrets =
                (await getAllSecrets(client.secretsClient)) ?? [];
              const out = [];
              for (const i of rawSecrets) {
                out.push(await AwsSecretsManagerModule.utils.secretsMapper(i, ctx));
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
                AwsSecretsManagerModule.mappers.secret.cloud.updateOrReplace(
                  cloudRecord,
                  secret
                ),
                "update"
              );
              if (isUpdate) {
                if (secret.description !== cloudRecord.description) {
                  // we need to update the secret description
                  const input: UpdateSecretCommandInput = {
                    SecretId: secret.name,
                    Description: secret.description,
                  };
                  await updateSecret(client.secretsClient, input);
                }

                if (secret.value !== cloudRecord.value) {
                  // we need to update the value
                  if (secret.value) {
                    const input: PutSecretValueCommandInput = {
                      SecretId: secret.name,
                      SecretString: secret.value,
                    };
                    await putSecretValue(client.secretsClient, input);
                  }
                }

                // modify the database, without saving the secret
                secret.value = null;
                await AwsSecretsManagerModule.mappers.secret.db.update(secret, ctx);
                out.push(secret);
              }
            }
            return out;
          },
          delete: async (secrets: Secret[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const secret of secrets) {
              if (secret.name) {
                await deleteSecret(client.secretsClient, {
                  SecretId: secret.name,
                  ForceDeleteWithoutRecovery: true,
                });
              }
            }
          },
        }),
      }),
    },
  },
  __dirname
);
