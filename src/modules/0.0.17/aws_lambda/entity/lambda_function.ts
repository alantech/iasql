import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { Role } from '../../aws_iam/entity';

export enum Architecture {
  arm64 = 'arm64',
  x86_64 = 'x86_64',
}

export enum PackageType {
  // TODO: uncomment this once Image type is supported, meanwhile does not make sense to have it available
  // Image = "Image",
  Zip = 'Zip',
}

export enum Runtime {
  dotnet6 = 'dotnet6',
  dotnetcore10 = 'dotnetcore1.0',
  dotnetcore20 = 'dotnetcore2.0',
  dotnetcore21 = 'dotnetcore2.1',
  dotnetcore31 = 'dotnetcore3.1',
  go1x = 'go1.x',
  java11 = 'java11',
  java8 = 'java8',
  java8al2 = 'java8.al2',
  nodejs = 'nodejs',
  nodejs10x = 'nodejs10.x',
  nodejs12x = 'nodejs12.x',
  nodejs14x = 'nodejs14.x',
  nodejs16x = 'nodejs16.x',
  nodejs43 = 'nodejs4.3',
  nodejs43edge = 'nodejs4.3-edge',
  nodejs610 = 'nodejs6.10',
  nodejs810 = 'nodejs8.10',
  provided = 'provided',
  providedal2 = 'provided.al2',
  python27 = 'python2.7',
  python36 = 'python3.6',
  python37 = 'python3.7',
  python38 = 'python3.8',
  python39 = 'python3.9',
  ruby25 = 'ruby2.5',
  ruby27 = 'ruby2.7',
}

@Entity()
export class LambdaFunction {
  @PrimaryColumn()
  @cloudId
  name: string;

  @Column({ nullable: true })
  arn?: string;

  @Column({
    default: '$LATEST',
  })
  version?: string;

  @Column({ nullable: true })
  description?: string;

  // TODO: Validate string content is a valid b64 encoded zip file
  // This currently work as input value. After creation the value is set to null.
  // TODO: Add flag to keep code around. Try to get code back from lambda s3 bucket.
  @Column({ nullable: true })
  zipB64?: string;

  @ManyToOne(() => Role, role => role.roleName, { eager: true })
  @JoinColumn({
    name: 'role_name',
  })
  role: Role;

  @Check(
    'CHK_lambda_handler__package_type',
    `("package_type" = 'Zip' AND "handler" IS NOT NULL) OR "package_type" != 'Zip'`
  )
  @Column({ nullable: true })
  handler?: string;

  @Check(
    'CHK_lambda_runtime__package_type',
    `("package_type" = 'Zip' AND "runtime" IS NOT NULL) OR "package_type" != 'Zip'`
  )
  @Column({
    type: 'enum',
    enum: Runtime,
    nullable: true,
  })
  runtime?: Runtime;

  @Column({
    type: 'enum',
    enum: PackageType,
    default: PackageType.Zip,
  })
  packageType: PackageType;

  @Column({
    enum: Architecture,
    type: 'enum',
    default: Architecture.x86_64,
  })
  architecture?: Architecture;

  @Column({
    type: 'int',
    default: 128,
  })
  memorySize?: number;

  @Column({
    type: 'json',
    nullable: true,
  })
  environment?: { [key: string]: string };

  // TODO: find a way to add string values only constraint
  // TODO: find a way to add at least one key constraint
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
