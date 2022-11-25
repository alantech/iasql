import { ModuleBase } from '../../interfaces';
import { HostedZoneMapper } from './mappers/hosted_zone';
import { ResourceRecordSetMapper } from './mappers/resource_record_set';

export class AwsRoute53Module extends ModuleBase {
  hostedZone: HostedZoneMapper;
  resourceRecordSet: ResourceRecordSetMapper;

  constructor() {
    super();
    this.hostedZone = new HostedZoneMapper(this);
    this.resourceRecordSet = new ResourceRecordSetMapper(this);
    super.init();
  }
}

export const awsRoute53Module = new AwsRoute53Module();
