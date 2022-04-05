import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
} from 'typeorm'

@Entity()
export class IasqlDatabase {
  // the name we assign
  @PrimaryColumn()
  pgName: string;

  // the alias the user assigns
  @Column()
  alias: string;

  @Column()
  region: string;

  @Column()
  pgUser: string;

  @Column({
    // default to true for databases that already exists
    default: true,
  })
  isReady: boolean;

  @Column({
    default: false,
  })
  directConnect: boolean;
}

@Entity()
export class IasqlUser {
  // auth0 generated id
  @PrimaryColumn()
  id: string;

  @Column()
  email: string;

  @ManyToMany(() => IasqlDatabase, {
    eager: true,
  })
  @JoinTable({
    name: 'iasql_user_databases',
  })
  iasqlDatabases: IasqlDatabase[];
}