// Central config — everything from env, safe defaults for dev/test (mock mode on unless disabled).

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  nodeEnv: env.NODE_ENV ?? 'development',
  providersMock: env.PROVIDERS_MOCK !== '0', // default ON; set PROVIDERS_MOCK=0 with real keys
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

if (config.nodeEnv === 'production') {
  const missing = [];
  if (config.jwtSecret.includes('dev-only')) missing.push('JWT_SECRET');
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (missing.length) throw new Error(`Refusing to start in production without: ${missing.join(', ')}`);
}
