import {
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  Check,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

// TODO: Is there a better way to deal with cross-module entities?
import { SecurityGroup, } from '../../aws_security_group/entity';
import { cloudId, } from '../../../../services/cloud-id'

// "terminated" is ommittted because that is achieved by deleting the row
// "pending", "shutting-down", "stopping" are ommitted because they are interim states
export enum State {
  RUNNING = "running",
  STOPPED = "stopped",
  HIBERNATED = "hibernated",
}

// "hibernatable" = true is needed to set the "hibernated" state
@Check(`("hibernatable" = false and "state" != 'hibernated') or "hibernatable" = true`)
@Entity()
export class Instance {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true
  })
  @cloudId
  instanceId?: string;

  @Column()
  ami: string;

  @Column()
  instanceType: string;

  @Column({
    nullable: true,
  })
  keyPairName?: string;

  @Column({
    type: 'enum',
    enum: State,
    default: State.RUNNING
  })
  state: State;

  @Column({
    type: 'bool',
    default: false,
  })
  hibernatable: boolean;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable({
    name: 'instance_security_groups',
  })
  securityGroups: SecurityGroup[];

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

// TODO implement spot instance support
// https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_SpotMarketOptions.html
// export enum SpotType {
//   ONE_TIME = "one-time",
//   PERSISTENT = "peristent",
// }

// export enum SpotInterruptionBehavior {
//   HIBERNATE = "hibernate",
//   STOP = "stop",
//   TERMINATE = "terminate",
// }

// @Entity()
// export class SpotInstanceRequest {
//     @Column({
//     type: 'enum',
//     enum: SpotType,
//   })
//   SpotType?: SpotType;

//   @Column({
//     type: 'enum',
//     enum: SpotInterruptionBehavior,
//   })
//   spotInterruptionBehavior?: SpotInterruptionBehavior;
// }