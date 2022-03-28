const https = require('https')

const ACCESS_KEY_ID = process.env.access_key_id
const SECRET_ACCESS_KEY = process.env.secret_access_key
const AWS_REGION = process.env.aws_region
const DB_ALIAS = process.env.db_alias
const A0_TOKEN = process.env.a0_token
const API_URL = process.env.api_url

function postNewDb(body) {
  const options = {
    hostname: API_URL,
    path: '/v1/db/new/',
    method: 'POST',
    port: 443,
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${A0_TOKEN}`},
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let rawData = ''

      res.on('data', (chunk) => {
        rawData += chunk
      })

      res.on('end', () => {
        try {
          console.log('raw', rawData)
          resolve(JSON.parse(rawData))
        } catch (err) {
          console.log('err', err)
          reject(new Error(err))
        }
      })
    })

    req.on('error', (err) => {
      console.log('err', err)
      reject(new Error(err))
    })

    req.write(JSON.stringify(body))
    req.end()
  })
}

exports.handler = async function (event) {
  console.log('Lambda received event:')
  console.log(event)
  try {
    const result = await postNewDb({
      dbAlias: DB_ALIAS,
      awsRegion: AWS_REGION,
      awsAccessKeyId: ACCESS_KEY_ID,
      awsSecretAccessKey: SECRET_ACCESS_KEY,
      isReady: false,
    })
    return JSON.stringify(result)
  } catch (error) {
    throw error;
  }
}
