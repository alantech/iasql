import {
  CloudControlClient,
  CreateResourceCommand,
  DeleteResourceCommand,
  GetResourceCommand,
  waitUntilResourceRequestSuccess,
} from '@aws-sdk/client-cloudcontrol'
import { WaiterConfiguration } from '@aws-sdk/util-waiter'

type AWSCreds = {
  accessKeyId: string,
  secretAccessKey: string
}

type AWSConfig = {
  credentials: AWSCreds,
  region: string
}

export class AWSCloudControl {
  private client: CloudControlClient
  private credentials: AWSCreds
  private waiterConfig: WaiterConfiguration<CloudControlClient>,
  public region: string

  constructor(config: AWSConfig) {
    this.credentials = config.credentials;
    this.region = config.region;
    this.client = new CloudControlClient(config);
    this.waiterConfig = {client: this.client} as WaiterConfiguration<CloudControlClient>;
  }

  async createResource(TypeName: string, DesiredState: string) {
    const command = new CreateResourceCommand({
      DesiredState,
      TypeName,
    });
    const response = await this.client.send(command);
    await waitUntilResourceRequestSuccess(
      this.waiterConfig,
      {RequestToken: response.ProgressEvent?.RequestToken,}
    )
  };

  async getResource(TypeName: string, Identifier: string) {
    const command = new GetResourceCommand({
      TypeName,
      Identifier,
    });
    const response = await this.client.send(command);
    return JSON.parse(response.ResourceDescription?.Properties ?? '');
  };

  async deleteResource(TypeName: string, Identifier: string) {
    const command = new DeleteResourceCommand({
      TypeName,
      Identifier,
    });
    const response = await this.client.send(command);
    await waitUntilResourceRequestSuccess(
      this.waiterConfig,
      {RequestToken: response.ProgressEvent?.RequestToken,}
    )
  };
}
