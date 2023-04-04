import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * @internal
 */
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

/**
 * Table to track the list of tables used in iasql, and the related module.
 */
@Entity()
export class IasqlTables {
  /**
   * @public
   * Module name
   */
  @Column({ primary: true })
  @ManyToOne(() => IasqlModule, m => m.name)
  @JoinColumn({ name: 'module' })
  module: IasqlModule;

  /**
   * @public
   * Table name
   */
  @Column({ nullable: false, primary: true })
  table: string;
}

/**
 * @enum
 * The different types of changes that can be performed in a given table
 */
export enum AuditLogChangeType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  START_COMMIT = 'START_COMMIT',
  PREVIEW_START_COMMIT = 'PREVIEW_START_COMMIT',
  END_COMMIT = 'END_COMMIT',
  PREVIEW_END_COMMIT = 'PREVIEW_END_COMMIT',
  OPEN_TRANSACTION = 'OPEN_TRANSACTION',
  CLOSE_TRANSACTION = 'CLOSE_TRANSACTION',
  ERROR = 'ERROR',
  START_REVERT = 'START_REVERT',
  END_REVERT = 'END_REVERT',
  SET_COMMIT_MESSAGE = 'SET_COMMIT_MESSAGE',
}

/**
 * Table to track the changes performed in the tables managed by IaSQL.
 * It contains information about user, performed change and timestamp.
 */
@Entity()
export class IasqlAuditLog {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Timestamp of the change
   */
  @Index()
  @Column({
    type: 'timestamp with time zone',
  })
  ts: Date;

  /**
   * @public
   * User that committed the change
   */
  @Column()
  user: string;

  /**
   * @public
   * Name of the affected table
   */
  @Column()
  tableName: string;

  /**
   * @public
   * Type of change
   */
  @Column({
    type: 'enum',
    enum: AuditLogChangeType,
  })
  changeType: AuditLogChangeType;

  // The actual change will be encoded into a JSON with two optional top-level properties, named
  // `original` and `change`. An UPDATE will have both properties specified, an INSERT will only
  // contain `change`, and a DELETE will only contain `original`. I do not know how to enforce this
  // any better than by comment. :_)
  /**
   * @public
   * Complex type to reflect the performed change
   */
  @Column({
    type: 'json',
  })
  change: { original?: any; change?: any };

  /**
   * @public
   * Descriptive message of the change
   */
  @Column({
    nullable: true,
  })
  message: string;

  /**
   * @public
   * Transaction identifier
   */
  @Column({
    nullable: true,
  })
  transactionId: string;
}
