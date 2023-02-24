import { NextApiResponse } from 'next';

const handler = ({} = {}, res: NextApiResponse) => {
  res.status(200).json({
    iasqlEnv: process.env.IASQL_ENV,
    uid: process.env.IASQL_UID,
    telemetry: process.env.IASQL_TELEMETRY,
  });
};

export default handler;
