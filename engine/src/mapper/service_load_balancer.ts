import { LoadBalancer as ServiceLoadBalancerAWS, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { ServiceLoadBalancer, } from '../entity/service_load_balancer'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { ELB, TargetGroup, } from '../entity'
import { ELBMapper, TargetGroupMapper, } from '.'

export const ServiceLoadBalancerMapper = new EntityMapper(ServiceLoadBalancer, {
  targetGroup: async (s: ServiceLoadBalancerAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (s?.targetGroupArn) {
      const entity = await indexes.getOr(TargetGroup, s.targetGroupArn, awsClient.getTargetGroup.bind(awsClient))
      return await TargetGroupMapper.fromAWS(entity, awsClient, indexes);
    } else {
      return null;
    }
  },
  elb: async (s: ServiceLoadBalancerAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (s?.loadBalancerName) {
      let loadBalancers = indexes.get(ELB);
      if (!Object.keys(loadBalancers).length) {
        loadBalancers = await awsClient.getLoadBalancers();
        indexes.setAll(ELB, loadBalancers, 'LoadBalancerArn');
      } else {
        loadBalancers = Object.values(loadBalancers);
      }
      const entity = await indexes.getOr(
        ELB, loadBalancers.find(
          (awsLb: any) => awsLb.LoadBalancerName === s.loadBalancerName
        ).LoadBalancerArn, awsClient.getLoadBalancer.bind(awsClient)
      )
      return await ELBMapper.fromAWS(entity, awsClient, indexes);
    } else {
      return null;
    }
  },
  containerName: (s: ServiceLoadBalancerAWS) => s.containerName,
  containerPort: (s: ServiceLoadBalancerAWS) => s.containerPort,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: ServiceLoadBalancer, _awsClient: AWS, _indexes: IndexedAWS) => {
    throw new Error('tbd')
  },
  updateAWS: async (_obj: ServiceLoadBalancer, _awsClient: AWS, _indexes: IndexedAWS) => {
    throw new Error('tbd')
  },
  deleteAWS: async (_obj: ServiceLoadBalancer, _awsClient: AWS, _indexes: IndexedAWS) => {
    throw new Error('tbd')
  },
})
