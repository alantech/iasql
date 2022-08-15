import config from "../../src/config";
import * as iasql from "../../src/services/iasql";
import {
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  getPrefix,
} from "../helpers";

const prefix = getPrefix();
const dbAlias = "secrettest";
const secretName = `${prefix}${dbAlias}`;
const secretValue = "value";

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
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

  it(
    "inserts aws credentials",
    query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `)
  );

  it("installs the secret module", install(modules));

  it(
    "adds a new secret",
    query(`  
    INSERT INTO secret (name, value)
    VALUES ('${secretName}', '${secretValue}');
  `)
  );

  it("undo changes", sync());

  it(
    "adds a new secret",
    query(`  
    INSERT INTO secret (name, description, value)
    VALUES ('${secretName}', 'description', '${secretValue}');
  `)
  );

  it("applies the secret change", apply());

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

  it("applies the secret description update", apply());

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

  it("applies the secret value update", apply());

  it(
    "tries to update version",
    query(`
  UPDATE secret SET version_id='fakeVersion' WHERE name='${secretName}'
  `)
  );

  it("applies the secret version update", apply());

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

  it(
    "deletes the secret",
    query(`
    DELETE FROM secret
    WHERE name = '${secretName}';
  `)
  );

  it("applies the secret removal", apply());

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});

describe("Secret install/uninstall", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it(
    "inserts aws credentials",
    query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `)
  );

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
