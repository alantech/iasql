import { AwsSdkInvoker, ModuleBase } from '../interfaces';

export class AwsSdkModule extends ModuleBase {
  invokeAcm: AwsSdkInvoker;
  invokeApiGateway: AwsSdkInvoker;
  invokeAppSync: AwsSdkInvoker;
  invokeCloudfront: AwsSdkInvoker;
  invokeCloudwatchLogs: AwsSdkInvoker;
  invokeCloudwatch: AwsSdkInvoker;
  invokeCodebuild: AwsSdkInvoker;
  invokeCodedeploy: AwsSdkInvoker;
  invokeCodepipeline: AwsSdkInvoker;
  invokeDynamo: AwsSdkInvoker;
  invokeEc2: AwsSdkInvoker;
  invokeSsm: AwsSdkInvoker;
  invokeEcr: AwsSdkInvoker;
  invokeEcrPublic: AwsSdkInvoker;
  invokeEcs: AwsSdkInvoker;
  invokeElasticache: AwsSdkInvoker;
  invokeElb: AwsSdkInvoker;
  invokeIam: AwsSdkInvoker;
  invokeLambda: AwsSdkInvoker;
  invokeMemoryDb: AwsSdkInvoker;
  invokeRds: AwsSdkInvoker;
  invokeRoute53: AwsSdkInvoker;
  invokeS3: AwsSdkInvoker;
  invokeSecretManager: AwsSdkInvoker;
  invokeSns: AwsSdkInvoker;
  invokeSts: AwsSdkInvoker;
  invokeSqs: AwsSdkInvoker;
  invokeCloudformation: AwsSdkInvoker;

  constructor() {
    super();
    this.invokeAcm = new AwsSdkInvoker('acmClient', this);
    this.invokeApiGateway = new AwsSdkInvoker('apiGatewayClient', this);
    this.invokeAppSync = new AwsSdkInvoker('appSyncClient', this);
    this.invokeCloudfront = new AwsSdkInvoker('cloudfrontClient', this);
    this.invokeCloudwatchLogs = new AwsSdkInvoker('cwClient', this);
    this.invokeCloudwatch = new AwsSdkInvoker('cloudwatchClient', this);
    this.invokeCodebuild = new AwsSdkInvoker('cbClient', this);
    this.invokeCodedeploy = new AwsSdkInvoker('cdClient', this);
    this.invokeCodepipeline = new AwsSdkInvoker('cpClient', this);
    this.invokeDynamo = new AwsSdkInvoker('dynamoClient', this);
    this.invokeEc2 = new AwsSdkInvoker('ec2client', this);
    this.invokeSsm = new AwsSdkInvoker('ssmClient', this);
    this.invokeEcr = new AwsSdkInvoker('ecrClient', this);
    this.invokeEcrPublic = new AwsSdkInvoker('ecrPubClient', this);
    this.invokeEcs = new AwsSdkInvoker('ecsClient', this);
    this.invokeElasticache = new AwsSdkInvoker('elasticacheClient', this);
    this.invokeElb = new AwsSdkInvoker('elbClient', this);
    this.invokeIam = new AwsSdkInvoker('iamClient', this);
    this.invokeLambda = new AwsSdkInvoker('acmClient', this);
    this.invokeMemoryDb = new AwsSdkInvoker('memoryDBClient', this);
    this.invokeRds = new AwsSdkInvoker('rdsClient', this);
    this.invokeRoute53 = new AwsSdkInvoker('route53Client', this);
    this.invokeS3 = new AwsSdkInvoker('s3Client', this);
    this.invokeSecretManager = new AwsSdkInvoker('secretsClient', this);
    this.invokeSns = new AwsSdkInvoker('snsClient', this);
    this.invokeSts = new AwsSdkInvoker('stsClient', this);
    this.invokeSqs = new AwsSdkInvoker('sqsClient', this);
    this.invokeCloudformation = new AwsSdkInvoker('cfClient', this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-sdk-integration.ts#AWS Integration Testing#Manage SDK
 * ```
 */
export const awsSdkModule = new AwsSdkModule();
