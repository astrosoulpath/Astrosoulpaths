// Pre-build guard only: never prints configuration values or credentials.
const fs = require('node:fs');
function validate(config) {
  const failures = [];
  let api;
  try { api = new URL(config.API_BASE_URL); } catch { failures.push('API_BASE_URL_REQUIRED'); }
  if (api && (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash ||
      /^(localhost|0\.|127\.|10\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?(::1\]?$|f[cd]|fe[89ab]))/i.test(api.hostname) ||
      api.hostname.endsWith('.localhost') || api.hostname.endsWith('.local'))) {
    failures.push('PUBLIC_HTTPS_API_REQUIRED');
  }
  for (const [key, value] of Object.entries(config)) {
    if (/PRIVATE_KEY|SECRET|PASSWORD|ACCESS_TOKEN|REFRESH_TOKEN|SERVICE_ACCOUNT|AUTH_CONTEXT_SESSION_KEY|SUPABASE_SERVICE_ROLE|DATABASE_URL|DIRECT_URL/i.test(key)) failures.push('SERVER_SECRET_FORBIDDEN');
    if (/EMULATOR_HOST|FIREBASE_AUTH_EMULATOR|ALLOW_INSECURE|DIAGNOSTIC/i.test(key) && ![false, '', 'false', null].includes(value)) failures.push('TEST_OVERRIDE_FORBIDDEN');
    if (typeof value === 'string' && /^rzp_test_/.test(value)) failures.push('TEST_PAYMENT_KEY_FORBIDDEN');
  }
  return [...new Set(failures)];
}
const parseConfig = (text) => JSON.parse(text.replace(/^\uFEFF/, ''));
module.exports = { validate, parseConfig };
if (require.main === module) {
  try {
    const failures = validate(parseConfig(fs.readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify({ status: failures.length ? 'BLOCKED' : 'PASS_CONFIG_ONLY', failures,
      providerOrDeploymentVerified: false }));
    if (failures.length) process.exitCode = 1;
  } catch { console.log(JSON.stringify({status:'BLOCKED',failures:['CONFIG_UNREADABLE']})); process.exitCode = 1; }
}
