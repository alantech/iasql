import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * Specifies the protocols that are covered for API gateway
 */
export enum Protocol {
  HTTP = 'HTTP',
  WEBSOCKET = 'WEBSOCKET',
}

/**
 * Table to manage AWS API gateway entries. Amazon API Gateway is a fully managed service that makes it easy for developers to
 * create, publish, maintain, monitor, and secure APIs at any scale.
 *
 * APIs act as the "front door" for applications to access data, business logic, or functionality from your backend services.
 *
 * @see https://aws.amazon.com/api-gateway/
 *
 */
@Entity()
export class Api {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * AWS ID for the generated API gateway
   */
  @Column({
    nullable: true,
  })
  @cloudId
  apiId: string;

  /**
   * @public
   * Given name for the API gateway
   */
  @Column({
    nullable: true,
  })
  name?: string;

  /**
   * @public
   * Description
   */
  @Column({
    nullable: true,
  })
  description?: string;

  /**
   * @public
   * Wether disable API execution endpoint
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/rest-api-disable-default-endpoint.html
   */
  @Column({
    nullable: true,
  })
  disableExecuteApiEndpoint?: boolean;

  /**
   * @public
   * Protocol for the API gateway
   */
  @Column({
    type: 'enum',
    enum: Protocol,
    nullable: true,
  })
  protocolType?: Protocol;

  /**
   * @public
   * Specific version for this publication
   */
  @Column({
    nullable: true,
  })
  version?: string;

  /**
   * @public
   * Region where the API gateway will be created
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

  /**
   * @public
   * Complex type to provide identifier tags
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-apigatewayv2/interfaces/gettagsresponse.html#tags
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
