import { AvailabilityZoneMessage as AvailabilityZoneMessageAWS, AvailabilityZone as AvailabilityZoneAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { AvailabilityZoneMessage, } from '../entity/availability_zone_message';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { AvailabilityZoneMapper } from '.';

type AvailabilityZoneMessageType = {
  message: AvailabilityZoneMessageAWS,
  availabilityZone: AvailabilityZoneAWS,
}

export const AvailabilityZoneMessageMapper = new EntityMapper(AvailabilityZoneMessage, {
  message: (availabilityZoneType: AvailabilityZoneMessageType, _indexes: IndexedAWS) => availabilityZoneType?.message,
  availabilityZone: (availabilityZoneType: AvailabilityZoneMessageType, indexes: IndexedAWS) => AvailabilityZoneMapper.fromAWS(availabilityZoneType.availabilityZone, indexes),
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
