// GHSA-jqcg-44mw-7w3h: an IPv6 trust subnet must not trust arbitrary IPv4 peers.
// Pure address parsing only; no HTTP server, application bootstrap or network.
import { createRequire } from 'node:module';

// Resolve the actual Nest -> Express dependency, never an ancestor's hoisted copy.
const platformRequire = createRequire(require.resolve('@nestjs/platform-express/package.json'));
const expressRequire = createRequire(platformRequire.resolve('express/package.json'));
const proxyAddress = expressRequire('proxy-addr') as {
  compile(value: string): (address: string, index: number) => boolean;
};

describe('proxy trust security boundary', () => {
  it('rejects an unrelated IPv4 peer for a short mapped IPv6 prefix', () => {
    expect(proxyAddress.compile('::ffff:10.0.0.0/8')('203.0.113.9', 0)).toBe(false);
  });
  it('preserves correct private IPv4 trust without trusting public peers', () => {
    const trust = proxyAddress.compile('10.0.0.0/8');
    expect(trust('10.2.3.4', 0)).toBe(true);
    expect(trust('203.0.113.9', 0)).toBe(false);
  });
});
