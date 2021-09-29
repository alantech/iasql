import { Image } from '@aws-sdk/client-ec2';

import { AWS, } from './gateways/aws'
import * as Entities from '../entity'
import * as Mappers from '../mapper'


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
    const populator = async (entity: Function, awsMethod: string, awsArr: string, idProp: string) => {
      const t1 = Date.now();
      console.log(`Populating ${entity}...`);
      const entitiesAws = await (awsClient as unknown as { [key: string]: Function })[awsMethod]();
      console.log(`Querying AWS for ${entity} complete...`);
      for (const entityAws of (entitiesAws[awsArr] ?? [])) {
        this.set(entity, entityAws[idProp] ?? '', entityAws);
      }
      const t2 = Date.now();
      console.log(`${entity} complete in ${t2 - t1}ms`);
    }
    await Promise.all([
      Mappers.RegionMapper.readAWS(awsClient, this),
      populator(Entities.SecurityGroup, 'getSecurityGroups', 'SecurityGroups', 'GroupId'),
      populator(
        Entities.SecurityGroupRule,
        'getSecurityGroupRules',
        'SecurityGroupRules',
        'SecurityGroupRuleId',
      ),
      populator(Entities.AMI, 'getAMIs', 'Images', 'ImageId'),
    ]);
    this.setAuxAmiIndexes();
  }

  setAuxAmiIndexes() {
    const amis: { [key: string]: Image } = this.get(Entities.AMI);
    for (const [_id, ami] of Object.entries(amis)) {
      if (ami.Architecture) {
        this.set(Entities.CPUArchitecture, ami.Architecture, ami.Architecture);
      }
      if (ami.ProductCodes && ami.ProductCodes.length) {
        for (const pc of ami.ProductCodes) {
          if (pc.ProductCodeId) {
            this.set(Entities.ProductCode, pc.ProductCodeId, pc);
          } else {
            throw Error('productCodes is this possible?');
          }
        }
      }
      if (ami.StateReason) {
        if (ami.StateReason.Code) {
          this.set(Entities.StateReason, ami.StateReason.Code, ami.StateReason);
        } else {
          throw Error('stateReason is this possible?')
        }
      }
      if (ami.BootMode) {
        this.set(Entities.BootMode, ami.BootMode, ami.BootMode);
      }
    }
  }

  toEntityList(mapper: Mappers.EntityMapper) {
    const entity = mapper.getEntity();
    const entitiesAws = Object.values(this.get(entity) ?? {});
    return entitiesAws.map(e => mapper.fromAWS(e, this));
  }

  set(entity: Function, key: string, value: any) {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    this.index[entityName][key] = value;
  }

  setAll(entity: Function, entityList: any[], idName: string) {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    entityList.forEach(e => this.index[entityName][e[idName] ?? ''] = e);
  }

  get(entity?: Function, key?: string) {
    if (!entity && key) {
      throw new Error('Error getting indexed entities');
    }
    if (entity && key) {
      const entityName = entity.name;
      if (!(entityName in this.index)) return undefined; 
      return this.index[entityName][key];
    }
    if (entity) {
      return this.index[entity.name];
    }
    return this.index;
  }
}
