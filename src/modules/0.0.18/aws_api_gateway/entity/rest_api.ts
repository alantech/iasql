import {
    Column,
    Entity,
    PrimaryColumn,
    PrimaryGeneratedColumn,
  } from "typeorm";

  import { cloudId } from "../../../../services/cloud-id";

  @Entity()
  export class RestApi {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({
      nullable: true,
    })
    @cloudId
    restApiId?: string;

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