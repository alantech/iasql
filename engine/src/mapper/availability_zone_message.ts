import { AvailabilityZoneMessage as AvailabilityZoneMessageAWS, AvailabilityZone as AvailabilityZoneAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { AvailabilityZoneMapper, } from '.'
import { AvailabilityZoneMessage, } from '../entity/availability_zone_message'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

type AvailabilityZoneMessageType = {
  message: AvailabilityZoneMessageAWS,
  availabilityZone: AvailabilityZoneAWS,
}

export const AvailabilityZoneMessageMapper = new EntityMapper(AvailabilityZoneMessage, {
  message: (availabilityZoneType: AvailabilityZoneMessageType) => availabilityZoneType?.message,
  availabilityZone: async (
    availabilityZoneType: AvailabilityZoneMessageType,
    awsClient: AWS,
    indexes: IndexedAWS,
  ) => await AvailabilityZoneMapper.fromAWS(availabilityZoneType.availabilityZone, awsClient, indexes),
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
