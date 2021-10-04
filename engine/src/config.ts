// env variables set locally on .env via `yarn run watch` or thorugh docker compose
export default {
  port: process.env.PORT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
};
