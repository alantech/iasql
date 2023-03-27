import Modem from 'docker-modem';
import Docker, { ContainerInfo, DockerOptions } from 'dockerode';
import _ from 'lodash';
import SSH2Promise from 'ssh2-promise';

import { Context, Crud, MapperBase } from '../../interfaces';
import { sshAccounts } from '../../ssh_accounts';
import { SshCredentials } from '../../ssh_accounts/entity';
import { DockerContainer } from '../entity';
import { SshDocker } from '../index';

export class DockerContainerMapper extends MapperBase<DockerContainer> {
  module: SshDocker;
  entity = DockerContainer;
  equals = (a: DockerContainer, b: DockerContainer) => {
    const res =
      Object.is(a.name, b.name) &&
      Object.is(a.command, b.command) &&
      Object.is(a.created.getTime(), b.created.getTime()) &&
      _.isEqual(a.ports, b.ports) &&
      _.isEqual(a.labels, b.labels) &&
      Object.is(a.state, b.state) &&
      Object.is(a.status, b.status) &&
      _.isEqual(a.hostConfig, b.hostConfig) &&
      _.isEqual(a.networkSettings, b.networkSettings) &&
      _.isEqual(a.mounts, b.mounts);
    return res;
  };

  private containerMapper(serverName: string, container: ContainerInfo): DockerContainer {
    const out = new DockerContainer();
    out.serverName = serverName;
    out.containerId = container.Id;
    out.name = container.Names[0];
    out.image = container.Image;
    out.imageId = container.ImageID;
    out.command = container.Command;
    out.created = new Date(container.Created * 1000);
    out.ports = container.Ports;
    out.labels = container.Labels;
    out.state = container.State;
    out.status = container.Status;
    out.hostConfig = container.HostConfig;
    out.networkSettings = container.NetworkSettings;
    out.mounts = container.Mounts;
    return out;
  }

  private async getDockerForServer(ctx: Context, serverName: string): Promise<Docker | undefined> {
    const sshClient: SSH2Promise = await ctx.getSshClient(serverName);
    const sshConfig = sshClient.config[0];
    const modem = new Modem({
      protocol: 'ssh',
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      sshOptions: {
        privateKey: sshConfig.privateKey,
        passphrase: sshConfig.passphrase,
      },
    });
    const docker = new Docker({ modem } as DockerOptions);
    try {
      await docker.ping();
    } catch (e) {
      return undefined;
    }
    return docker;
  }

  cloud = new Crud({
    create: async (es: DockerContainer[], ctx: Context) => {
      // create docker containers through RPC
      await this.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      if (!!id) {
        const { serverName, containerId } = this.idFields(id);
        const docker = await this.getDockerForServer(ctx, serverName);
        if (!docker) return;

        const container = (await docker.listContainers()).find(c => c.Id === containerId);
        if (!container) return undefined;
        return this.containerMapper(serverName, container);
      } else {
        const out: DockerContainer[] = [];
        const sshCredentials: SshCredentials[] = await sshAccounts.sshCredentials.cloud.read(ctx);
        const serverNames = sshCredentials.map(c => c.name);
        for (const serverName of serverNames) {
          const docker = await this.getDockerForServer(ctx, serverName);
          if (!docker) continue;

          const containers = await docker.listContainers({ all: true });
          for (const rawContainer of containers) {
            const container = this.containerMapper(serverName, rawContainer);
            out.push(container);
          }
        }
        return out;
      }
    },
    update: async (es: DockerContainer[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        // restore because you can't change a container
        const cloudRecord: DockerContainer = ctx?.memo?.cloud?.DockerContainer?.[this.entityId(e)];
        cloudRecord.id = e.id;
        await this.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: DockerContainer[], ctx: Context) => {
      for (const e of es) {
        const docker = await this.getDockerForServer(ctx, e.serverName);
        const container = await docker!.getContainer(e.containerId);
        try {
          await container.stop();
        } catch (e: any) {
          // statusCode 304 means the container is already stopped
          if (e.statusCode !== 304) throw e;
        }
        // TODO: maybe we should not remove the container - just stopping would be enough?
        await container.remove();
      }
    },
  });

  constructor(module: SshDocker) {
    super();
    this.module = module;
    super.init();
  }
}
