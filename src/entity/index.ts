import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn
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
  pgUser: string;

  @Column({
    default: false,
  })
  directConnect: boolean;

  @Column({
    type: 'int',
    default: 0,
  })
  recordCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}