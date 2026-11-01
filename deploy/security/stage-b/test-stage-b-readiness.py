"""Synthetic offline policy tests only; no database or credentials."""
import importlib.util
from pathlib import Path
import unittest

p=Path(__file__).with_name('stage-b-readiness.py')
spec=importlib.util.spec_from_file_location('stageb',p)
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)

class Tests(unittest.TestCase):
    def ready(self):
        return dict(resource=b.RESOURCE,release=b.RELEASE,role=b.ROLE,database='astro_soul_path',gateFlags=dict(b.GATES),preparedSecurityReleaseSha='1'*40,
                    **{k:True for k in b.REQUIRED_TRUE},**{k:False for k in b.REQUIRED_FALSE})
    def test_reviewed_synthetic_plan(self):self.assertEqual(b.validate(self.ready()),[])
    def test_every_missing_approval_fails_closed(self):
        for field in b.REQUIRED_TRUE:
            e=self.ready();e.pop(field)
            with self.subTest(field=field):self.assertIn(field,b.validate(e))
    def test_each_unsafe_activation_rejected(self):
        for field in b.REQUIRED_FALSE:
            e=self.ready();e[field]=True
            with self.subTest(field=field):self.assertIn(field,b.validate(e))
    def test_unknown_values_not_truthy(self):
        for value in (None,'true',1,'UNKNOWN'):
            e=self.ready();e['suspensionFreshlyConfirmed']=value
            self.assertIn('suspensionFreshlyConfirmed',b.validate(e))
    def test_wrong_target_rejected(self):
        for field in ('resource','database','release','role'):
            e=self.ready();e[field]='wrong'
            self.assertIn(field,b.validate(e))
    def test_owner_credential_cannot_pass(self):
        e=self.ready();e['migrationOwnerExcludedFromRuntime']=False;e['ownerFallbackEnabled']=True
        self.assertIn('migrationOwnerExcludedFromRuntime',b.validate(e))
        self.assertIn('ownerFallbackEnabled',b.validate(e))
    def test_error_does_not_repeat_input(self):
        e=self.ready();e['resource']='SYNTHETIC_PRIVATE_VALUE'
        self.assertNotIn('SYNTHETIC_PRIVATE_VALUE',str(b.validate(e)))
    def test_no_resume_in_stage_b(self):
        e=self.ready();e['resumeRequested']=True
        self.assertIn('resumeRequested',b.validate(e))
    def test_old_or_missing_safety_release_rejected(self):
        for value in (None,b.RELEASE,'not-a-commit'):
            e=self.ready();e['preparedSecurityReleaseSha']=value
            self.assertIn('preparedSecurityReleaseSha',b.validate(e))
    def test_each_unsafe_or_unknown_feature_flag_rejected(self):
        for name,value in b.GATES.items():
            for replacement in (None,not value,str(value).lower()):
                e=self.ready();e['gateFlags'][name]=replacement
                with self.subTest(flag=name):self.assertIn(name,b.validate(e))
    def test_no_network_or_process_primitives(self):
        import ast
        tree=ast.parse(p.read_text())
        names=[n.names[0].name for n in ast.walk(tree) if isinstance(n,ast.Import)]
        self.assertNotIn('subprocess',names);self.assertNotIn('socket',names)
    def test_readonly_sql_has_no_activation_statements(self):
        sql=p.with_name('runtime-connection-readonly.sql').read_text()
        self.assertIn('BEGIN READ ONLY;',sql)
        self.assertIn('session_user',sql)
        for token in ('ALTER ROLE','GRANT ','REVOKE ','INSERT INTO','CREATE ROLE'):
            self.assertNotIn(token,sql)

if __name__=='__main__':unittest.main()
