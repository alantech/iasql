import { QueryRunner, } from 'typeorm'

export interface CrudInterface {
  create: (e: any | any[], client: any) => Promise<void>;
  read: (client: any, options?: any) => Promise<any | any[]>;
  update: (e: any | any[], client: any) => Promise<void>;
  delete: (e: any | any[], client: any) => Promise<void>;
}

export interface MapperInterface {
  entity: any;
  db: CrudInterface;
  cloud: CrudInterface;
}

export interface ModuleInterface {
  name: string;
  //version: string; // TODO: Get versioning working
  dependencies: string[];
  provides: {
    tables?: string[];
    functions?: string[];
    // TODO: What other PSQL things should be tracked?
  };
  mappers: MapperInterface[];
  migrations: {
    preup?: (q: QueryRunner) => Promise<void>;
    postup?: (q: QueryRunner) => Promise<void>;
    predown?: (q: QueryRunner) => Promise<void>;
    postdown?: (q: QueryRunner) => Promise<void>;
    preinstall?: (q: QueryRunner) => Promise<void>;
    postinstall?: (q: QueryRunner) => Promise<void>;
    preremove?: (q: QueryRunner) => Promise<void>;
    postremove?: (q: QueryRunner) => Promise<void>;
  };
}
