import { ModuleBase } from '../interfaces';
import { MemoryDBClusterMapper, SubnetGroupMapper } from './mappers';

export class AwsMemoryDBModule extends ModuleBase {
  memoryDBCluster: MemoryDBClusterMapper;
  subnetGroup: SubnetGroupMapper;

  constructor() {
    super();
    /** @internal */
    this.memoryDBCluster = new MemoryDBClusterMapper(this);

    /** @internal */
    this.subnetGroup = new SubnetGroupMapper(this);
    super.init();
  }
}
export const awsMemoryDBModule = new AwsMemoryDBModule();
