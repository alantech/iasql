class IndexedAWS {
  private index: any;

  constructor() {
    this.index = {};
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
      throw 'Error getting indexed entities';
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
