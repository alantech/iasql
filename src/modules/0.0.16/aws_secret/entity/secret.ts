import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  PrimaryColumn,
} from "typeorm";

import { cloudId } from "../../../../services/cloud-id";

@Entity()
export class Secret {
  @PrimaryColumn({
    nullable: false,
    type: "varchar",
  })
  @cloudId
  name: string;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    type: String,
    nullable: true,
  })
  value!: string | null;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach((k) => {
      if (k !== "value") {
        if (that[k] === null) that[k] = undefined;
      }
    });
  }
}
