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
    defaultCacheBehavior: { TargetOriginId: string | undefined, ViewerProtocolPolicy: viewerProtocolPolicyEnum };

    @Column({
        type: 'json',
        nullable: false,
    })
    origins: { DomainName: string | undefined, Id: string | undefined }[];
}