import {
  Check,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';
import { SecurityGroup } from '../../aws_security_group/entity';

/**
 * @enum
 * Different architectures supported by Lambda
 * Currently "arm64" and "x86_64" are supported
 * @see https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html
 */
export enum Architecture {
  arm64 = 'arm64',
  x86_64 = 'x86_64',
}

/**
 * @enum
 * Different types of lambda deployment packages
 * Currently only "zip" is supported
 * @see https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-package.html
 *
 */
export enum PackageType {
  // TODO: uncomment this once Image type is supported, meanwhile does not make sense to have it available
  // Image = "Image",
  Zip = 'Zip',
}

/**
 * @enum
 * Different types of lambda runtimes
 * @see https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
 *
 */
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
  nodejs18x = 'nodejs18.x',
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

/**
 * Table to manage AWS Lambda functions. AWS Lambda is a serverless, event-driven compute service that lets you run code
 * for virtually any type of application or backend service without provisioning or managing servers.
 *
 * You can trigger Lambda from over 200 AWS services and software as a service (SaaS) applications, and only pay for what you use.
 *
 * @see https://aws.amazon.com/lambda/
 */
@Entity()
@Unique('uq_lambda_region', ['name', 'region'])
export class LambdaFunction {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name to identify the function
   */
  @Column({ nullable: false })
  @cloudId
  name: string;

  /**
   * @public
   * AWS ARN for the function
   */
  @Column({ nullable: true })
  arn?: string;

  /**
   * @public
   * Version used to manage the function deployment
   * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html
   */
  @Column({
    default: '$LATEST',
  })
  version?: string;

  /**
   * @public
   * Description for the function
   * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html
   */
  @Column({ nullable: true })
  description?: string;

  /**
   * @public
   * The base64-encoded contents of the deployment package.
   * This currently work as input value. After creation the value is set to null.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-lambda/interfaces/functioncode.html#zipfile
   *
   * @privateRemarks
   * TODO: Validate string content is a valid b64 encoded zip file
   * TODO: Add flag to keep code around. Try to get code back from lambda s3 bucket.
   */
  @Column({ nullable: true })
  zipB64?: string;

  /**
   * @public
   * Role used by the function
   * @see https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html
   */
  @ManyToOne(() => IamRole, role => role.roleName, { eager: true })
  @JoinColumn({
    name: 'role_name',
  })
  role: IamRole;

  /**
   * @public
   * Method in your function code that processes events
   * @see https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
   */
  @Check(
    'CHK_lambda_handler__package_type',
    `("package_type" = 'Zip' AND "handler" IS NOT NULL) OR "package_type" != 'Zip'`,
  )
  @Column({ nullable: true })
  handler?: string;

  /**
   * @public
   * Language runtime used in this function
   * @see https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
   */
  @Check(
    'CHK_lambda_runtime__package_type',
    `("package_type" = 'Zip' AND "runtime" IS NOT NULL) OR "package_type" != 'Zip'`,
  )
  @Column({
    type: 'enum',
    enum: Runtime,
    nullable: true,
  })
  runtime?: Runtime;

  /**
   * @public
   * Type of packaging used by this function. Only "zip" is supported
   */
  @Column({
    type: 'enum',
    enum: PackageType,
    default: PackageType.Zip,
  })
  packageType: PackageType;

  /**
   * @public
   * Architecture set used by the function
   */
  @Column({
    enum: Architecture,
    type: 'enum',
    default: Architecture.x86_64,
  })
  architecture?: Architecture;

  /**
   * @public
   * Memory allocated to the lambda function
   * @see https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html
   */
  @Column({
    type: 'int',
    default: 128,
  })
  memorySize?: number;

  /**
   * @public
   * Complex type to represent the environment vars passed to the function
   * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  environment?: { [key: string]: string };

  /**
   * @public
   * Complex type to provide identifier tags for the function
   * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-tags.html
   *
   * @privateRemarks
   * TODO: find a way to add string values only constraint
   * TODO: find a way to add at least one key constraint
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  /**
   * @public
   * List of associated subnets to this function. Only used when the
   * lambda is on a private VPC
   * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html
   */
  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

  /**
   * @public
   * List of security groups associated to this function.
   * Only used when the lambda is on a private VPC
   * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html
   */
  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'lambda_function_security_groups',
  })
  securityGroups: SecurityGroup[];

  /**
   * @public
   * Region for the function
   */
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
