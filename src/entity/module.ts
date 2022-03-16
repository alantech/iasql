import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm'

@Entity()
export class IasqlModule {
  @Column({
    primary: true,
    unique: true,
  })
  name: string;

  @ManyToMany(() => IasqlModule, (m) => m.name, {
    createForeignKeyConstraints: true,
    nullable: true,
  })
  @JoinTable({
    name: 'iasql_dependencies',
    joinColumn: {
      name: 'module',
      referencedColumnName: 'name',
    },
    inverseJoinColumn: {
      name: 'dependency',
      referencedColumnName: 'name',
    },
  })
  dependencies: IasqlModule[];

  @OneToMany(() => IasqlTables, t => t.module)
  tables: IasqlTables[];
}

@Entity()
export class IasqlTables {
  @ManyToOne(() => IasqlModule, (m) => m.name, { primary: true, })
  @JoinColumn({ name: 'module' })
  module: IasqlModule;

  @Column({ nullable: false, primary: true, })
  table: string;
}