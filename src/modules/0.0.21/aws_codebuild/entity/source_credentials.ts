import { Column, Entity, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { SourceType } from './project';

export enum AuthType {
  PERSONAL_ACCESS_TOKEN = 'PERSONAL_ACCESS_TOKEN',
  // OAUTH = 'OAUTH',
  // BASIC_AUTH = 'BASIC_AUTH',
}

@Entity()
export class SourceCredentialsList {
  @PrimaryColumn()
  @cloudId
  arn: string;

  @Column({
    type: 'enum',
    enum: SourceType,
  })
  sourceType: SourceType;

  @Column()
  authType: AuthType;
}

@Entity()
export class SourceCredentialsImport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  token: string;

  // TODO implement for BASIC_AUTH with Bitbucket
  // @Column()
  // username: string;

  @Column({
    type: 'enum',
    enum: SourceType,
  })
  sourceType: SourceType;

  @Column({
    type: 'enum',
    enum: AuthType,
  })
  authType: AuthType;
}
