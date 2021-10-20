import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
} from 'typeorm'

@Entity()
export class IasqlModule {
  @Column({
    primary: true,
    unique: true,
  })
  name: string;

  @Column()
  installed: boolean;

  @Column()
  enabled: boolean;

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
}