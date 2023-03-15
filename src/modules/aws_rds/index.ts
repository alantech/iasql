import { ModuleBase } from '../interfaces';
import { ParameterGroupMapper, RdsMapper, DBSubnetGroupMapper, DBClusterMapper } from './mappers';

export class AwsRdsModule extends ModuleBase {
  dbCluster: DBClusterMapper;
  rds: RdsMapper;
  parameterGroup: ParameterGroupMapper;
  dbSubnetGroup: DBSubnetGroupMapper;

  constructor() {
    super();
    this.parameterGroup = new ParameterGroupMapper(this);
    this.dbSubnetGroup = new DBSubnetGroupMapper(this);
    this.dbCluster = new DBClusterMapper(this);
    this.rds = new RdsMapper(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-rds-integration.ts#RDS Integration Testing#Manage RDS
 * ```
 */
export const awsRdsModule = new AwsRdsModule();
