import { AWS } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Domain } from '../entity';

export class DomainMapper extends MapperBase<Domain> {
  cloud = new Crud2({
    create: async (es: Domain[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        client.opensearchClient.createDomain()
      }
    },
    read: async (ctx: Context) => {},
    updateOrReplace: (prev: Domain, next: Domain) => 'update',
    update: async (es: Domain[], ctx: Context) => {},
    delete: async (e: Domain[], ctx: Context) => {},
  });
}
