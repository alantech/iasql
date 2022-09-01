import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

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
    default: ValidationMethod.DNS
  })
  validationMethod: ValidationMethod;
}
