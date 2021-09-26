import { AWS, } from './gateways/aws'

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
    await Promise.all([(async () => {
      const regions = await awsClient.getRegions();
      for (const region of (regions.Regions ?? [])) {
        this.set('regions', region.RegionName ?? '', region);
      }
    })(), (async () => {
      const securityGroups = await awsClient.getSecurityGroups();
      for (const sg of (securityGroups.SecurityGroups ?? [])) {
        this.set('securityGroups', sg.GroupId ?? '', sg);
      }
    })(), (async () => {
      const securityGroupRules = await awsClient.getSecurityGroupRules();
      for (const sgr of (securityGroupRules.SecurityGroupRules ?? [])) {
        this.set('securityGroupRules', sgr.SecurityGroupRuleId ?? '', sgr);
      }
    })()]);
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
      return this.index[entity][key];
    }
    if (entity) {
      return this.index[entity];
    }
    return this.index;
  }
}

export default new IndexedAWS();
