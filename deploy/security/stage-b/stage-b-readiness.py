"""Offline redacted-evidence validator. No environment, network or SQL execution."""
import json
import sys
import re
from pathlib import Path

RESOURCE='dpg-dbicfj8n74is73b23i90-a'
RELEASE='ab20e50393cc5ab2b7575408b100d0de80bf233c'
ROLE='asp_sg_runtime_v1'
GATES=json.loads(Path(__file__).with_name('required-disabled-gates.json').read_text(encoding='utf-8-sig'))
REQUIRED_TRUE=('suspensionFreshlyConfirmed','stageAHashVerified','stageAPostflightPassed',
 'freshOwnerIdentityPassed','backupReceiptReviewed','runtimeGrantsUnchanged',
 'migrationOwnerExcludedFromRuntime','runtimeUrlUsesRestrictedRole','urlsTargetSameSingaporeDatabase',
 'tlsCertificateAndHostnameVerified','internalHostnameOperatorVerified','redisSingaporeIdentityVerified',
 'firebaseProjectVerified','corsHttpsAllowlistVerified','authSessionSecretsPresent',
 'deploymentCommandsReviewedNoMigrations','separateStageBCredentialApproval',
 'separateStageBConfigApproval','passwordHandledPrivately','separateStageBLoginApproval',
 'workerSafetyReleaseVerified','runtimeSchemaExcludesDirectUrl','migrationWorkflowIsolated')
REQUIRED_FALSE=('resumeRequested','deploymentRequested','workerActivationApproved',
 'ownerFallbackEnabled','livePaymentsEnabled','refundsEnabled','payoutsEnabled','realNotificationsEnabled',
 'automaticGenerationEnabled','automaticReconciliationEnabled','bullBoardEnabled','localOtpEnabled')

def validate(e):
    if not isinstance(e,dict):return ['invalid_evidence_shape']
    errors=[]
    for key,value in (('resource',RESOURCE),('release',RELEASE),('role',ROLE),('database','astro_soul_path')):
        if e.get(key)!=value:errors.append(key)
    security_sha=e.get('preparedSecurityReleaseSha')
    if not isinstance(security_sha,str) or not re.fullmatch('[a-f0-9]{40}',security_sha) or security_sha==RELEASE:
        errors.append('preparedSecurityReleaseSha')
    for key in REQUIRED_TRUE:
        if e.get(key) is not True:errors.append(key)
    for key in REQUIRED_FALSE:
        if e.get(key) is not False:errors.append(key)
    flags=e.get('gateFlags')
    for name,value in GATES.items():
        if not isinstance(flags,dict) or flags.get(name) is not value:errors.append(name)
    return errors

def main():
    try:
        data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
        failures=validate(data)
    except Exception:
        print('BLOCKED: invalid redacted evidence input; values suppressed')
        return 1
    # Only fixed field names are printed, never input contents or credentials.
    print('BLOCKED: '+','.join(failures) if failures else 'STAGE_B_PLAN_EVIDENCE_ACCEPTED_NO_EXECUTION')
    return 1 if failures else 0

if __name__=='__main__':raise SystemExit(main())
