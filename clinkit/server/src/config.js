// Central config — everything from env, safe defaults for dev/test (mock mode on unless disabled).

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  nodeEnv: env.NODE_ENV ?? 'development',
  providersMock: env.PROVIDERS_MOCK !== '0', // global force-mock; per-provider auto-live below
  adminToken: env.ADMIN_TOKEN ?? '',
  jwtSecret: env.JWT_SECRET ?? 'dev-only-secret-change-me',
  databaseUrl: env.DATABASE_URL ?? '',
  redisUrl: env.REDIS_URL ?? '',
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),

  kroger: { clientId: env.KROGER_CLIENT_ID ?? '', clientSecret: env.KROGER_CLIENT_SECRET ?? '' },
  walmart: {
    consumerId: env.WALMART_CONSUMER_ID ?? '',
    keyVersion: env.WALMART_KEY_VERSION ?? '1',
    privateKeyPem: env.WALMART_PRIVATE_KEY ?? '',
  },
  instacartApiKey: env.INSTACART_API_KEY ?? '',
  brisklyApiKey: env.BRISKLY_API_KEY ?? '',
  serpapiKey: env.SERPAPI_KEY ?? '',
  googleMapsApiKey: env.GOOGLE_MAPS_API_KEY ?? '',

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    mock: env.STRIPE_MOCK !== '0',
  },
  avalara: {
    accountId: env.AVALARA_ACCOUNT_ID ?? '',
    licenseKey: env.AVALARA_LICENSE_KEY ?? '',
    companyCode: env.AVALARA_COMPANY_CODE ?? 'CLINKIT',
    mock: env.AVALARA_MOCK !== '0',
  },
};

// Per-provider auto-live: a provider goes live the moment its key lands in the environment
// (and PROVIDERS_MOCK isn't forcing global mock). Paste key → restart/redeploy → live.
export function providerLive(name) {
  if (env.PROVIDERS_MOCK === '1') return false; // explicit force-mock (staging safety)
  switch (name) {
    case 'kroger': return Boolean(config.kroger.clientId && config.kroger.clientSecret);
    case 'walmart': return Boolean(config.walmart.consumerId && config.walmart.privateKeyPem);
    case 'instacart': return Boolean(config.instacartApiKey);
    case 'briskly': return Boolean(config.brisklyApiKey && config.databaseUrl);
    case 'google_shopping': return Boolean(config.serpapiKey);
    case 'stripe': return !config.stripe.mock && Boolean(config.stripe.secretKey);
    case 'avalara': return !config.avalara.mock && Boolean(config.avalara.accountId);
    default: return false;
  }
}

if (config.nodeEnv === 'production') {
  const missing = [];
  if (config.jwtSecret.includes('dev-only')) missing.push('JWT_SECRET');
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (missing.length) throw new Error(`Refusing to start in production without: ${missing.join(', ')}`);
}
