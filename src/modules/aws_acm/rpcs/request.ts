import {
  ACM,
  CertificateDetail,
  CertificateStatus,
  DescribeCertificateCommandInput,
  DescribeCertificateCommandOutput,
  paginateListCertificates,
  RequestCertificateCommandInput,
} from '@aws-sdk/client-acm';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsAcmModule } from '..';
import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { safeParse } from '../../../services/common';
import { awsRoute53Module } from '../../aws_route53';
import { HostedZone, ResourceRecordSet, RecordType } from '../../aws_route53/entity';
import { modules } from '../../iasql_functions/iasql';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';
import { Certificate } from '../entity';

enum ValidationMethod {
  DNS = 'DNS',
  EMAIL = 'EMAIL',
}

/**
 * Method for requesting a new AWS certificate for a given domain. The certificate will be automatically validated
 * via DNS method
 *
 * Returns following columns:
 *
 * - arn: The unique ARN for the imported certificate
 *
 * - status: OK if the certificate was imported successfully
 *
 * - message: Error message in case of failure
 *
 * @see https://aws.amazon.com/certificate-manager
 *
 */
export class CertificateRequestRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsAcmModule;
  /**
   * @internal
   */
  outputTable = {
    arn: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;
  /**
   * @internal
   */
  inputTable: RpcInput = {
    domainName: 'varchar',
    validationMethod: 'varchar',
    region: 'varchar',
    options: { argType: 'json', default: '{}' },
    tags: { argType: 'json', default: '{}' },
  };

  /**
   * @internal
   */
  getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');

  async requestCertificate(client: ACM, input: RequestCertificateCommandInput) {
    const res = await client.requestCertificate(input);
    const arn = res.CertificateArn ?? '';
    let certificates: string[] = [];
    let i = 0;
    // Wait for ~1min until imported cert is available
    do {
      await new Promise(r => setTimeout(r, 2000));
      certificates = (await this.getCertificatesSummary(client))?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
    return arn;
  }

  async describeCertificate(client: ACM, input: DescribeCertificateCommandInput) {
    return await client.describeCertificate(input);
  }

  async certificateWaiter(
    client: ACM,
    arn: string,
    handleState: (vol: CertificateDetail | undefined) => { state: WaiterState },
  ) {
    return createWaiter<ACM, DescribeCertificateCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      {
        CertificateArn: arn,
      },
      async (cl, input) => {
        const data: DescribeCertificateCommandOutput = await cl.describeCertificate(input);
        try {
          return handleState(data.Certificate);
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  waitUntilIssued(client: ACM, arn: string) {
    return this.certificateWaiter(client, arn, (cert: CertificateDetail | undefined) => {
      // if not issued, retry
      if (!Object.is(cert?.Status, CertificateStatus.ISSUED)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  async validateCertificate(client: ACM, ctx: Context, arn: string) {
    // first describe the certificate to retrieve the validation domains
    const input: DescribeCertificateCommandInput = {
      CertificateArn: arn,
    };

    // retry until we get the recordset field
    let i = 0;
    let canValidate = false;
    let describedCert: DescribeCertificateCommandOutput;
    do {
      await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
      describedCert = await this.describeCertificate(client, input);
      if (describedCert.Certificate?.DomainValidationOptions) {
        for (const option of describedCert.Certificate.DomainValidationOptions) {
          if (option.DomainName && option.ResourceRecord) {
            // we have the right values
            canValidate = true;
            break;
          }
        }
      }
      i++;
    } while (i < 30 && !canValidate);

    if (canValidate && describedCert.Certificate?.DomainValidationOptions) {
      // we can proceed with validation
      const createdRecordsets: ResourceRecordSet[] = [];
      for (const domainOption of describedCert.Certificate.DomainValidationOptions) {
        if (domainOption.DomainName && domainOption.ValidationDomain) {
          // check for the id of the hosted zone
          let parentZone: HostedZone | undefined;
          const zones: HostedZone[] | undefined = await awsRoute53Module.hostedZone.cloud.read(ctx);
          if (zones) {
            for (const zone of zones) {
              // if domain name ends with . remove it
              let domainToCheck = zone.domainName;
              if (domainToCheck.lastIndexOf('.') === domainToCheck.length - 1)
                domainToCheck = domainToCheck.substring(0, domainToCheck.length - 1);
              const parsedName = awsRoute53Module.hostedZone.getNameFromDomain(
                domainOption.DomainName,
                domainToCheck,
              );
              if (parsedName) {
                parentZone = zone;
                break;
              }
            }
          }
          if (parentZone && domainOption.ResourceRecord?.Name) {
            try {
              // we need to create that in route 53
              const record: ResourceRecordSet = {
                name: domainOption.ResourceRecord?.Name,
                parentHostedZone: parentZone,
                record: domainOption.ResourceRecord.Value,
                ttl: 300,
                recordType: RecordType.CNAME,
              };
              const createdRecord = await awsRoute53Module.resourceRecordSet.cloud.create(record, ctx);
              if (createdRecord) {
                createdRecordsets.push(record);
              }
            } catch (e) {
              throw new Error('Error creating hosted zone, could not validate');
            }
          }
        }
      }

      // if we have created at least one record, we try to check validation
      if (createdRecordsets.length > 0) await this.waitUntilIssued(client, arn);

      // now we need to remove all recordsets created
      await awsRoute53Module.resourceRecordSet.cloud.delete(createdRecordsets, ctx);
    }
  }

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    domainName: string,
    validationMethod: string,
    region: string,
    options: string,
    tags: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (validationMethod === ValidationMethod.DNS) {
      const installedModules = await modules(false, true, dbId);
      if (!installedModules.map(m => m.moduleName).includes('aws_route53')) {
        // TODO: Should the other error path, which is an AWS error instead of a user error, also
        // use the 'throw new Error' pattern?
        throw new Error('DNS validated certificates only possible if "aws_route53 is installed');
      }
    }
    const opts = safeParse(options);
    const client = (await ctx.getAwsClient(region)) as AWS;
    const input: RequestCertificateCommandInput = {
      CertificateAuthorityArn: opts?.arn,
      DomainName: domainName,
      DomainValidationOptions: opts?.domainValidationOptions,
      SubjectAlternativeNames: opts?.subjectAlternativeNames,
      ValidationMethod: validationMethod,
    };
    const requestedCertArn = await this.requestCertificate(client.acmClient, input);
    if (!requestedCertArn) {
      return [
        {
          arn: '',
          status: 'ERROR',
          message: 'Error requesting certificate',
        },
      ];
    }
    const transformedTags = Object.entries(safeParse(tags))?.map(([Key, Value]) => ({ Key, Value })) ?? [];
    if (transformedTags.length) {
      await this.module.certificate.createCertificateTags(
        client.acmClient,
        requestedCertArn,
        transformedTags,
      );
    }
    const requestedCert = await this.module.certificate.cloud.read(ctx, requestedCertArn);
    await this.module.certificate.db.create(requestedCert, ctx);
    const dbCert = await this.module.certificate.db.read(ctx, requestedCertArn);

    // query the details of the certificate, to get the domain validation options
    if (validationMethod === ValidationMethod.DNS) {
      await this.validateCertificate(client.acmClient, ctx, requestedCertArn);
      // check if certificate has been validated
      const certInput: DescribeCertificateCommandInput = {
        CertificateArn: requestedCertArn,
      };
      const describedCert = await this.describeCertificate(client.acmClient, certInput);
      if (!(describedCert.Certificate?.Status === CertificateStatus.ISSUED)) {
        // not validated, need to remove it
        const cloudCert = await this.module.certificate.cloud.read(ctx, requestedCertArn);
        if (cloudCert) {
          await this.module.certificate.cloud.delete(cloudCert, ctx);
          await this.module.certificate.db.delete(cloudCert, ctx);
        }
        return [
          {
            arn: requestedCertArn,
            status: describedCert.Certificate?.Status,
            message: 'Certificate could not be validated',
          },
        ];
      } else {
        // Update the cert in the DB with the latest version
        // Unfortunately need to blow away the cloud cache first
        delete ctx.memo.cloud.Certificate[requestedCertArn];
        const cert = await this.module.certificate.cloud.read(ctx, requestedCertArn);
        if (dbCert instanceof Certificate) cert.id = dbCert.id;
        await this.module.certificate.db.update(cert, ctx);
      }
      return [
        {
          arn: requestedCertArn,
          status: describedCert.Certificate?.Status,
          message: 'Successfully validated the certificate',
        },
      ];
    }
    return [
      {
        arn: '',
        status: 'PENDING',
        message: 'Check your email for next steps to validate the certificate request',
      },
    ];
  };

  constructor(module: AwsAcmModule) {
    super();
    this.module = module;
    super.init();
  }
}
