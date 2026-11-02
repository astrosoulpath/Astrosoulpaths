"""Static deployment safety checks; no subprocesses, network or database."""
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[3]

class Deployment(unittest.TestCase):
    def test_complete_unique_flag_template(self):
        expected=json.loads((ROOT/'deploy/security/stage-b/required-disabled-gates.json').read_text())
        lines=[s.strip() for s in (ROOT/'deploy/render/staging-gates.env.example').read_text().splitlines() if s.strip() and not s.lstrip().startswith('#')]
        pairs=[s.split('=',1) for s in lines]
        self.assertEqual(len(pairs),len({k for k,v in pairs}))
        actual=dict(pairs)
        self.assertEqual(len(expected),57)
        self.assertEqual(sum(v is False for v in expected.values()),53)
        self.assertEqual(sum(v is True for v in expected.values()),4)
        for k,v in expected.items():self.assertEqual(actual[k],str(v).lower(),k)
    def test_docker_lifecycle_and_generation_boundary(self):
        text=(ROOT/'backend-main/Dockerfile').read_text()
        builder,production=text.split('FROM base AS production')
        self.assertIn('RUN apk add --no-cache openssl ca-certificates',builder)
        self.assertIn('RUN npm ci --ignore-scripts',builder)
        self.assertIn('npx --no-install prisma generate',builder)
        self.assertIn('RUN npm ci --omit=dev --omit=optional --ignore-scripts',production)
        self.assertIn('USER node',production)
        self.assertIn('ENV NODE_ENV=production',production)
        self.assertNotIn('npx ',production)
        self.assertIn('COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma',production)
        for line in text.splitlines():
            if line.startswith(('RUN ','CMD ','ENTRYPOINT ')):
                for denied in ('migrate','db push','seed','admin:bootstrap'):self.assertNotIn(denied,line)
    def test_docker_context_excludes_private_inputs(self):
        rules=(ROOT/'backend-main/.dockerignore').read_text().splitlines()
        for rule in ('.env','.env.*','*.env','review','**/.runtime','**/*.dump','**/*.backup'):self.assertIn(rule,rules)

if __name__=='__main__':unittest.main()
