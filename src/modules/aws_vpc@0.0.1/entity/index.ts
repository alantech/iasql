import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'

export enum VpcState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

@Entity()
export class Vpc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  @Index({ unique: true, where: "vpc_id IS NOT NULL" })
  @cloudId
  vpcId?: string;

  @Column()
  cidrBlock: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: VpcState,
  })
  state?: VpcState;

  @Column({
    default: false,
  })
  isDefault: boolean;
}


export enum SubnetState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

export enum AvailabilityZone {
  // Generated 2022-02-23
  ap_northeast_1_wl1_kix_wlz_1 = 'ap-northeast-1-wl1-kix-wlz-1',
  ap_northeast_1_wl1_nrt_wlz_1 = 'ap-northeast-1-wl1-nrt-wlz-1',
  ap_northeast_1a = 'ap-northeast-1a',
  ap_northeast_1c = 'ap-northeast-1c',
  ap_northeast_1d = 'ap-northeast-1d',
  ap_northeast_2_wl1_cjj_wlz_1 = 'ap-northeast-2-wl1-cjj-wlz-1',
  ap_northeast_2a = 'ap-northeast-2a',
  ap_northeast_2b = 'ap-northeast-2b',
  ap_northeast_2c = 'ap-northeast-2c',
  ap_northeast_2d = 'ap-northeast-2d',
  ap_northeast_3a = 'ap-northeast-3a',
  ap_northeast_3b = 'ap-northeast-3b',
  ap_northeast_3c = 'ap-northeast-3c',
  ap_south_1a = 'ap-south-1a',
  ap_south_1b = 'ap-south-1b',
  ap_south_1c = 'ap-south-1c',
  ap_southeast_1a = 'ap-southeast-1a',
  ap_southeast_1b = 'ap-southeast-1b',
  ap_southeast_1c = 'ap-southeast-1c',
  ap_southeast_2a = 'ap-southeast-2a',
  ap_southeast_2b = 'ap-southeast-2b',
  ap_southeast_2c = 'ap-southeast-2c',
  ca_central_1a = 'ca-central-1a',
  ca_central_1b = 'ca-central-1b',
  ca_central_1d = 'ca-central-1d',
  eu_central_1_wl1_ber_wlz_1 = 'eu-central-1-wl1-ber-wlz-1',
  eu_central_1_wl1_dtm_wlz_1 = 'eu-central-1-wl1-dtm-wlz-1',
  eu_central_1_wl1_muc_wlz_1 = 'eu-central-1-wl1-muc-wlz-1',
  eu_central_1a = 'eu-central-1a',
  eu_central_1b = 'eu-central-1b',
  eu_central_1c = 'eu-central-1c',
  eu_north_1a = 'eu-north-1a',
  eu_north_1b = 'eu-north-1b',
  eu_north_1c = 'eu-north-1c',
  eu_west_1a = 'eu-west-1a',
  eu_west_1b = 'eu-west-1b',
  eu_west_1c = 'eu-west-1c',
  eu_west_2_wl1_lon_wlz_1 = 'eu-west-2-wl1-lon-wlz-1',
  eu_west_2a = 'eu-west-2a',
  eu_west_2b = 'eu-west-2b',
  eu_west_2c = 'eu-west-2c',
  eu_west_3a = 'eu-west-3a',
  eu_west_3b = 'eu-west-3b',
  eu_west_3c = 'eu-west-3c',
  sa_east_1a = 'sa-east-1a',
  sa_east_1b = 'sa-east-1b',
  sa_east_1c = 'sa-east-1c',
  us_east_1_atl_1a = 'us-east-1-atl-1a',
  us_east_1_bos_1a = 'us-east-1-bos-1a',
  us_east_1_chi_1a = 'us-east-1-chi-1a',
  us_east_1_dfw_1a = 'us-east-1-dfw-1a',
  us_east_1_iah_1a = 'us-east-1-iah-1a',
  us_east_1_mci_1a = 'us-east-1-mci-1a',
  us_east_1_mia_1a = 'us-east-1-mia-1a',
  us_east_1_msp_1a = 'us-east-1-msp-1a',
  us_east_1_nyc_1a = 'us-east-1-nyc-1a',
  us_east_1_phl_1a = 'us-east-1-phl-1a',
  us_east_1_wl1_atl_wlz_1 = 'us-east-1-wl1-atl-wlz-1',
  us_east_1_wl1_bos_wlz_1 = 'us-east-1-wl1-bos-wlz-1',
  us_east_1_wl1_chi_wlz_1 = 'us-east-1-wl1-chi-wlz-1',
  us_east_1_wl1_clt_wlz_1 = 'us-east-1-wl1-clt-wlz-1',
  us_east_1_wl1_dfw_wlz_1 = 'us-east-1-wl1-dfw-wlz-1',
  us_east_1_wl1_dtw_wlz_1 = 'us-east-1-wl1-dtw-wlz-1',
  us_east_1_wl1_iah_wlz_1 = 'us-east-1-wl1-iah-wlz-1',
  us_east_1_wl1_mia_wlz_1 = 'us-east-1-wl1-mia-wlz-1',
  us_east_1_wl1_msp_wlz_1 = 'us-east-1-wl1-msp-wlz-1',
  us_east_1_wl1_nyc_wlz_1 = 'us-east-1-wl1-nyc-wlz-1',
  us_east_1_wl1_was_wlz_1 = 'us-east-1-wl1-was-wlz-1',
  us_east_1a = 'us-east-1a',
  us_east_1b = 'us-east-1b',
  us_east_1c = 'us-east-1c',
  us_east_1d = 'us-east-1d',
  us_east_1e = 'us-east-1e',
  us_east_1f = 'us-east-1f',
  us_east_2a = 'us-east-2a',
  us_east_2b = 'us-east-2b',
  us_east_2c = 'us-east-2c',
  us_west_1a = 'us-west-1a',
  us_west_1b = 'us-west-1b',
  us_west_1c = 'us-west-1c',
  us_west_2_den_1a = 'us-west-2-den-1a',
  us_west_2_las_1a = 'us-west-2-las-1a',
  us_west_2_lax_1a = 'us-west-2-lax-1a',
  us_west_2_lax_1b = 'us-west-2-lax-1b',
  us_west_2_pdx_1a = 'us-west-2-pdx-1a',
  us_west_2_phx_1a = 'us-west-2-phx-1a',
  us_west_2_sea_1a = 'us-west-2-sea-1a',
  us_west_2_wl1_den_wlz_1 = 'us-west-2-wl1-den-wlz-1',
  us_west_2_wl1_las_wlz_1 = 'us-west-2-wl1-las-wlz-1',
  us_west_2_wl1_lax_wlz_1 = 'us-west-2-wl1-lax-wlz-1',
  us_west_2_wl1_phx_wlz_1 = 'us-west-2-wl1-phx-wlz-1',
  us_west_2_wl1_sea_wlz_1 = 'us-west-2-wl1-sea-wlz-1',
  us_west_2_wl1_sfo_wlz_1 = 'us-west-2-wl1-sfo-wlz-1',
  us_west_2a = 'us-west-2a',
  us_west_2b = 'us-west-2b',
  us_west_2c = 'us-west-2c',
  us_west_2d = 'us-west-2d',
}

@Entity()
export class Subnet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: 'enum',
    enum: AvailabilityZone,
  })
  availabilityZone: AvailabilityZone;

  @Column({
    nullable: true,
    type: 'enum',
    enum: SubnetState,
  })
  state?: SubnetState;

  @ManyToOne(() => Vpc, { nullable: false, cascade: true,  eager: true, })
  @JoinColumn({
    name: 'vpc_id',
  })
  vpc: Vpc;

  @Column({
    nullable: true,
    type: 'int',
  })
  availableIpAddressCount?: number;

  @Column({
    nullable: true,
  })
  cidrBlock?: string;

  @Column({
    nullable: true,
  })
  @cloudId
  subnetId?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  subnetArn?: string;
}

