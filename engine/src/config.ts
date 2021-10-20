// env variables set locally on .env via `yarn run watch` or thorugh docker compose
export default {
  port: process.env.PORT,
  ironPlansTk: process.env.IRONPLANS_TOKEN,
  a0Enabled: process.env.A0_ENABLED === 'true',
  a0Domain: process.env.A0_DOMAIN,
  a0Audience:  process.env.A0_AUDIENCE, // id of this api in auth0
};
