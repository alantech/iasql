import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class IasqlModule {
  @Column({
    primary: true,
    unique: true,
  })
  name: string;

  @ManyToMany(() => IasqlModule, m => m.name, {
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
  @ManyToOne(() => IasqlModule, m => m.name, { primary: true })
  @JoinColumn({ name: 'module' })
  module: IasqlModule;

  @Column({ nullable: false, primary: true })
  table: string;
}

export enum AuditLogChangeType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

@Entity()
export class IasqlAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'timestamp without time zone',
  })
  ts: Date;

  @Column()
  user: string;

  @Column()
  tableName: string;

  @Column({
    type: 'enum',
    enum: AuditLogChangeType,
  })
  changeType: AuditLogChangeType;

  // The actual change will be encoded into a JSON with two optional top-level properties, named
  // `original` and `change`. An UPDATE will have both properties specified, an INSERT will only
  // contain `change`, and a DELETE will only contain `original`. I do not know how to enforce this
  // any better than by comment. :_)
  @Column({
    type: 'json',
  })
  change: { original?: any; change?: any };
}
