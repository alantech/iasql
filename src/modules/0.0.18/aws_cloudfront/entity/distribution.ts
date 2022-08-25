import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id' // This is ridiculous. Can we fix this?

export enum viewerProtocolPolicyEnum {
  ALLOW_ALL = "allow-all",
  REDIRECT_TO_HTTPS = "redirect-to-https",
  HTTPS_ONLY = "https-only"
}

export enum originProtocolPolicyEnum {
  HTTP_ONLY = "http-only",
  MATCH_VIEWER = "match-viewer",
  HTTPS_ONLY = "https-only"
}

@Entity()
export class Distribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  @cloudId
  distributionId?: string;

  @Column({
    nullable: true,
  })
  callerReference?: string;

  @Column({
    nullable: true,
  })
  comment?: string;

  @Column({
    nullable: true,
  })
  enabled?: boolean;

  @Column({
    nullable: true,
  })
  isIPV6Enabled?: boolean;

  @Column({
    nullable: true,
  })
  webACLId?: string;

  @Column({
    type: 'json',
    nullable: false,
  })
  defaultCacheBehavior: { TargetOriginId: string | undefined, ViewerProtocolPolicy: viewerProtocolPolicyEnum, CachePolicyId: string | undefined };

  @Column({
    type: 'json',
    nullable: false,
  })
  origins: { DomainName: string | undefined, Id: string | undefined,
    CustomOriginConfig: { HTTPPort: number|undefined, HTTPSPort: number|undefined, OriginProtocolPolicy: originProtocolPolicyEnum }
  }[];

  @Column({
    nullable: true,
  })
  eTag?: string;

  @Column({
    nullable: true,
  })
  location?: string;

  @Column({
    nullable: true,
  })
  status?: string;
}