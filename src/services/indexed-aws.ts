import { AWS, } from './gateways/aws'
import { EntityMapper, } from '../mapper/entity'
import { Image, InstanceTypeInfo } from '@aws-sdk/client-ec2';

type Index = {
  [entity: string]: {
    [key: string]: any,
  },
};

export class IndexedAWS {
  private index: Index;

  constructor() {
    this.index = {};
  }

  async populate(awsClient: AWS) {
    const populator = async (entity: string, awsMethod: string, awsArr: string, idProp: string) => {
      const entitiesAws = await (awsClient as unknown as { [key: string]: Function })[awsMethod]();
      for (const entityAws of (entitiesAws[awsArr] ?? [])) {
        this.set(entity, entityAws[idProp] ?? '', entityAws);
      }
    }
    await Promise.all([
      populator('regions', 'getRegions', 'Regions', 'RegionName'),
      populator('securityGroups', 'getSecurityGroups', 'SecurityGroups', 'GroupId'),
      populator(
        'securityGroupRules',
        'getSecurityGroupRules',
        'SecurityGroupRules',
        'SecurityGroupRuleId',
      ),
      populator('amis', 'getAMIs', 'Images', 'ImageId'),
      populator('instanceTypes', 'getInstanceTypes', 'InstanceTypes', 'InstanceType'),
    ]);
    this.setAuxIndexes();
  }

  setAuxIndexes() {
    this.setAMIAuxIndexes();
    this.setInstanceTypeAuxIndexes();
  }

  setAMIAuxIndexes() {
    const amis: { [key: string]: Image } = this.get('amis');
    for (const [_id, ami] of Object.entries(amis)) {
      if (ami.Architecture) {
        this.set('cpuArchitectures', ami.Architecture, ami.Architecture);
      }
      if (ami.ProductCodes && ami.ProductCodes.length) {
        for (const pc of ami.ProductCodes) {
          if (pc.ProductCodeId) {
            this.set('productCodes', pc.ProductCodeId, pc)
          } else {
            throw Error('productCodes is this possible?');
          }
        }
      }
      if (ami.StateReason) {
        if (ami.StateReason.Code) {
          this.set('stateReason', ami.StateReason.Code, ami.StateReason)
        } else {
          throw Error('stateReason is this possible?')
        }
      }
      if (ami.BootMode) {
        this.set('bootMode', ami.BootMode, ami.BootMode)
      }
    }
  }

  setInstanceTypeAuxIndexes() {
    const instanceTypes: { [key: string]: InstanceTypeInfo } = this.get('instanceTypes');
    for (const [_id, instanceType] of Object.entries(instanceTypes)) {
      if (instanceType.SupportedUsageClasses && instanceType.SupportedUsageClasses.length) {
        for (const usageClass of instanceType.SupportedUsageClasses) {
          if (usageClass) {
            this.set('usageClasses', usageClass, usageClass)
          } else {
            throw Error('usageClasses is this possible?');
          }
        }
      }
      if (instanceType.SupportedRootDeviceTypes && instanceType.SupportedRootDeviceTypes.length) {
        for (const supportedRootDeviceType of instanceType.SupportedRootDeviceTypes) {
          if (supportedRootDeviceType) {
            this.set('supportedRootDeviceTypes', supportedRootDeviceType, supportedRootDeviceType)
          } else {
            throw Error('supportedRootDeviceTypes is this possible?');
          }
        }
      }
      if (instanceType.SupportedVirtualizationTypes && instanceType.SupportedVirtualizationTypes.length) {
        for (const supportedVirtualizationType of instanceType.SupportedVirtualizationTypes) {
          if (supportedVirtualizationType) {
            this.set('supportedVirtualizationTypes', supportedVirtualizationType, supportedVirtualizationType)
          } else {
            throw Error('supportedVirtualizationTypes is this possible?');
          }
        }
      }
    }
  }

  async toEntityList(entity: string, mapper: EntityMapper) {
    const entitiesAws = Object.values(this.get(entity) ?? {});
    return await Promise.all(entitiesAws.map(e => mapper.fromAWS(e, this)));
  }

  set(entity: string, key: string, value: any) {
    if (entity in this.index) {
      this.index[entity][key] = value;
    } else {
      this.index[entity] = { [key]: value };
    }
  }

  get(entity?: string, key?: string) {
    if (!entity && key) {
      throw new Error('Error getting indexed entities');
    }
    if (entity && key) {
      if (!(entity in this.index)) return undefined; 
      return this.index[entity][key];
    }
    if (entity) {
      return this.index[entity];
    }
    return this.index;
  }
}
