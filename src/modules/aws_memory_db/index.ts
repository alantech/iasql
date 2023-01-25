import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { MemoryDBClusterMapper, SubnetGroupMapper } from './mappers';

export class AwsMemoryDBModule extends ModuleBase {
  memoryDBCluster: MemoryDBClusterMapper;
  subnetGroup: SubnetGroupMapper;
  invokeMemoryDb: AwsSdkInvoker;

  constructor() {
    super();
    /** @internal */
    this.memoryDBCluster = new MemoryDBClusterMapper(this);

    /** @internal */
    this.subnetGroup = new SubnetGroupMapper(this);
    this.invokeMemoryDb = new AwsSdkInvoker('memoryDBClient', this);
    super.init();
  }
}
export const awsMemoryDBModule = new AwsMemoryDBModule();
