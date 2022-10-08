import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

export enum ValidationMethod {
  DNS = 'DNS',
  EMAIL = 'EMAIL',
}

@Entity()
export class CertificateRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  arn: string;

  @Column()
  domainName: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  domainValidationOptions?: { DomainName: string; ValidationDomain: string }[];

  @Column('text', { array: true, nullable: true })
  subjectAlternativeNames?: string[];

  @Column({
    type: 'enum',
    nullable: false,
    enum: ValidationMethod,
    default: ValidationMethod.DNS,
  })
  validationMethod: ValidationMethod;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
