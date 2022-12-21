export interface ConfigInterface {
  // Configuration for the http server itself
  http: {
    host: string;
    port: number;
  };
  // Configuration for the postgres database
  db: {
    host: string;
    user: string; // For the server's own user
    password: string; // For the server's own user
    port: number;
    forceSSL: boolean;
    multiUser: boolean; // Specifies if it is running in a multi-user environment (where collisions on DB name and etc can occur)
  };
  // Configuration for server logging
  logger: {
    debug: boolean; // Whether or not debug logging is enabled (does `logger.debug` do anything)
    test: boolean; // Whether or not a special test logger is enabled (bypass weirdness with Jest)
    forceLocal: boolean; // Whether or not to always log to stdout regardless of LogDNA usage
    logDnaKey?: string; // Indicates that logdna should be used if present
  };
  // Configuration for amplitude telemetry
  telemetry?: {
    // Not including this sub-object implies it is not enabled
    posthogKey: string;
  };
  // Configuration for sentry error reporting
  sentry?: {
    // Not including this sub-object implies it is not enabled
    dsn: string;
    environment: string;
    release?: string; // Make it nullable so we can attach it later
  };
}

export const throwError = (message: string): never => {
  throw new Error(message);
};
