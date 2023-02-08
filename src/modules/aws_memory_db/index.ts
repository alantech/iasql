import { ModuleBase } from '../interfaces';
import { MemoryDBClusterMapper, SubnetGroupMapper } from './mappers';

export class AwsMemoryDBModule extends ModuleBase {
  /** @internal */
  memoryDBCluster: MemoryDBClusterMapper;
  /** @internal */
  subnetGroup: SubnetGroupMapper;

  constructor() {
    super();
    this.subnetGroup = new SubnetGroupMapper(this);
    this.memoryDBCluster = new MemoryDBClusterMapper(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-memory-db-integration.ts#MemoryDB Integration Testing#Manage Memory DB
 * ```
 */
export const awsMemoryDBModule = new AwsMemoryDBModule();
