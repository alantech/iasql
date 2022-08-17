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
const dbAlias = "apigatewaytest";

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ["aws_api_gateway"];
const apiName = "testApi";

const policyJSON = {
  "Version": "2012-10-17",
  "Statement": [
      {
          "Effect": "Allow",
          "Principal": "*",
          "Action": "execute-api:Invoke",
          "Resource": "arn:aws:execute-api:*:*:*/*"
      }
  ]
}

const policyDocument = JSON.stringify(policyJSON);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe("API Gateway Integration Testing", () => {
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

  it("installs the API gateway module", install(modules));

  it(
    "adds a new API gateway",
    query(`  
    INSERT INTO rest_api (name, description)
    VALUES ('${apiName}', 'description');
  `)
  );

  it("undo changes", sync());

  it(
    "adds a new API gateway",
    query(`  
    INSERT INTO rest_api (name, description, disable_execute_api_endpoint, version)
    VALUES ('${apiName}', 'description', false, '1.0');
  `)
  );

  it("applies the API gateway change", apply());

  it(
    "check API gateway is available",
    query(
      `
  SELECT * FROM rest_api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update API description",
    query(`
  UPDATE rest_api SET description='new description' WHERE name='${apiName}'
  `)
  );

  it("applies the API description update", apply());

  it(
    "checks that API has been been modified",
    query(
      `
  SELECT * FROM rest_api WHERE description='new description' and name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it('updates the API policy', query(`
  UPDATE rest_api SET policy='${policyDocument}' WHERE name = '${apiName}';
  `));
  it('applies the API policy update', apply());

  it('gets current API policy with updated document', query(`
  SELECT * FROM rest_api WHERE name = '${apiName}';
  `, (res: any[]) => expect(res[0].policy).toStrictEqual(JSON.parse(policyDocument))));

  it(
    "tries to update API ID",
    query(`
  UPDATE rest_api SET rest_api_id='fake' WHERE name='${apiName}'
  `)
  );

  it("applies the API ID update", apply());

  it(
    "checks that API ID has not been been modified",
    query(
      `
  SELECT * FROM rest_api WHERE rest_api_id='fake';
`,
      (res: any) => expect(res.length).toBe(0)
    )
  );

  it("uninstalls the API module", uninstall(modules));

  it(
    "installs the API module again (to make sure it reloads stuff)",
    install(modules)
  );

  it(
    "checks API count",
    query(
      `
    SELECT * FROM rest_api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "deletes the API",
    query(`
    DELETE FROM rest_api
    WHERE name = '${apiName}';
  `)
  );

  it("applies the API removal", apply());

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});

describe("API install/uninstall", () => {
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

  it("installs the API module", install(modules));

  it("uninstalls the API module", uninstall(modules));

  it("installs all modules", (done) =>
    void iasql
      .install([], dbAlias, config.db.user, true)
      .then(...finish(done)));

  it("uninstalls the API module", uninstall(["aws_api_gateway"]));

  it("installs the API module", install(["aws_api_gateway"]));

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});