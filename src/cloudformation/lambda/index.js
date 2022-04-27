const {Client} = require('pg')

const ACCESS_KEY_ID = process.env.access_key_id;
const SECRET_ACCESS_KEY = process.env.secret_access_key;
const AWS_REGION = process.env.aws_region;
const CONNECTION_STRING = decodeURI(process.env.connection_string);

exports.handler = async function (event) {
  console.log('Lambda received event:');
  console.log(event);
  try {
    const client = new Client({ CONNECTION_STRING, });
    await client.connect();
    const insertCreds = {
      name: 'insert-creds',
      text: `INSERT INTO aws_account (access_key_id, secret_access_key, region)
             VALUES ('$1', '$2', '$3');`,
      values: [ACCESS_KEY_ID, SECRET_ACCESS_KEY, AWS_REGION],
    };
    await client.query('SELECT * FROM iasql_install(aws_account)');
    await client.query(insertCreds);
    const result = { result: 'Success' };
    return JSON.stringify(result);
  } catch (error) {
    throw error;
  }
}
