import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'

@Entity()
export class ParameterGroup {

  @PrimaryColumn()
  @cloudId
  name: string;

  @Column({
    unique: true,
    nullable: true,
  })
  arn?: string;

  // There's no valid enum for this and creating one will create for us the need to keep it updated constantly every time a new version goes out for any of the supported databases
  // We can provide how to get the family with the following command:
  // aws rds describe-db-engine-versions --query "DBEngineVersions[].DBParameterGroupFamily" --engine <engine>
  @Column()
  family: string;

  @Column()
  description: string;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}