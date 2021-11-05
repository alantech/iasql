import { Action as ActionAWS } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../services/gateways/aws'
import { Action, } from '../entity/action'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { TargetGroup, } from '../entity'
import { TargetGroupMapper, } from '.'

export const ActionMapper = new EntityMapper(Action, {
  actionType: (a: ActionAWS) => a.Type,
  targetGroup: async (a: ActionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (a?.TargetGroupArn) {
      const entity = await indexes.getOr(TargetGroup, a.TargetGroupArn!, awsClient.getTargetGroup.bind(awsClient));
      return await TargetGroupMapper.fromAWS(entity, awsClient, indexes);
    } else {
      return null;
    }
  },
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return;
  },
  createAWS: async (_obj: TargetGroup, _awsClient: AWS, _indexes: IndexedAWS) => {
    throw new Error('tbd');
  },
  updateAWS: async (obj: TargetGroup, awsClient: AWS, indexes: IndexedAWS) => {
    throw new Error('tbd');
  },
  deleteAWS: async (_obj: TargetGroup, _awsClient: AWS, _indexes: IndexedAWS) => {
    throw new Error('tbd');
  },
})
