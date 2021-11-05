import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { TargetGroup, } from '.'
import { noDiff, } from '../services/diff'

export enum ActionTypeEnum {
  // AUTHENTICATE_COGNITO = "authenticate-cognito",
  // AUTHENTICATE_OIDC = "authenticate-oidc",
  // FIXED_RESPONSE = "fixed-response",
  FORWARD = "forward",
  // REDIRECT = "redirect"
}

// TODO: For now just handling type FORWARD for only one target group
@Entity()
export class Action {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ActionTypeEnum,
  })
  actionType: ActionTypeEnum;

  @ManyToOne(() => TargetGroup, { eager: true, })
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup: TargetGroup;
}
