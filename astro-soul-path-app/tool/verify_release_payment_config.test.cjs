const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,parseConfig}=require('./verify_release_payment_config.cjs');
test('Windows UTF8 BOM definitions remain readable without emitting values',()=>{
  assert.deepEqual(parseConfig('\uFEFF{"API_BASE_URL":"https://api.example.com"}'),{API_BASE_URL:'https://api.example.com'});
});
test('release requires explicit public HTTPS API',()=>{
  for(const url of [undefined,'http://10.0.2.2:14101','https://10.0.2.2','https://localhost','https://127.0.0.1','https://192.168.1.2','https://172.20.1.1','https://[::1]','https://169.254.169.254','https://100.64.0.1','https://[fd00::1]'])
    assert.ok(validate({API_BASE_URL:url}).length);
});
test('server secrets and enabled diagnostic/auth emulator overrides rejected',()=>{
  for(const extra of [{AUTH_CONTEXT_SESSION_KEY:'synthetic'},{FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'},{DIAGNOSTIC_ENABLED:true},{RAZORPAY_KEY_ID:'rzp_test_synthetic'},{DATABASE_URL:'synthetic'},{SUPABASE_SERVICE_ROLE_KEY:'synthetic'}])
    assert.ok(validate({API_BASE_URL:'https://api.example.com',...extra}).length);
});
test('public HTTPS config passes syntax checks without implying deployment readiness',()=>{
  assert.deepEqual(validate({API_BASE_URL:'https://api.example.com',DIAGNOSTIC_ENABLED:false}),[]);
});
