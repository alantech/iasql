import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import {
  getPrefix,
  runInstall,
  runUninstall,
  runQuery,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers'

const {
  CpuMemCombination,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_ecs_fargate/entity`);

const prefix = getPrefix();
const dbAlias = 'ecssmptest';
const region = process.env.AWS_REGION || 'barf';
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ecs_simplified'];

// Test constants
const appName = `${prefix}${dbAlias}`;
const appPort = 4142;
const desiredCount = 1;
const cpuMem = CpuMemCombination['vCPU1-2GB'];
const updateCpuMem = CpuMemCombination['vCPU1-3GB'];
const imageTag = 'latest';
const updateImageTag = '0.1';
const publicIp = false;
const ecrRepositoryUri = `iasql-ecs-${appName}-ecr`;

// TODO: Improve timings for this test
jest.setTimeout(1800000);  // 30min timeout
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('ECS Simplified Integration Testing', () => {
  it('creates a new test db ECS', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${region}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the ecs module and its dependencies', install(modules));

  it('adds a new row', query(`
    INSERT INTO ecs_simplified (app_name, desired_count, app_port, cpu_mem, image_tag, public_ip)
    VALUES ('${appName}', ${desiredCount}, ${appPort}, '${cpuMem}', '${imageTag}', ${publicIp});
  `));

  it('undo changes', sync());

  it('check row insertion', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new row', query(`
    INSERT INTO ecs_simplified (app_name, desired_count, app_port, cpu_mem, image_tag, public_ip)
    VALUES ('${appName}', ${desiredCount}, ${appPort}, '${cpuMem}', '${imageTag}', false);
  `));

  it('applies adds a new row', apply());

  it('check row insertion', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls the ECS module', uninstall(modules));

  it('installs the ECS module', install(modules));

  it('check row was imported after uninstall/install', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => {
    expect(res[0]['repository_uri'].includes(ecrRepositoryUri)).toBeTruthy();
    expect(res[0]['load_balancer_dns']).toBeDefined();
    return expect(res.length).toBe(1);
  }));

  it('updates a row', query(`
    UPDATE ecs_simplified
    SET load_balancer_dns = 'invalid'
    WHERE app_name = '${appName}';
  `));

  it('applies row update and should restore the dns value', apply());

  it('check row was restored', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => {
    expect(res[0]['load_balancer_dns'] === 'invalid').toBeFalsy();
    return expect(res.length).toBe(1);
  }));

  it('updates a row', query(`
    UPDATE ecs_simplified
    SET app_port = ${appPort + 1}
    WHERE app_name = '${appName}';
  `));

  it('applies row update and should replace', apply());

  it('check row was replaced', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => {
    expect(res[0]['repository_uri'].includes(ecrRepositoryUri)).toBeTruthy();
    expect(res[0]['app_port']).toBe(appPort + 1);
    return expect(res.length).toBe(1);
  }));

  it('updates a row', query(`
    UPDATE ecs_simplified
    SET repository_uri = NULL
    WHERE app_name = '${appName}';
  `));

  it('applies row update and should restore using the right repository uri', apply());

  it('check that the repository_uri has been restored with the same repository', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => {
    expect(res[0]['repository_uri'].includes(ecrRepositoryUri)).toBeTruthy();
    return expect(res.length).toBe(1);
  }));

  it('updates a row', query(`
    UPDATE ecs_simplified
    SET cpu_mem = '${updateCpuMem}', image_tag = '${updateImageTag}'
    WHERE app_name = '${appName}';
  `));

  it('applies row update and should update service', apply());

  it('check row was updated', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => {
    expect(res[0]['cpu_mem']).toBe(updateCpuMem);
    expect(res[0]['image_tag']).toBe(updateImageTag);
    return expect(res.length).toBe(1);
  }));

  it('deletes the app', query(`
    delete from ecs_simplified
    where app_name = '${appName}';
  `));

  it('applies deletes the app', apply());

  it('check there are no more rows', query(`
    SELECT *
    FROM ecs_simplified
    WHERE app_name = '${appName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('ECS Simplified install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the ECS module', install(modules));

  it('uninstalls the ECS module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the ECS module', uninstall(modules));

  it('installs the ECS module', install(modules));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});