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
    const regions = await awsClient.getRegions();
    for (const region of (regions.Regions ?? [])) {
      this.set('regions', region.RegionName ?? '', region)
    }
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
