import { EC2, KeyPairInfo, KeyType } from '@aws-sdk/client-ec2';

import { AwsEc2Module } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { KeyPair } from '../entity/key_pair';

export class KeyPairMapper extends MapperBase<KeyPair> {
  module: AwsEc2Module;
  entity = KeyPair;
  equals = (a: KeyPair, b: KeyPair) =>
    Object.is(a.fingerprint, b.fingerprint) &&
    Object.is(a.keyPairId, b.keyPairId) &&
    Object.is(a.publicKey, b.publicKey) &&
    Object.is(a.type, b.type);

  keyPairMapper(e: KeyPairInfo, region: string) {
    const out = new KeyPair();
    if (!e.KeyPairId) return undefined;
    out.name = e.KeyName ?? e.KeyPairId;
    out.keyPairId = e.KeyPairId;
    out.fingerprint = e.KeyFingerprint;
    out.publicKey = e.PublicKey;
    if (e.KeyType) out.type = e.KeyType as KeyType;
    out.region = region;
    return out;
  }

  async getKeyPair(client: EC2, name: string) {
    const keypairs = await client.describeKeyPairs({ KeyNames: [name], IncludePublicKey: true });
    if ((keypairs.KeyPairs ?? []).length > 0) return (keypairs.KeyPairs ?? [])[0];
    else return undefined;
  }
  async getKeyPairs(client: EC2) {
    const keypairs = await client.describeKeyPairs({ IncludePublicKey: true });
    return keypairs.KeyPairs ?? [];
  }
  async deleteKeyPair(client: EC2, name: string) {
    await client.deleteKeyPair({ KeyName: name });
  }

  cloud = new Crud2<KeyPair>({
    create: async (es: KeyPair[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.keypair.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        const { name, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawKeyPair = await this.getKeyPair(client.ec2client, name);
        if (rawKeyPair) return this.keyPairMapper(rawKeyPair, region);
        else return undefined;
      } else {
        // read all keypairs for the region
        const out: KeyPair[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawKeyPairs = (await this.getKeyPairs(client.ec2client)) ?? [];
            for (const rk of rawKeyPairs) {
              const k = await this.keyPairMapper(rk, region);
              if (k) out.push(k);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (a: KeyPair, b: KeyPair) => 'replace',
    update: async (es: KeyPair[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.KeyPair?.[this.entityId(e)];

        // if we have modified some of the values, we just restore them
        if (
          !Object.is(e.fingerprint, cloudRecord.fingerprint) ||
          !Object.is(e.keyPairId, cloudRecord.keyPairId) ||
          !Object.is(e.type, cloudRecord.type)
        ) {
          await this.module.keypair.db.update(e, ctx);
          out.push(e);
        } else {
          await this.module.keypair.cloud.delete(cloudRecord, ctx);
          await this.module.keypair.cloud.create(e, ctx);
          out.push(e);
        }
      }
      return out;
    },
    delete: async (es: KeyPair[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteKeyPair(client.ec2client, e.name ?? '');
      }
    },
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
