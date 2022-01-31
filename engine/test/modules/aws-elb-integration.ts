import { ProtocolEnum, TargetTypeEnum } from '../../src/modules/aws_elb/entity';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(240000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const prefix = getPrefix();
const dbAlias = 'elbtest';
const tgName = `${prefix}${dbAlias}tg`;
const tgType = TargetTypeEnum.IP;
const port = 5678;
const protocol = ProtocolEnum.TCP;
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

describe('ELB Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the elb module', (done) => void iasql.install(
    ['aws_elb'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('adds a new targetGroup', query(`
    INSERT INTO aws_target_group (target_group_name, target_type, protocol, port, vpc_id, health_check_path)
    SELECT '${tgName}', '${tgType}', '${protocol}', ${port}, id, '/'
    FROM aws_vpc
    WHERE vpc_id = 'default'
    order by id desc
    limit 1;
  `));

  it('applies the change', apply);

  it('tries to update a target group field', query(`
    UPDATE aws_target_group SET health_check_path = '/health' WHERE target_group_name = '${tgName}';
  `));

  it('applies the change', apply);

  it('tries to update a target group field (replace)', query(`
    UPDATE aws_target_group SET port = 5677 WHERE target_group_name = '${tgName}';
  `));

  it('applies the change', apply);

  // TODO: LISTENERS AND LOAD LANACER TESTS USING THE CREATED TARGET GROUP

  it('deletes the target group', query(`
    DELETE FROM aws_target_group
    WHERE target_group_name = '${tgName}';
  `));

  it('applies the change (last time)', apply);


  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
