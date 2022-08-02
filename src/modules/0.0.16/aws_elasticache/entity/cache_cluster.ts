import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from "typeorm";

import { cloudId } from "../../../../services/cloud-id";
import { SecurityGroup } from "../../aws_security_group/entity";

export enum Engine {
  MEMCACHED = "memcached",
  REDIS = "redis",
}

@Entity()
export class CacheCluster {
  @PrimaryColumn({
    nullable: false,
    type: "varchar",
  })
  @cloudId
  clusterId: string;

  // TODO: convert it to an independent table in the future
  @Column({
    nullable: true,
  })
  nodeType: string;

  @Column({
    type: "enum",
    enum: Engine,
    default: Engine.REDIS,
  })
  engine: Engine;

  @Column({
    nullable: true,
  })
  numNodes?: number;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach((k) => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}
