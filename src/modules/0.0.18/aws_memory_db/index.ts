import { ModuleBase, } from '../../interfaces'
import { MemoryDBClusterMapper, } from './mappers'

export class AwsMemoryDBModule extends ModuleBase {
  memoryDBCluster: MemoryDBClusterMapper;

  constructor() {
    super();
    this.memoryDBCluster = new MemoryDBClusterMapper(this);
    super.init();
  }
}
export const awsMemoryDBModule = new AwsMemoryDBModule();
