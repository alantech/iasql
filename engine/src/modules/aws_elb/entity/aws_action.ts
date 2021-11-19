import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { AwsTargetGroup, } from '.'

export enum ActionTypeEnum {
  // AUTHENTICATE_COGNITO = "authenticate-cognito",
  // AUTHENTICATE_OIDC = "authenticate-oidc",
  // FIXED_RESPONSE = "fixed-response",
  FORWARD = "forward",
  // REDIRECT = "redirect"
}

// TODO: For now just handling type FORWARD for only one target group
@Entity()
export class AwsAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ActionTypeEnum,
  })
  actionType: ActionTypeEnum;

  @ManyToOne(() => AwsTargetGroup, { nullable: false, eager: true, })
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup: AwsTargetGroup;
}
