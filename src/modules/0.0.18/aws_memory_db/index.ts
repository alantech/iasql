import { ModuleBase } from '../../interfaces';
import { MemoryDBClusterMapper, SubnetGroupMapper } from './mappers';

export class AwsMemoryDBModule extends ModuleBase {
  memoryDBCluster: MemoryDBClusterMapper;
  subnetGroup: SubnetGroupMapper;

  constructor() {
    super();
    this.memoryDBCluster = new MemoryDBClusterMapper(this);
    this.subnetGroup = new SubnetGroupMapper(this);
    super.init();
  }
}
export const awsMemoryDBModule = new AwsMemoryDBModule();
