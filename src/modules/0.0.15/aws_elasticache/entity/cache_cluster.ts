import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
  } from 'typeorm'
  
  
  import { cloudId, } from '../../../../services/cloud-id'
  import { SecurityGroup, } from '../../aws_security_group/entity';

  export enum Engine {
    MEMCACHED = "memcached",
    REDIS = "redis",
  }  
  
  @Entity()
  export class CacheCluster {
    @PrimaryGeneratedColumn()
    id?: number;
  
    @Column({
      nullable: true,
      comment: 'Unique identifier provided by AWS once the instance is provisioned',
    })
    @cloudId
    clusterId?: string;
    
    @Column()
    nodeType: string;
    
    @ManyToMany(() => SecurityGroup, { eager: true, })
    @JoinTable({
      name: 'cache_security_groups',
    })
    securityGroups: SecurityGroup[];

    @Column({
      type: 'enum',
      enum: Engine,
      default: Engine.REDIS
    })
    engine: Engine;

    @Column()
    numNodes?: number;

    @Column()
    port?: number;
    
  }