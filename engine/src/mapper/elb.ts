import { LoadBalancer, } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../services/gateways/aws'
import { ELB, } from '../entity/elb'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { AvailabilityZone, SecurityGroup, Vpc } from '../entity'
import { AvailabilityZoneMapper, SecurityGroupMapper, VpcMapper } from '.'

export const ELBMapper = new EntityMapper(ELB, {
  loadBalancerArn: (elb: LoadBalancer) => elb?.LoadBalancerArn ?? null,
  dnsName: (elb: LoadBalancer) => elb?.DNSName ?? null,
  canonicalHostedZoneId: (elb: LoadBalancer) => elb?.CanonicalHostedZoneId ?? null,
  createdTime: (elb: LoadBalancer) => elb?.CreatedTime ? new Date(elb.CreatedTime) : null,
  loadBalancerName: (elb: LoadBalancer) => elb.LoadBalancerName,
  scheme: (elb: LoadBalancer) => elb.Scheme,
  vpc: async (elb: LoadBalancer, awsClient: AWS, indexes: IndexedAWS) => {
    if (elb?.VpcId) {
      const vpc = await indexes.getOr(Vpc, elb.VpcId, awsClient.getVpc.bind(awsClient));
      return await VpcMapper.fromAWS(Vpc, vpc, indexes);
    } else {
      return null;
    }
  },
  state: (elb: LoadBalancer) => elb?.State ?? null,
  elbType: (elb: LoadBalancer) => elb.Type,
  availabilityZones: async (elb: LoadBalancer, awsClient: AWS, indexes: IndexedAWS) => {
    if (elb?.AvailabilityZones) {
      const azs = await Promise.all(elb.AvailabilityZones.map(az => indexes.getOr(AvailabilityZone, az.ZoneName!, awsClient.getAvailabilityZoneByName.bind(awsClient))));
      return await Promise.all(azs.map(az => AvailabilityZoneMapper.fromAWS(AvailabilityZone, az, indexes)));
    } else {
      return [];
    }
  },
  securityGroups: async (elb: LoadBalancer, awsClient: AWS, indexes: IndexedAWS) => {
    if (elb?.SecurityGroups) {
      const sgs = await Promise.all(elb.SecurityGroups.map(sg => indexes.getOr(SecurityGroup, sg, awsClient.getSecurityGroup.bind(awsClient))));
      return await Promise.all(sgs.map(sg => SecurityGroupMapper.fromAWS(SecurityGroup, sg, indexes)));
    } else {
      return [];
    }
  },
  ipAddressType: (elb: LoadBalancer) => elb.IpAddressType,
  customerOwnedIpv4Pool: (elb: LoadBalancer) => elb?.CustomerOwnedIpv4Pool ?? null,
},
  {
    readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
      const t1 = Date.now();
      const loadBalancers = (await awsClient.getLoadBalancers())?.LoadBalancers ?? [];
      indexes.setAll(ELB, loadBalancers, 'LoadBalancerArn');
      const t2 = Date.now();
      console.log(`ELBs set in ${t2 - t1}ms`);
    },
    createAWS: async (obj: ELB, awsClient: AWS, indexes: IndexedAWS) => {
      const result = await awsClient.createLoadBalancer({
        Name: obj.loadBalancerName,
        Subnets: obj.subnets?.map(sn => sn.subnetId!),
        SecurityGroups: obj.securityGroups?.map(sg => sg.groupId!),
        Scheme: obj.scheme,
        Type: obj.elbType,
        IpAddressType: obj.ipAddressType,
        CustomerOwnedIpv4Pool: obj.customerOwnedIpv4Pool,
      });
      // TODO: Handle if it fails (somehow)
      if (!result?.hasOwnProperty('LoadBalancerArn')) { // Failure
        throw new Error('what should we do here?');
      }
      const created = await awsClient.getLoadBalancer(result.LoadBalancerArn ?? '');
      indexes.set(ELB, created?.LoadBalancerArn ?? '', created);
      const newEntity: ELB = await ELBMapper.fromAWS(created, awsClient, indexes);
      newEntity.id = obj.id;
      for (const key of Object.keys(newEntity)) {
        (obj as any)[key] = (newEntity as any)[key];
      }
      return newEntity;
    },
    updateAWS: async (obj: ELB, awsClient: AWS, indexes: IndexedAWS) => { throw new Error('tbd') },
    deleteAWS: async (obj: ELB, awsClient: AWS, indexes: IndexedAWS) => {
      if (obj.loadBalancerArn) {
        await awsClient.deleteLoadBalancer(obj.loadBalancerArn);
        // TODO: What does the error even look like? Docs are spotty on this
        indexes.del(ELB, obj.loadBalancerArn);
      }
      return obj;
    },
  }
)
