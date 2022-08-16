import {
    Column,
    Entity,
    PrimaryColumn,
  } from "typeorm";

  import { cloudId } from "../../../../services/cloud-id";

  @Entity()
  export class RestApi {
    @PrimaryColumn({
      nullable: false,
      type: "varchar",
    })
    @cloudId
    restApiId: string;

    @Column()
    name: string;

    @Column({
      nullable: true,
    })
    description?: string;

    @Column({
      nullable: true,
    })
    disableExecuteApiEndpoint?: boolean;

    @Column({
      nullable: true,
    })
    version?: string;

    @Column({
      type: 'json',
      nullable: true,
    })
    policy? : any;
}