import { AwsS3Module } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';

export class S3CleanBucketRpc extends RpcBase {
  module: AwsS3Module;
  outputTable = {
    bucket: 'varchar',
    status: 'varchar',
    response_message: 'varchar',
  } as const;
  call = async (
    dbId: string,
    dbUser: string,
    ctx: Context,
    ...params: string[]
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    console.log('params are');
    console.log(params);
    return [
      {
        bucket: 'test',
        status: 'OK',
        response_message: 'ok',
      },
    ];
  };

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
