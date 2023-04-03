import Modem from 'docker-modem';
import Docker, { ContainerInspectInfo, DockerOptions } from 'dockerode';
import { isEqual } from 'lodash';
import SSH2Promise from 'ssh2-promise';

import { Context, Crud, MapperBase } from '../../interfaces';
import { sshAccounts } from '../../ssh_accounts';
import { SshCredentials } from '../../ssh_accounts/entity';
import { DockerContainer, DockerContainerStates } from '../entity';
import { SshDocker } from '../index';

export class DockerContainerMapper extends MapperBase<DockerContainer> {
  module: SshDocker;
  entity = DockerContainer;
  equals = (a: DockerContainer, b: DockerContainer) => {
    return (
      Object.is(a.name, b.name) &&
      Object.is(a.image, b.image) &&
      isEqual(a.env, b.env) &&
      isEqual(a.command, b.command) &&
      isEqual(a.entrypoint, b.entrypoint) &&
      Object.is(a.created?.getTime(), b.created?.getTime()) &&
      isEqual(a.ports, b.ports) &&
      isEqual(a.labels, b.labels) &&
      Object.is(a.state, b.state) &&
      isEqual(a.volumes, b.volumes) &&
      isEqual(a.mounts, b.mounts) &&
      isEqual(a.binds, b.binds)
    );
  };

  private containerMapper(serverName: string, container: ContainerInspectInfo): DockerContainer {
    const out: DockerContainer = new DockerContainer();
    out.serverName = serverName;
    out.containerId = container.Id;
    out.name = container.Name.startsWith('/') ? container.Name.slice(1) : container.Name;
    out.image = container.Config.Image;
    out.env = container.Config.Env;
    out.command = container.Config.Cmd;
    if (container.Config.Entrypoint) {
      if (!Array.isArray(container.Config.Entrypoint)) out.entrypoint = [container.Config.Entrypoint];
      else out.entrypoint = container.Config.Entrypoint;
    }
    out.created = new Date(container.Created);
    out.ports = container.HostConfig.PortBindings ?? undefined;
    out.labels = container.Config.Labels;
    out.state = container.State.Status;
    out.volumes = Object.keys(container.Config.Volumes ?? {}).sort() ?? undefined;
    out.mounts = container.HostConfig.Mounts ?? undefined;
    out.binds = container.HostConfig.Binds ?? undefined;
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
    } catch (_) {
      return undefined;
    }
    return docker;
  }

  cloud = new Crud({
    create: async (es: DockerContainer[], ctx: Context) => {
      const out: DockerContainer[] = [];
      for (const e of es) {
        const docker = await this.getDockerForServer(ctx, e.serverName);
        if (!docker) continue;

        const exposedPorts: { [port: string]: {} } = {};
        if (e.ports) {
          Object.keys(e.ports).map((p: string) => (exposedPorts[p] = {}));
        }

        await docker.pull(e.image);
        const rawContainer = await docker.createContainer({
          name: e.name,
          Env: e.env,
          Cmd: e.command,
          Entrypoint: e.entrypoint,
          Image: e.image,
          Labels: e.labels,
          Volumes: this.arrayToObject(e.volumes),
          ExposedPorts: exposedPorts,
          HostConfig: {
            Mounts: e.mounts,
            Binds: e.binds,
            PortBindings: e.ports,
          },
        });
        const container = this.containerMapper(e.serverName, await rawContainer.inspect());
        // write back values from docker engine
        container.id = e.id;
        container.state = e.state; // maintain the state
        await this.db.update(container, ctx);
        out.push(container);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (!!id) {
        const { serverName, containerId } = this.idFields(id);
        const docker = await this.getDockerForServer(ctx, serverName);
        if (!docker) return;

        const rawContainer = (await docker.listContainers()).find(c => c.Id === containerId);
        if (!rawContainer) return undefined;
        const containerInspect = await docker.getContainer(rawContainer.Id).inspect();
        return this.containerMapper(serverName, containerInspect);
      } else {
        const out: DockerContainer[] = [];
        const sshCredentials: SshCredentials[] = await sshAccounts.sshCredentials.cloud.read(ctx);
        const serverNames = sshCredentials.map(c => c.name);
        for (const serverName of serverNames) {
          const docker = await this.getDockerForServer(ctx, serverName);
          if (!docker) continue;

          const containers = await docker.listContainers({ all: true });
          for (const rawContainer of containers) {
            const containerInspect = await docker.getContainer(rawContainer.Id).inspect();
            const container = this.containerMapper(serverName, containerInspect);
            out.push(container);
          }
        }
        return out;
      }
    },
    updateOrReplace: (prev: DockerContainer, next: DockerContainer) => {
      const replaceFields: (keyof DockerContainer)[] = [
        'name',
        'image',
        'env',
        'command',
        'entrypoint',
        'ports',
        'labels',
        'volumes',
        'mounts',
        'binds',
      ];
      for (const key of replaceFields) {
        if (!isEqual(prev[key], next[key])) return 'replace';
      }
      // state or created changed
      return 'update';
    },
    update: async (es: DockerContainer[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord: DockerContainer = ctx?.memo?.cloud?.DockerContainer?.[this.entityId(e)];
        if (this.cloud.updateOrReplace(cloudRecord, e) === 'replace') {
          await this.cloud.delete(e, ctx);
          await this.cloud.create(e, ctx);
          continue;
        }

        if (cloudRecord.state === e.state) {
          // simply write back the fields from cloud
          cloudRecord.id = e.id;
          await this.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
          continue;
        }

        // state has changed - push the state towards the desired value
        const docker = await this.getDockerForServer(ctx, e.serverName);
        const container = await docker!.getContainer(e.containerId!);
        switch (e.state) {
          case DockerContainerStates.running:
            if (cloudRecord.state === DockerContainerStates.paused) await container.unpause();
            else await container.start();
            break;
          case DockerContainerStates.exited:
            await container.stop();
            break;
          case DockerContainerStates.paused:
            await container.pause();
            break;
          case DockerContainerStates.created:
          case DockerContainerStates.restarting:
          case DockerContainerStates.dead:
          case DockerContainerStates.removing:
            // it's not possible to push the states towards these values, write back the state from cloud
            e.state = cloudRecord.state;
            await this.db.update(e, ctx);
            break;
        }
        out.push(e);
      }
      return out;
    },
    delete: async (es: DockerContainer[], ctx: Context) => {
      for (const e of es) {
        const docker = await this.getDockerForServer(ctx, e.serverName);
        const container = await docker!.getContainer(e.containerId!);
        try {
          await container.stop();
        } catch (e: any) {
          // statusCode 304 means the container is already stopped
          if (e.statusCode !== 304) throw e;
        }
        await container.remove();
      }
    },
  });

  constructor(module: SshDocker) {
    super();
    this.module = module;
    super.init();
  }

  private arrayToObject(array: string[] | undefined) {
    const out: { [key: string]: {} } = {};
    array?.map(k => (out[k] = {}));
    return out;
  }
}
