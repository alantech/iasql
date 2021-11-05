import { Listener as ListenerAWS } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../services/gateways/aws'
import { Listener, } from '../entity/listener'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { ELB, } from '../entity'
import { ActionMapper, ELBMapper, } from '.'
import { DepError } from '../services/lazy-dep'

export const ListenerMapper = new EntityMapper(Listener, {
  listenerArn: (l: ListenerAWS) => l?.ListenerArn ?? null,
  port: (l: ListenerAWS) => l.Port,
  protocol: (l: ListenerAWS) => l.Protocol,
  elb: async (l: ListenerAWS, awsClient: AWS, indexes: IndexedAWS) => {
    const entity = await indexes.getOr(ELB, l.LoadBalancerArn!, awsClient.getLoadBalancer.bind(awsClient));
    return await ELBMapper.fromAWS(entity, awsClient, indexes);
  },
  defaultActions: async (l: ListenerAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (l?.DefaultActions) {
      return await Promise.all(l.DefaultActions.map(a => ActionMapper.fromAWS(a, awsClient, indexes)));
    } else {
      return [];
    }
  },
},
  {
    readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
      const t1 = Date.now();
      const loadBalancers = indexes.get(ELB);
      if (!loadBalancers) throw new DepError('ELBs must be loaded first');
      const loadBalancerArns = Object.keys(loadBalancers);
      const listeners = (await awsClient.getListeners(loadBalancerArns))?.Listeners ?? [];
      indexes.setAll(Listener, listeners, 'ListenerArn');
      const t2 = Date.now();
      console.log(`Listeners set in ${t2 - t1}ms`);
    },
    createAWS: async (l: Listener, awsClient: AWS, indexes: IndexedAWS) => {
      const result = await awsClient.createListener({
        Port: l.port,
        Protocol: l.protocol,
        LoadBalancerArn: l.elb?.loadBalancerArn,
        DefaultActions: l.defaultActions?.map(a => ({ Type: a.actionType, TargetGroupArn: a.targetGroup.targetGroupArn })),
      });
      if (!result?.hasOwnProperty('ListenerArn')) { // Failure
        throw new Error('what should we do here?');
      }
      const newInstance = await indexes.getOr(Listener, result.ListenerArn ?? '', awsClient.getListener.bind(awsClient));
      const newEntity: Listener = await ListenerMapper.fromAWS(newInstance, awsClient, indexes);
      newEntity.id = l.id;
      for (const key of Object.keys(newEntity)) {
        EntityMapper.keepId((l as any)[key], (newEntity as any)[key]);
        (l as any)[key] = (newEntity as any)[key];
      }
      return newEntity;
    },
    updateAWS: async (_obj: Listener, _awsClient: AWS, _indexes: IndexedAWS) => {
      throw new Error('tbd');
    },
    deleteAWS: async (l: Listener, awsClient: AWS, indexes: IndexedAWS) => {
      await awsClient.deleteListener(l.listenerArn!);
      indexes.del(Listener, l.listenerArn!);
      return l;
    },
  }
)
