import { Image } from '@aws-sdk/client-ec2';
import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class ProductCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true
  })
  productCodeId: string;

  @Column()
  productCodeType: string;
}
