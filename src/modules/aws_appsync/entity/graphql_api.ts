import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * Available types of authentication for GraphQL endpoint. GraphQL is a query and manipulation
 * language for APIs.
 *
 * GraphQL provides a flexible and intuitive syntax to describe data requirements and interactions.
 * It enables developers to ask for exactly what is needed and get back predictable results.
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html
 */
export enum AuthenticationType {
  AMAZON_COGNITO_USER_POOLS = 'AMAZON_COGNITO_USER_POOLS',
  API_KEY = 'API_KEY',
  AWS_IAM = 'AWS_IAM',
  AWS_LAMBDA = 'AWS_LAMBDA',
  OPENID_CONNECT = 'OPENID_CONNECT',
}

/**
 * @enum
 * Wether to allow or deny access to the GraphQL endpoint by default
 */
export enum DefaultAction {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

/**
 * Table to manage GraphQL API entires
 *
 * @example
 * ```sql TheButton[Manage GraphQL API]="Manage GraphQL API"
 *  INSERT INTO graphql_api (name, authentication_type) VALUES ('graphql-api', 'API_KEY');
 *
 *  UPDATE graphql_api SET authentication_type='AWS_IAM' WHERE name='graphql-api';
 *
 *  SELECT * FROM graphql_api WHERE name='graphql-api';
 *
 *  DELETE FROM graphql_api WHERE name = 'graphql-api';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-appsync-integration.ts#L95
 * @see https://aws.amazon.com/appsync
 *
 */
@Entity()
export class GraphqlApi {
  /**
   * @internal
   * Internal ID field for storing accounts
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name to identify the GraphQL entry
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  /**
   * @public
   * AWS ID for the GraphQL entry
   */
  @Column({
    nullable: true,
  })
  apiId: string;

  /**
   * @public
   * ARN for the AWS resource
   */
  @Column({
    nullable: true,
  })
  arn: string;

  /**
   * @public
   * Authentication type for the endpoint
   */
  @Column({
    type: 'enum',
    enum: AuthenticationType,
  })
  authenticationType: AuthenticationType;

  /**
   * @public
   * Specific configuration for Lambda Authentication Type
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  lambdaAuthorizerConfig?: {
    authorizerResultTtlInSeconds: number | undefined;
    authorizerUri: string | undefined;
    identityValidationExpression: string | undefined;
  };

  /**
   * @public
   * Specific configuration for the Open ID authentication type
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  openIDConnectConfig?: {
    authTtl: number | undefined;
    clientId: string | undefined;
    iaTtl: number | undefined;
    issuer: string | undefined;
  };

  /**
   * @public
   * Specific configuration for Cognito authentication type
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  userPoolConfig?: {
    appIdClientRegex: string | undefined;
    awsRegion: string | undefined;
    defaultAction: DefaultAction | undefined;
    userPoolId: string | undefined;
  };

  /**
   * @public
   * Region where the API gateway will be created
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html
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
