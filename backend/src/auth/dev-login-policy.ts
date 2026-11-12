/**
 * Dev-login opt-in.
 *
 * The route issues a real session for whichever user owns the most deals.
 * It is off unless ALLOW_DEV_LOGIN=1, and that opt-in cannot turn it on in a
 * deployed or hosted build. Staging, preview, and Replit-hosted copies set at
 * least one of the signals below; a laptop process does not.
 */

const HOSTED_ENV_KEYS = [
  'REPL_ID',
  'REPLIT_DEV_DOMAIN',
  'REPLIT_DOMAINS',
  'REPLIT_CLUSTER',
  'K_SERVICE',
  'K_REVISION',
  'DYNO',
  'VERCEL',
  'VERCEL_ENV',
  'RENDER',
  'RENDER_SERVICE_ID',
  'FLY_APP_NAME',
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_PUBLIC_DOMAIN',
  'AWS_EXECUTION_ENV',
  'WEBSITE_SITE_NAME',
  'CF_PAGES',
  'GITPOD_WORKSPACE_ID',
  'CODESPACE_NAME',
  'HEROKU_APP_NAME',
] as const;

export function isHostedOrDeployed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  if (env.REPLIT_DEPLOYMENT === '1') return true;
  return HOSTED_ENV_KEYS.some((key) => {
    const value = env[key];
    return typeof value === 'string' && value.length > 0 && value !== '0';
  });
}

/** Explicit opt-in, off by default, impossible on a deployed/hosted build. */
export function isDevLoginAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ALLOW_DEV_LOGIN !== '1') return false;
  if (isHostedOrDeployed(env)) return false;
  return true;
}
