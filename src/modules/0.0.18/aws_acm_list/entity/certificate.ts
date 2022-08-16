import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'

export enum certificateStatusEnum {
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
  INACTIVE = "INACTIVE",
  ISSUED = "ISSUED",
  PENDING_VALIDATION = "PENDING_VALIDATION",
  REVOKED = "REVOKED",
  VALIDATION_TIMED_OUT = "VALIDATION_TIMED_OUT",
}

export enum certificateTypeEnum {
  AMAZON_ISSUED = "AMAZON_ISSUED",
  IMPORTED = "IMPORTED",
  // TODO: add private certs support
  // PRIVATE = "PRIVATE",
}

export enum certificateRenewalEligibilityEnum {
  ELIGIBLE = "ELIGIBLE",
  INELIGIBLE = "INELIGIBLE",
}

@Entity()
export class Certificate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
    unique: true,
  })
  @cloudId
  arn?: string;

  @Column({
    nullable: true,
  })
  certificateId?: string;

  @Column()
  domainName: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: certificateTypeEnum,
  })
  certificateType?: certificateTypeEnum;

  @Column({
    nullable: true,
    type: 'enum',
    enum: certificateStatusEnum,
  })
  status?: certificateStatusEnum;

  @Column({
    nullable: true,
    type: 'enum',
    enum: certificateRenewalEligibilityEnum,
  })
  renewalEligibility?: certificateRenewalEligibilityEnum;

  @Column({
    default: false,
  })
  inUse: boolean;
}
