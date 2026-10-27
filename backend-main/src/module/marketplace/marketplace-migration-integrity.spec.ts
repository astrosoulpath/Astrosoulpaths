import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

describe('marketplace pinned additive migration package',()=>{
  const root=path.resolve(__dirname,'../../..');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'review/soul-bazaar/stage-2-migration-manifest.json'),'utf8'));
  it.each(manifest.steps)('preserves checksum and identity $identity',step=>{
    const bytes=fs.readFileSync(path.join(root,step.path));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(step.sha256);
    expect(step.path.split('/')[2]).toBe(step.identity);
    expect(bytes.toString('utf8')).not.toMatch(/^\s*(DROP|TRUNCATE|UPDATE|DELETE|INSERT)\b/im);
  });
  it('does not authorize existing database execution or rewrite historical lineage',()=>{
    expect(manifest.status).toBe('REVIEW_ONLY_APPLICATION_EXECUTION_NOT_APPROVED');
    expect(manifest.steps[1].dependsOn).toContain(manifest.steps[0].identity);
  });
});
