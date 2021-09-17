import { 
  EC2Client, 
  DescribeRegionsCommand, 
  DescribeAvailabilityZonesCommand, 
  DescribeInstanceTypesCommand, 
  DescribeImagesCommand,
} from '@aws-sdk/client-ec2'

type AWSCreds = {
  accessKeyId: string,
  secretAccessKey: string
}

type AWSConfig = {
  credentials: AWSCreds,
  region: string
}

export class AWS {
  private ec2client: EC2Client

  constructor(config: AWSConfig) {
    this.ec2client = new EC2Client(config)
  }

  async getInstanceTypes() {
    return await this.ec2client.send(new DescribeInstanceTypesCommand({}))
  }

  async getAMIs() {
    return await this.ec2client.send(new DescribeImagesCommand({}))
  }

  async getRegions() {
    return await this.ec2client.send(new DescribeRegionsCommand({}))
  }

  async getAvailabilityZones() {
    return await this.ec2client.send(new DescribeAvailabilityZonesCommand({}))
  }
}
