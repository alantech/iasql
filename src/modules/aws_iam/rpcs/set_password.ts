import {
  EntityTemporarilyUnmodifiableException,
  IAM,
  LoginProfile,
  NoSuchEntityException,
} from '@aws-sdk/client-iam';

import { AwsIamModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

/**
 * Method for requesting a new password for an IAM user
 *
 * Accepts the following parameters:
 *
 * - username: the name of the IAM user to manage
 * - password: the new password to set for the user. If password is set to blank it will delete the current password
 * - reset_password: a value of 'true' will require the user to update the password in the next login
 *
 * Returns following columns:
 *
 * - status: OK if the password was updated successfully
 * - message: Error message in case of failure
 *
 *
 * @see https://docs.aws.amazon.com/cli/latest/reference/iam/create-login-profile.html
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html
 *
 */
export class SetUserPasswordRequestRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsIamModule;

  /**
   * @internal
   */
  inputTable: RpcInput = {
    userName: 'varchar',
    password: 'varchar',
    resetPassword: { argType: 'varchar', default: false },
  };

  /**
   * @internal
   */
  outputTable = {
    status: 'varchar',
    message: 'varchar',
  } as const;

  /**
   * @internal
   */
  getUserLoginProfile = crudBuilderFormat<IAM, 'getLoginProfile', LoginProfile | undefined>(
    'getLoginProfile',
    UserName => ({ UserName }),
    res => res?.LoginProfile,
  );

  /**
   * @internal
   */
  createLoginProfile = crudBuilder2<IAM, 'createLoginProfile'>('createLoginProfile', input => input);

  /**
   * @internal
   */
  updateLoginProfile = crudBuilder2<IAM, 'updateLoginProfile'>('updateLoginProfile', input => input);

  /**
   * @internal
   */
  deleteLoginProfile = crudBuilder2<IAM, 'deleteLoginProfile'>('deleteLoginProfile', input => input);

  /**
   * @internal
   */
  private makeError(message: string) {
    return [
      {
        status: 'KO',
        message,
      },
    ];
  }

  /**
   * @internal
   */
  private makeSuccess() {
    return [{ status: 'OK', message: '' }];
  }

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    userName: string,
    password: string,
    resetPassword: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient()) as AWS;

    if (!userName) return this.makeError('User name is required');

    // check if we user has already a profile, to create/update
    try {
      const profile = await this.getUserLoginProfile(client.iamClient, userName);

      if (!password) {
        // delete password
        await this.deleteLoginProfile(client.iamClient, { UserName: userName });
        return this.makeSuccess();
      } else {
        let i = 0;
        do {
          try {
            await this.updateLoginProfile(client.iamClient, {
              UserName: userName,
              Password: password,
              PasswordResetRequired: resetPassword === 'true',
            });
            break;
          } catch (e) {
            if (e instanceof EntityTemporarilyUnmodifiableException) {
              // check if we need to wait
              await new Promise(r => setTimeout(r, 10000)); // Sleep for 10s
              i++;
            } else break;
          }
        } while (i < 30);
      }
      // it's ok
      return this.makeSuccess();
    } catch (e) {
      // if password is not set and user does not exist, do nothing
      if (!password) return this.makeSuccess();

      // we need to create a new profile
      if (e instanceof NoSuchEntityException) {
        const result = await this.createLoginProfile(client.iamClient, {
          UserName: userName,
          Password: password,
          PasswordResetRequired: resetPassword === 'true',
        });
        if (result && result.LoginProfile) return [{ status: 'OK', message: '' }];
        else return this.makeError('Error generating password for the user');
      } else return this.makeError('Error getting user profile');
    }
  };

  constructor(module: AwsIamModule) {
    super();
    this.module = module;
    super.init();
  }
}
