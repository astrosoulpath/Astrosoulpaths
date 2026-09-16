require("dotenv").config();
const Redis = require("ioredis");

const host = process.env.REDIS_HOST || "127.0.0.1";
const port = Number(process.env.REDIS_PORT || 6379);
const password = process.env.REDIS_PASSWORD || undefined;
const tlsEnabled =
  String(process.env.REDIS_TLS || "").toLowerCase() === "true";

console.log("HOST=" + host);
console.log("PORT=" + port);
console.log("PASSWORD_CONFIGURED=" + Boolean(password));
console.log("TLS=" + tlsEnabled);

const client = new Redis({
  host,
  port,
  password,
  tls: tlsEnabled ? {} : undefined,
  lazyConnect: true,
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  retryStrategy: null,
});

(async () => {
  try {
    await client.connect();
    const result = await client.ping();

    console.log("REDIS_RESULT=" + result);
    console.log("PASS: backend .env Redis authentication works");
  } catch (e) {
    console.log("FAIL: " + (e?.message || String(e)));
  } finally {
    try {
      client.disconnect();
    } catch {}
  }
})();
