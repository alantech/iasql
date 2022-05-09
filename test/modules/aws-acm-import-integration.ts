import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, runSync, runInstall, runUninstall } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'acmimporttest';
// const domainName = `${prefix}${dbAlias}.com`;
const domainName = `iasql.com`;
const cert = `-----BEGIN CERTIFICATE-----
MIIDYjCCAkoCCQDdBciWdeLGDTANBgkqhkiG9w0BAQsFADBzMQswCQYDVQQGEwJl
czEPMA0GA1UECAwGbWFkcmlkMQ8wDQYDVQQHDAZtYWRyaWQxDjAMBgNVBAoMBWlh
c3FsMRIwEAYDVQQDDAlpYXNxbC5jb20xHjAcBgkqhkiG9w0BCQEWD2hlbGxvQGlh
c3FsLmNvbTAeFw0yMjA1MDUxMDQ3MzZaFw0zMjA1MDIxMDQ3MzZaMHMxCzAJBgNV
BAYTAmVzMQ8wDQYDVQQIDAZtYWRyaWQxDzANBgNVBAcMBm1hZHJpZDEOMAwGA1UE
CgwFaWFzcWwxEjAQBgNVBAMMCWlhc3FsLmNvbTEeMBwGCSqGSIb3DQEJARYPaGVs
bG9AaWFzcWwuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuHYy
6tOR9qGU+wtOiXEphW2Qcgb9uw9Cy3Cb1GNOiAyoUJBO5/VpKu44i4N4A8BnPg2f
ejYXSGXLi0yzncDEkUQgYcIKRyqW+qceREpcj3mN8IZj++bFmvoaGHIwOvBnHFV/
g8uL+mP9xU+3RkJ54h4wYR8//gn/Nt4znK7cW5d03MO2sRXmBEL7M3iMh4gR4ZOI
SrEWLlCwF+Li6Q6wWrz88Q3sTufAzO8N4w2nCqKiiMzb1xy8C7aXramJUZMxFchP
ikDLaI6jCsrdUv1h0PaIZfBsqWnlLhla8Qs2jyOir9QGjXfpPPUb5JL2uQ78jezQ
gukhOibV/8TJ+5jW/wIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQByH4Rh4+tTz9ap
e5vGJyzTLg+IU8VKq6TFjoJxZqvMWgi62vPjXTpRnE5mYENcSVGE+1hHpEsti49W
wVfl0fcDsIoLU97+EBQbpKPXH0bRtv34Qzm9d4ho1Kh9GvwCxl3zEy6Q7+OFA1//
NOtKbDJpSXRwZnDIkQUE08vNuCaL6+ANCErC/lG8XqGog/78hovymI0Nq7McdMCi
RareaZSxAVynkoRDl9nAMJF4JTsGP9Nqfu94zxt3FTYHzncXD6dUHQyj7nLZQ0iE
4mtkmIX4uA3VQ+w548VWollXDRn4oAPqm7OFGQ7DfbFkbJDI/oPe5fudJuuk6Hty
t5U/q+fe
-----END CERTIFICATE-----
`;
const key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC4djLq05H2oZT7
C06JcSmFbZByBv27D0LLcJvUY06IDKhQkE7n9Wkq7jiLg3gDwGc+DZ96NhdIZcuL
TLOdwMSRRCBhwgpHKpb6px5ESlyPeY3whmP75sWa+hoYcjA68GccVX+Dy4v6Y/3F
T7dGQnniHjBhHz/+Cf823jOcrtxbl3Tcw7axFeYEQvszeIyHiBHhk4hKsRYuULAX
4uLpDrBavPzxDexO58DM7w3jDacKoqKIzNvXHLwLtpetqYlRkzEVyE+KQMtojqMK
yt1S/WHQ9ohl8GypaeUuGVrxCzaPI6Kv1AaNd+k89Rvkkva5DvyN7NCC6SE6JtX/
xMn7mNb/AgMBAAECggEACLYUS4C4WPRii8SJ7fW5J0L4Wlo4K1haKC9mPI6AC+7F
GCDoiQ3O7KcZZoVL6qlwdr6/9E6PpOyhwy9ZIC8VWWLlQJigUaISRT4VMNZuLpxn
9p7yI9hPJrV++/6QhogJ5o2nGvtG3glQ17ufBSNojCQu1rdaF04zjkzKFTEw2OZm
ozup7RpFNrc5F0eF/r6OPEvysiM23BQPOlE3nKLCkUlp6WKTtkVvOszquttqyiG3
70wpVDbvNgdfHXWLpSpQ5cbd3EQyeXxXWsb5IVfAU9zQtB5pA+v2jVAtKiZlWmLE
kIHYZ+7iVpLcsotYxCVScSaen8VO/viGALt8eLMccQKBgQDjw9mPkLJckIuHtVx7
LFvad20fwfkAHLOXKuIB5f5bvFfS01Ia4AyAIIwobcCe9rXHghdM/7eMocdmFhnx
Ya1daYo70zy/bAvd8PEyhSiNl2PB7VciY/+Nu9Wu99xZF2qiDNBVeDmRPmnDyN4v
00/wZZQ95RmxORhIT67+t+wCVwKBgQDPVBztFKCNwRnQa/HHOOIwZWuO0taboLc1
rdsVoVkE9hLY/YR5cBXF0tYSuLNgyNyOLvulzgbbIZgVe7bfwb8ciUYhWgpawaI2
590mGsPmXwfvK/8EbttfXTHZRg+Ove/YlJaZXMRmmMoaCgBvQzSzcvLvjgR5/Uqw
UuidghN3mQKBgQDHI3GQyF5p+CdGnBcjyoD03f4XCi1/H5kVznSUXFasNlxDBGiA
/utvCwYAQxVq5yHAMcnVlK8S0k/YvfIozdIaHjCyZdpzMzCc+BCqrynpwjeCUtUg
SHYjodsOg7+wVXzx+mockGUkzIEEoRdCkWsPMIEQLMLt5JGKh8DlDEHZOQKBgCXB
vK7URdTq6KeTMOnGCzMjFS5iaSDYaOUGr1JGGu8TXSVVLe3roptvJPst1cT3b2sZ
VUzBs2/us0KeUBR5tTMeML5cJmyWvNLg8N5Cm5B1l/1Pdta41YyNbUmTP7wQDQDV
NoPhaAcDJjMNxTx98bgIZAOKSnhoz1RDFQeyK5dpAoGBAMtnkEKBJoaWAYwGZVvp
AQbv+a4LaZjUFYvKfuFv9Xta1G8wVWzjwuwbEhoH6ycP/xVEQhZkW2P6hf7/QIs9
kZpH1fPQYvbD5tqyhJZlrlm0XcvTrCXOPixOsrqDas5mzJO0kYbXN+h0r+CJcRdF
FqBStBttujfZ1fWFM1qcXqy3
-----END PRIVATE KEY-----
`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_acm_list', 'aws_acm_import'];

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('AwsAcmImport Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the acm_import module', install(modules));

  it('adds a new certificate to import', query(`
    INSERT INTO certificate_import (body, private_key)
    VALUES ('${cert}', '${key}');
  `));

  it('sync before apply (should restore)', sync());

  it('check no new certificate to import', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));
    
  it('adds a new certificate to import', query(`
    INSERT INTO certificate_import (body, private_key)
    VALUES ('${cert}', '${key}');
  `));

  it('check adds new certificate to import', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the new certificate import', apply());

  it('check import row delete', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check new certificate added', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls modules', uninstall(modules));

  it('installs modules', install(modules));

  it('check certificate count after uninstall/install', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check certificate import count after uninstall/install', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('AwsAcmImport install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the modules', install(modules));

  it('uninstalls the module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'postgres',
    true).then(...finish(done)));

  it('uninstalls the import module', uninstall(['aws_acm_import']));

  it('installs the module', install(['aws_acm_import']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
