export interface ConfigInterface {
  // stripe
  stripe?: {
    secretKey: string;
    paymentLink: string;
    whitelistedDomains: string[];
  };
  // Configuration for the auth0 access control
  auth?: {
    domain: string;
    audience: string;
  };
  db: {
    host: string;
    user: string; // For the server's own user
    password: string; // For the server's own user
    port: number;
    forceSSL: boolean;
  };
  logDna?: {
    key: string;
  };
}

export const throwError = (message: string): never => {
  throw new Error(message);
};
