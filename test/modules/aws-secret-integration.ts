import config from "../../src/config";
import * as iasql from "../../src/services/iasql";
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from "../helpers";

const prefix = getPrefix();
const dbAlias = "secrettest";
const secretName = `${prefix}${dbAlias}`;
const secretValue = "value";

const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ["aws_secrets_manager"];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe("Secrets Manager Integration Testing", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', commit());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `));

  it("installs the secret module", install(modules));

  it(
    "adds a new secret",
    query(`  
    INSERT INTO secret (name, value)
    VALUES ('${secretName}', '${secretValue}');
  `)
  );

  it("undo changes", commit());

  it(
    "adds a new secret",
    query(`  
    INSERT INTO secret (name, description, value)
    VALUES ('${secretName}', 'description', '${secretValue}');
  `)
  );

  it("applies the secret change", commit());

  it(
    "check secret is available",
    query(
      `
  SELECT * FROM secret WHERE name='${secretName}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update secret description",
    query(`
  UPDATE secret SET description='new description' WHERE name='${secretName}'
  `)
  );

  it("applies the secret description update", commit());

  it(
    "checks that secret has been been modified",
    query(
      `
  SELECT * FROM secret WHERE description='new description';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update secret value",
    query(`
  UPDATE secret SET value='newvalue' WHERE name='${secretName}'
  `)
  );

  it("applies the secret value update", commit());

  it(
    "tries to update version",
    query(`
  UPDATE secret SET version_id='fakeVersion' WHERE name='${secretName}'
  `)
  );

  it("applies the secret version update", commit());

  it(
    "checks that version has not been modified",
    query(
      `
  SELECT * FROM secret WHERE version_id='fakeVersion';
`,
      (res: any) => expect(res.length).toBe(0)
    )
  );

  it("uninstalls the secret module", uninstall(modules));

  it(
    "installs the secret module again (to make sure it reloads stuff)",
    install(modules)
  );

  it(
    "checks secret count",
    query(
      `
    SELECT * FROM secret WHERE name='${secretName}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it('moves the secret to another region with a new value', query(`
    UPDATE secret SET region='us-east-1', value='new_secret' WHERE name='${secretName}';
  `));

  it("applies the secret region update", commit());

  it('confirms that the secret was moved', query(`
    SELECT * FROM secret WHERE name = '${secretName}';
  `, (res: any[]) => {
    expect(res.length).toBe(1);
    expect(res[0].region).toBe('us-east-1');
  }));

  it('creates the same secret back in the original region at the same time', query(`
    INSERT INTO secret (name, description, value)
    VALUES ('${secretName}', 'description', '${secretValue}');
  `));

  it('applies the secret re-creation', apply());

  it('confirms that the secret was created', query(`
    SELECT * FROM secret WHERE name = '${secretName}';
  `, (res: any[]) => {
    expect(res.length).toBe(2);
  }));

  it(
    "deletes the secrets",
    query(`
    DELETE FROM secret
    WHERE name = '${secretName}';
  `)
  );

  it("applies the secret removal", commit());

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});

describe("Secret install/uninstall", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', commit());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `));

  it("installs the secret module", install(modules));

  it("uninstalls the secret module", uninstall(modules));

  it("installs all modules", (done) =>
    void iasql
      .install([], dbAlias, config.db.user, true)
      .then(...finish(done)));

  it("uninstalls the secret module", uninstall(["aws_secrets_manager"]));

  it("installs the secret module", install(["aws_secrets_manager"]));

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});
