export class Instance {
  awsId: string;
  pgId: string;
  publicIpAddr: string;
  privateIpAddr: string;
  instanceType: string;
  region: string;

  constructor(
    awsId: string,
    pgId: string,
    publicIpAddr: string,
    privateIpAddr: string,
    instanceType: string,
    region: string,
  ) {
    this.awsId = awsId;
    this.pgId = pgId;
    this.publicIpAddr = publicIpAddr;
    this.privateIpAddr = privateIpAddr;
    this.instanceType = instanceType;
    this.region = region;
  }
}