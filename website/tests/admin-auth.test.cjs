/* eslint-disable @typescript-eslint/no-require-imports -- This Node CommonJS test harness loads transpiled modules with isolated dependencies. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { NextRequest } = require("next/server");
const root = path.resolve(__dirname, "..");
test('professional Kundli checkout no longer advertises the mistaken INR3000 price', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/subscriptions/page.tsx'), 'utf8');
  assert.ok(source.includes('Pay \u20b93,500 and Subscribe'));
  assert.equal(source.includes('Pay \u20b93,000 and Subscribe'), false);
  assert.ok(source.includes('Pay $1 and Subscribe'));
});
for (const status of ['ACTIVE', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED']) {
  test('Admin subscription maps canonical backend ' + status, () => {
    const source = fs.readFileSync(path.join(root, 'src/app/admin/subscriptions/page.tsx'), 'utf8');
    const fn = source.match(/function normalizeSubscription\(subscription:[\s\S]*?\n}/)[0];
    const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const normalize = vm.runInNewContext(js + ';normalizeSubscription');
    const plan = { id: 'synthetic-plan', name: 'ASTROLOGER_KUNDLI_YEARLY', price: '3500' };
    const mapped = normalize({ id: 'synthetic', subscriptionStatus: status, subscriptionPlan: plan, subscriptionPlanId: plan.id });
    assert.equal(mapped.status, status);
    assert.equal(mapped.plan, plan);
    assert.equal(mapped.planId, plan.id);
    assert.equal(normalize({ id: 'legacy', status: 'ACTIVE', plan }).plan, plan);
    assert.equal(normalize({ id: 'missing' }).status, 'UNKNOWN');
  });
}
function harness(overrides = {}, globals = {}) {
  const cache = new Map();
  const context = vm.createContext({
    console,
    URL,
    Response,
    Request,
    Headers,
    AbortSignal,
    process: {
      env: {
        NEXT_PUBLIC_API_BASE_URL: "https://staging.example.invalid",
        NODE_ENV: "production",
      },
    },
    fetch: async () => {
      throw new Error("Unexpected network request");
    },
    ...globals,
  });
  function load(file) {
    let full = path.resolve(root, file);
    if (!fs.existsSync(full) && full.endsWith(".ts") && fs.existsSync(`${full}x`)) full += "x";
    if (cache.has(full)) return cache.get(full).exports;
    const mod = { exports: {} };
    cache.set(full, mod);
    const source = ts.transpileModule(fs.readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(
      (name) => {
        if (Object.hasOwn(overrides, name)) return overrides[name];
        if (name.endsWith(".module.css"))
          return { default: new Proxy({}, { get: (_, key) => String(key) }) };
        if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
        if (name.startsWith("."))
          return load(
            path.relative(root, path.resolve(path.dirname(full), name)) + ".ts",
          );
        return require(name);
      },
      mod,
      mod.exports,
    );
    return mod.exports;
  }
  return { load, context };
}
const verifiedAdmin = { accessToken:"aspctx.synthetic-admin", authContext:"admin", success: true, role: "ADMIN", adminPolicy: "single-google-v1", user: { id: "canonical-admin", role: "ADMIN", portal: "admin" } };
const contract = "src/features/admin/auth/admin-contract.ts";
const bridge = "src/app/api/admin/session/route.ts";
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const req = (method, body, origin = "https://admin.example.invalid") =>
  new NextRequest("https://admin.example.invalid/api/admin/session", {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("no silent API fallback", () => {
  const h = harness();
  delete h.context.process.env.NEXT_PUBLIC_API_BASE_URL;
  assert.throws(() => h.load(contract).getAdminApiBase(), /not configured/);
});
for (const value of [
  "http://remote.invalid",
  "https://user:secret@host.invalid",
  "https://host.invalid?token=value",
])
  test("reject unsafe API config", () => {
    const h = harness();
    h.context.process.env.NEXT_PUBLIC_API_BASE_URL = value;
    assert.throws(() => h.load(contract).getAdminApiBase());
  });
test("explicit localhost config supported", () => {
  const h = harness();
  h.context.process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000/";
  assert.equal(h.load(contract).getAdminApiBase(), "http://localhost:4000");
});
for (const status of [401, 403])
  test("backend rejection " + status, async () => {
    const h = harness(
      {},
      { fetch: async () => json({ success: false }, status) },
    );
    assert.equal(await h.load(contract).checkAdminToken("aspctx.synthetic-outage"), false);
  });
test("no token means no request", async () =>
  assert.equal(
    await harness().load(contract).checkAdminToken(undefined),
    false,
  ));
test("forged role cookie cannot authorize Admin", async () => {
  const result = await harness()
    .load("src/proxy.ts")
    .proxy(
      new NextRequest("https://admin.example.invalid/admin", {
        headers: {
          cookie:
            "asp_user=" +
            encodeURIComponent('{"role":"ADMIN","portal":"ADMIN"}'),
        },
      }),
    );
  assert.equal(result.status, 307);
  assert.match(result.headers.get("location"), /\/admin\/login$/);
});
test("middleware revalidates HttpOnly bearer through backend", async () => {
  let sent;
  const h = harness(
    {},
    {
      fetch: async (url, init) => {
        sent = { url, init };
        return json(verifiedAdmin);
      },
    },
  );
  const result = await h.load("src/proxy.ts").proxy(
    new NextRequest("https://admin.example.invalid/admin", {
      headers: { cookie: "asp_admin_session=aspctx.synthetic-admin" },
    }),
  );
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(sent.init.body), { accessToken: "aspctx.synthetic-admin" });
  assert.equal(sent.init.cache, "no-store");
});
test("revoked/non-admin cookie denied", async () => {
  const h = harness({}, { fetch: async () => json({ success: false }, 403) });
  const result = await h.load("src/proxy.ts").proxy(
    new NextRequest("https://admin.example.invalid/admin/users", {
      headers: { cookie: "asp_admin_session=customer-token" },
    }),
  );
  assert.equal(result.status, 307);
  assert.match(result.headers.get("set-cookie"), /Max-Age=0/i);
});
test("authorization outage fails closed", async () => {
  const result = await harness()
    .load("src/proxy.ts")
    .proxy(
      new NextRequest("https://admin.example.invalid/admin", {
        headers: { cookie: "asp_admin_session=aspctx.synthetic-outage" },
      }),
    );
  assert.equal(result.status, 503);
});
for (const route of ["/admin/login"])
  test("public Admin route " + route, async () => {
    assert.equal(
      (
        await harness()
          .load("src/proxy.ts")
          .proxy(new NextRequest("https://admin.example.invalid" + route))
      ).status,
      200,
    );
  });
test("cross-origin session and logout blocked", async () => {
  const api = harness().load(bridge);
  assert.equal(
    (
      await api.POST(
        req(
          "POST",
          { idToken: "token", method: "google" },
          "https://foreign.invalid",
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (await api.DELETE(req("DELETE", undefined, "https://foreign.invalid")))
      .status,
    403,
  );
});
for (const body of [
  {},
  { idToken: "x", method: "admin" },
  { idToken: "two tokens", method: "google" },
])
  test("invalid bridge payload rejected", async () => {
    assert.equal(
      (await harness().load(bridge).POST(req("POST", body))).status,
      400,
    );
  });
test("Google bridge exact backend payload and secure HttpOnly cookie", async () => {
  const calls = [];
  const h = harness(
    {},
    {
      fetch: async (url, init) => {
        calls.push({ url, init });
        return url.endsWith("/auth/admin/firebase/google")
          ? json(verifiedAdmin)
          : json(verifiedAdmin);
      },
    },
  );
  const result = await h
    .load(bridge)
    .POST(req("POST", { idToken: "google-token", method: "google" }));
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(calls[0].init.body), { idToken: "google-token" });
  assert.match(calls[0].url, /\/auth\/admin\/firebase\/google$/);
  const cookie = result.headers.get("set-cookie");
  for (const flag of [/HttpOnly/i, /Secure/i, /SameSite=strict/i])
    assert.match(cookie, flag);
  assert.equal((await result.json()).user.id, "canonical-admin");
});
test("client Admin role cannot override backend Customer", async () => {
  const h = harness(
    {},
    {
      fetch: async () =>
        json({ success: true, role: "CUSTOMER", user: { id: "customer" } }),
    },
  );
  const result = await h.load(bridge).POST(
    req("POST", {
      idToken: "customer-token",
      method: "google",
      role: "ADMIN",
    }),
  );
  assert.equal(result.status, 401);
  assert.match(result.headers.get("set-cookie"), /Max-Age=0/i);
});
test("existing Email/Phone still require protected Admin check", async () => {
  const h = harness({}, { fetch: async () => json({ success: false }, 403) });
  assert.equal(
    (
      await h
        .load(bridge)
        .POST(req("POST", { idToken: "customer-token", method: "existing" }))
    ).status,
    401,
  );
});
test("logout expires only Admin routing cookie", async () => {
  const result = await harness().load(bridge).DELETE(req("DELETE"));
  const cookie = result.headers.get("set-cookie");
  assert.equal(result.status, 200);
  assert.match(cookie, /asp_admin_session=/);
  assert.match(cookie, /Max-Age=0/i);
  assert.doesNotMatch(cookie, /asp_user=/);
});
function browser(fetcher) {
  const map = new Map([["asp_admin_firebase_uid", "firebase-admin"]]),
    sessionMap = new Map();
  const store = (m) => ({
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  });
  const auth = {
    currentUser: {
      uid: "firebase-admin",
      getIdToken: async () => "renewed-token",
    },
    authStateReady: async () => {},
  };
  let signedOut = 0,
    redirected;
  const h = harness(
    {
      "firebase/auth": {
        signOut: async () => {
          signedOut++;
          auth.currentUser = null;
        },
      },
      "@/lib/firebaseClient": { firebaseAuth: auth },
    },
    {
      localStorage: store(map),
      sessionStorage: store(sessionMap),
      window: {
        dispatchEvent: () => {},
        location: {
          replace: (url) => {
            redirected = url;
          },
        },
      },
      Event: class {},
      atob: (s) => Buffer.from(s, "base64").toString(),
      fetch: fetcher,
    },
  );
  return {
    ...h,
    map,
    sessionMap,
    auth,
    signedOut: () => signedOut,
    redirected: () => redirected,
    api: h.load("src/features/admin/auth/admin-session.ts"),
  };
}
test("logout clears native and Admin state while preserving Customer storage", async () => {
  const h = browser(async () => json(verifiedAdmin));
  h.map.set("asp_admin_access_token", "token");
  h.map.set("asp_access_token", "customer-session");
  h.sessionMap.set("admin_phone", "fixture");
  await h.api.logoutAdmin();
  assert.equal(h.signedOut(), 1);
  assert.equal(h.map.has("asp_admin_access_token"), false);
  assert.equal(h.map.get("asp_access_token"), "customer-session");
  assert.equal(h.sessionMap.size, 0);
});
test("late session POST cannot restore logout; DELETE follows", async () => {
  let release, started;
  const ready = new Promise((r) => {
    started = r;
  });
  const calls = [];
  const h = browser(async (url, init) => {
    calls.push(init.method);
    if (init.method === "POST") {
      started();
      await new Promise((r) => {
        release = r;
      });
    }
    return json({ success: true, user: { id: "admin" } });
  });
  const establish = h.api.establishAdminSession("token", "google");
  const rejected = assert.rejects(establish, /cancelled/);
  await ready;
  const logout = h.api.logoutAdmin();
  release();
  await rejected;
  await logout;
  assert.deepEqual(calls, ["POST", "DELETE"]);
  assert.equal(h.map.has("asp_admin_access_token"), false);
});
test("reopen renews Firebase token and server routing session", async () => {
  let posted;
  const h = browser(async (url, init) => {
    posted = JSON.parse(init.body);
    return json(verifiedAdmin);
  });
  h.map.set("asp_admin_access_token", "old-token");
  h.map.set("asp_admin_auth_method", "firebase");
  assert.equal(await h.api.refreshAdminSession(), "aspctx.synthetic-admin");
  assert.equal(posted.idToken, "renewed-token");
});
test("concurrent renewal deduplicated", async () => {
  let count = 0;
  const h = browser(async () => {
    count++;
    return json(verifiedAdmin);
  });
  h.map.set("asp_admin_access_token", "old");
  h.map.set("asp_admin_auth_method", "firebase");
  await Promise.all([h.api.refreshAdminSession(), h.api.refreshAdminSession()]);
  assert.equal(count, 1);
});
test("Customer token never used as Admin fallback", async () => {
  const h = browser(async () => {
    throw Error("Unexpected request");
  });
  h.map.set("asp_access_token", "customer");
  await assert.rejects(h.api.refreshAdminSession(), /sign in as Admin/);
});
test("server logout failure is reported", async () => {
  const h = browser(async () => json({}, 503));
  await assert.rejects(h.api.logoutAdmin(), /could not finish/);
  assert.equal(h.signedOut(), 1);
});
test("401 protected API logs out and redirects", async () => {
  const h = browser(async (url) =>
    url.endsWith("/admin/stats") ? json({}, 401) : json(verifiedAdmin),
  );
  h.map.set("asp_admin_access_token", "token");
  h.map.set("asp_admin_auth_method", "firebase");
  await assert.rejects(
    h.api.adminFetch("/admin/stats"),
    /expired or access denied/,
  );
  assert.equal(h.redirected(), "/admin/login");
  assert.equal(h.map.has("asp_admin_access_token"), false);
});
test("dashboard errors cannot render fake zero preview", () => {
  const s = fs.readFileSync(
    path.join(root, "src/features/admin/AdminDashboard.tsx"),
    "utf8",
  );
  assert.match(s, /if \(errorMessage \|\| !stats\)/);
  assert.match(s, /Dashboard unavailable/);
  assert.doesNotMatch(s, /temporary values|asp_access_token|localhost:4000/);
});
test("login preserves Email and Phone with secure Google action", () => {
  const s = fs.readFileSync(
    path.join(root, "src/app/admin/login/page.tsx"),
    "utf8",
  );
  for (const r of [
    /Continue with Google/,
    /signInWithPopup/,
    /signInWithEmailAndPassword/,
    /signInWithPhoneNumber/,
    /establishAdminSession/,
  ])
    assert.match(s, r);
  assert.doesNotMatch(s, /document.cookie|localhost:4000/);
});

test("backend outage is not treated as valid or non-admin authentication", async () => {
  const h = harness({}, { fetch: async () => json({}, 503) });
  await assert.rejects(
    h.load(contract).checkAdminToken("aspctx.synthetic-outage"),
    /unavailable/,
  );
});
test("missing deployed Google endpoint produces explicit unavailable error", async () => {
  const h = harness({}, { fetch: async () => json({}, 404) });
  assert.equal(
    (
      await h
        .load(bridge)
        .POST(req("POST", { idToken: "token", method: "google" }))
    ).status,
    503,
  );
});
test("legacy Email session cannot renew Admin access or call refresh API", async () => {
  let calls = 0;
  const h = browser(async () => { calls++; return json(verifiedAdmin); });
  h.map.set('asp_admin_access_token', 'expired'); h.map.set('asp_admin_auth_method', 'email');
  await assert.rejects(h.api.refreshAdminSession(), /secure Admin session/);
  assert.equal(calls, 0);
});

test("Firebase refresh failure never falls back to Customer credentials", async () => {
  const h = browser(async () => {
    throw Error("Unexpected fetch");
  });
  h.map.set("asp_admin_access_token", "old");
  h.map.set("asp_admin_auth_method", "firebase");
  h.map.set("asp_access_token", "customer");
  h.auth.currentUser = null;
  await assert.rejects(h.api.refreshAdminSession(), /Firebase session expired/);
});
test("every Admin module uses the single explicit API configuration", () => {
  function scan(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) scan(f);
      else if (/\.tsx?$/.test(f) && !f.endsWith("admin-contract.ts")) {
        const s = fs.readFileSync(f, "utf8");
        assert.doesNotMatch(s, /http:\/\/(localhost|127\.0\.0\.1):4000/, f);
        assert.doesNotMatch(s, /process\.env\.NEXT_PUBLIC_API_/, f);
      }
    }
  }
  scan(path.join(root, "src/app/admin"));
  scan(path.join(root, "src/features/admin"));
});

test("renewal rejects a different Firebase account before contacting backend", async () => {
  const h = browser(async () => {
    throw Error("Unexpected request");
  });
  h.map.set("asp_admin_access_token", "old");
  h.map.set("asp_admin_auth_method", "firebase");
  h.auth.currentUser.uid = "different-account";
  await assert.rejects(h.api.refreshAdminSession(), /account changed/);
});
test("new Google session cannot be established without a Firebase user", async () => {
  const h = browser(async () => {
    throw Error("Unexpected request");
  });
  h.auth.currentUser = null;
  await assert.rejects(
    h.api.establishAdminSession("token", "google"),
    /account changed/,
  );
});

test("Admin login exposes approved Google and Email methods while Phone stays hidden", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const h = harness({
    "next/navigation": {
      useRouter: () => ({ replace() {}, refresh() {}, push() {} }),
    },
    "firebase/auth": {},
    "@/lib/firebaseClient": { firebaseAuth: {} },
    "react-phone-number-input": {
      default: () =>
        React.createElement("input", { "aria-label": "Phone number" }),
      isValidPhoneNumber: () => true,
    },
  });
  const html = renderToStaticMarkup(
    React.createElement(h.load("src/app/admin/login/page.tsx").default),
  );
  assert.match(html, /Continue with Google/);
  assert.match(html, /<div[^>]*hidden=""[^>]*data-admin-legacy-auth/);
  const visiblePrefix = html.slice(0, html.indexOf("<div hidden="));
  assert.doesNotMatch(
    visiblePrefix,
    /Phone number|Continue with OTP/,
  );
  assert.match(html, /Admin Email/);
  assert.match(html, /Login as Admin/);
  assert.match(html, /Phone number/);
});

for (const state of ["loading", "error"])
  test(
    "dashboard renders " + state + " without zero-value metric cards",
    () => {
      const React = require("react");
      const { renderToStaticMarkup } = require("react-dom/server");
      const states = [
        null,
        state === "loading",
        state === "error" ? "Backend unavailable" : null,
      ];
      const h = harness({
        react: {
          useState: () => [states.shift(), () => {}],
          useEffect: () => {},
        },
        "next/link": {
          default: ({ children, href }) =>
            React.createElement("a", { href }, children),
        },
        "./components/AstrologerTable": { AstrologerTable: () => null },
        "./auth/admin-session": {
          adminFetch: () => {
            throw Error("Unexpected request");
          },
        },
      });
      const html = renderToStaticMarkup(
        React.createElement(
          h.load("src/features/admin/AdminDashboard.tsx").AdminDashboard,
        ),
      );
      assert.match(
        html,
        state === "loading"
          ? /Loading verified Admin dashboard/
          : /Dashboard unavailable/,
      );
      assert.doesNotMatch(
        html,
        /Total Customers|Total Revenue|temporary values/,
      );
    },
  );

function renderLoginState(loading, message) {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const values = [undefined, loading, message, "", ""];
  const h = harness({
    react: {
      useState: () => [values.shift(), () => {}],
      useRef: () => ({ current: null }),
    },
    "next/navigation": {
      useRouter: () => ({ replace() {}, refresh() {}, push() {} }),
    },
    "firebase/auth": {},
    "@/lib/firebaseClient": { firebaseAuth: {} },
    "react-phone-number-input": {
      default: () =>
        React.createElement("input", { "aria-label": "Phone number" }),
      isValidPhoneNumber: () => true,
    },
  });
  return renderToStaticMarkup(
    React.createElement(h.load("src/app/admin/login/page.tsx").default),
  );
}
test("reference layout retains all feature highlights and one visible Google action", () => {
  const html = renderLoginState(false, "");
  for (const label of [
    "Guidance for a better you",
    "Secure Access",
    "Manage Platform",
    "Support Astrologers",
    "Monitor Operations",
    "Welcome Back",
    "Admin Portal",
    "Platform Analytics",
    "Astrologer Management",
    "System Operations",
  ])
    assert.ok(html.includes(label), label);
  assert.equal((html.match(/Continue with Google/g) || []).length, 1);
  assert.match(html, /login-reference.png/);
  assert.match(html, /aria-labelledby="admin-welcome-title"/);
});
test("Google button preserves loading and disabled feedback", () => {
  const html = renderLoginState(true, "");
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled="" class="googleButton"/);
  assert.match(html, /Signing in/);
});
test("access denied remains an announced readable error in the new card", () => {
  const html = renderLoginState(false, "Admin access denied.");
  assert.match(html, /role="alert" aria-live="polite"/);
  assert.match(html, /Admin access denied\./);
  assert.match(html, /Continue with Google/);
});
test("layout includes narrow-screen and reduced-motion safeguards", () => {
  const css = fs.readFileSync(
    path.join(root, "src/app/admin/login/admin-login.module.css"),
    "utf8",
  );
  assert.match(css, /max-width: 900px/);
  assert.match(css, /max-width: 380px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /minmax\(0, 1fr\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /focus-visible/);
});

for (const route of ['/admin.backup-before-token-fix', '/admin.backup-before-token-fix/login', '/admin.backup-before-token-fix/customers']) test('retired Admin route is inaccessible '+route, async () => {
  const result = await harness().load('src/proxy.ts').proxy(new NextRequest('https://admin.example.invalid'+route));
  assert.equal(result.status,404);
});
test('legacy OTP page redirects to Google login without serving controls', async () => {
  const result=await harness().load('src/proxy.ts').proxy(new NextRequest('https://admin.example.invalid/admin/verify-otp'));
  assert.equal(result.status,307);assert.match(result.headers.get('location'),/\/admin\/login$/);
});
test('old role-only backend responses cannot establish or restore Admin sessions', async () => {
  const h=harness({}, {fetch:async()=>json({success:true,role:'ADMIN',user:{id:'old-admin',role:'ADMIN'}})});
  assert.equal(await h.load(contract).checkAdminToken('old-token'),false);
  assert.equal((await h.load(bridge).POST(req('POST',{idToken:'old-token',method:'existing'}))).status,401);
});
test('existing session renewal uses strict Google endpoint, never stats authorization alone', async () => {
  let target;
  const h=harness({}, {fetch:async(url)=>{target=url;return json(verifiedAdmin);}});
  assert.equal((await h.load(bridge).POST(req('POST',{idToken:'aspctx.synthetic-admin',method:'existing'}))).status,200);
  assert.match(target,/\/auth\/admin\/context\/verify$/);
});
test('Next proxy is located beside src/app and matches retired routes', () => {
  assert.ok(fs.existsSync(path.join(root,'src/proxy.ts')));
  assert.equal(fs.existsSync(path.join(root,'middleware.ts')),false);
  const source=fs.readFileSync(path.join(root,'src/proxy.ts'),'utf8');
  assert.match(source,/admin.backup-before-token-fix\/:path\*/);
});

test('commission settings reuse authenticated renewal and never read legacy bearer storage', () => {
  const source=fs.readFileSync(path.join(root,'src/app/admin/platform-settings/page.tsx'),'utf8');
  assert.match(source,/import \{ adminFetch \}/);
  assert.equal((source.match(/await adminFetch\(/g)||[]).length,2);
  assert.doesNotMatch(source,/localStorage|getAdminToken|Authorization:/);
});

test('subscription monitoring reuses protected Admin renewal without legacy token storage', () => {
  const source=fs.readFileSync(path.join(root,'src/app/admin/subscriptions/page.tsx'),'utf8');
  assert.match(source,/await adminFetch\(/);
  assert.doesNotMatch(source,/localStorage|getAccessToken|Authorization:/);
});

for (const state of ['loading','error','records']) test('horoscope monitoring renders '+state+' without estimated deliveries',()=>{
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const data=state==='records'?{active:2,expired:3,pending:1,durableStatus:'RECORDED',generation:[],delivery:[{locale:'ja',state:'UNKNOWN',count:1,attempts:2,failureCode:'ACCEPTANCE_UNKNOWN'}],paymentScope:'ALL_SUBSCRIPTION_PLANS',paymentStates:[]}:null;
  const values=[data,state==='error'];
  const h=harness({react:{useState:()=>[values.shift(),()=>{}],useEffect:()=>{}},'./auth/admin-session':{adminFetch:()=>{throw Error('Unexpected network');}}});
  const html=renderToStaticMarkup(React.createElement(h.load('src/features/admin/HoroscopeMonitoringPanel.tsx').HoroscopeMonitoringPanel));
  if(state==='records'){assert.match(html,/UNKNOWN/);assert.match(html,/ja/);assert.match(html,/FCM accepted does not mean device displayed/);}
  else{assert.match(html,state==='error'?/role="alert"/:/role="status"/);assert.doesNotMatch(html,/Active:|Jobs|FCM accepted/);}
});

test('finance page separates collections and liability and never invents settled cash or error balances', () => {
  const source=fs.readFileSync(path.join(root,'src/app/admin/finance/page.tsx'),'utf8');
  assert.match(source,/adminFetch\("\/admin\/finance\/overview"\)/);
  assert.match(source,/Global recorded totals across all pages/);
  assert.match(source,/Recorded total balance/);
  assert.match(source,/Recorded paid bucket/);
  assert.match(source,/Collections separated by record mode and currency/);
  assert.match(source,/data\.settlement\.status/);
  assert.match(source,/role="alert"/);
  assert.doesNotMatch(source,/localStorage|settledAmount|Math\.random/);
});

for (const state of ['loading', 'error', 'records']) test('finance renders '+state+' without fabricated settlement', () => {
  const React=require('react');
  const {renderToStaticMarkup}=require('react-dom/server');
  const data=state==='records' ? {
    wallets:[{currency:'INR',_sum:{balance:'101.25',lockedBalance:'20',paidBalance:'100',freeBalance:'1.25'}}],
    earnings:[{currency:'USD',status:'PENDING',_sum:{grossAmount:'10',platformFee:'3',netAmount:'7'}}],
    payouts:[],collections:[],warning:'Recorded only',settlement:{status:'UNVERIFIED',reason:'No bank evidence'},audit:{status:'NOT_ACTIVATED',rows:[]},
    runtime:{configuredPaymentMode:'TEST',recordMode:'UNKNOWN'},
    collectionsByMode:[
      {providerMode:'TEST',currency:'INR',status:'SUCCESS',type:'WALLET_RECHARGE',count:1,amount:'100'},
      {providerMode:'UNKNOWN',currency:'USD',status:'PENDING',type:'SUBSCRIPTION',count:2,amount:'2'},
    ],
  } : null;
  const states=[data,state==='error'?'Unavailable':''];
  const h=harness({
    react:{useState:()=>[states.shift(),()=>{}],useEffect:()=>{}},
    'next/link':{default:({children,href})=>React.createElement('a',{href},children)},
    '@/features/admin/auth/admin-session':{adminFetch:()=>{throw Error('Unexpected request');}},
  });
  const html=renderToStaticMarkup(React.createElement(h.load('src/app/admin/finance/page.tsx').default));
  if(state==='records') {
    assert.match(html,/101.25/);assert.match(html,/USD/);assert.match(html,/PENDING/);assert.match(html,/UNVERIFIED/);
    assert.match(html,/NOT_ACTIVATED/);assert.doesNotMatch(html,/<strong>VERIFIED<\/strong>/);
    assert.match(html,/Recorded total balance/);assert.match(html,/Recorded paid bucket/);
    assert.match(html,/TEST MODE credentials configured/);
    assert.match(html,/unknown historical records are not assumed TEST/);
    assert.match(html,/TEST.*INR.*WALLET_RECHARGE.*SUCCESS.*1 orders.*100\.00/);
    assert.match(html,/UNKNOWN.*USD.*SUBSCRIPTION.*PENDING.*2 orders.*2\.00/);
  } else {
    assert.match(html,state==='error'?/role="alert"/:/Loading financial records/);
    assert.doesNotMatch(html,/101.25|Recorded total balance|No recorded entries|100\.00|2 orders/);
  }
});

for (const page of ['src/app/admin/astrologers/page.tsx', 'src/app/admin/astrologers/[id]/page.tsx']) {
  test('astrologer moderation uses protected Admin session bridge: '+page, () => {
    const source = fs.readFileSync(path.join(root,page),'utf8');
    assert.match(source, /import \{ adminFetch \} from/);
    assert.doesNotMatch(source, /localStorage|asp_access_token|asp_admin_access_token|Authorization:/);
    assert.doesNotMatch(source, /await fetch\(/);
    assert.match(source, /await adminFetch\(/);
  });
}

for (const page of ['src/features/admin/AdminArticleManagement.tsx', 'src/features/admin/marketplace/MarketplaceSellers.tsx', 'src/features/admin/marketplace/MarketplaceProducts.tsx', 'src/app/admin/kundli-settings/page.tsx']) {
  test('partner controls renew the sole authorized Google Admin session: '+page, () => {
    const source = fs.readFileSync(path.join(root,page),'utf8');
    assert.match(source, /return refreshAdminSession\(\)/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|asp_access_token|asp_admin_access_token/);
  });
}

test('Admin dashboard renders currencies independently instead of an INR combined total', () => {
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const rows=[{currency:'USD',amount:1},{currency:'INR',amount:70}];
  const stats={users:{total:0},astrologers:{total:0,pending:0,approved:0,verified:0,online:0},consultations:{totalCallSessions:0},
    payments:{totalOrders:0,successfulOrders:0,successfulAmountByCurrency:rows,refundedAmountByCurrency:[]},
    wallets:{totalWallets:0,totalBalanceByCurrency:rows},reviews:{total:0}};
  const states=[stats,false,null];
  const h=harness({react:{useState:()=>[states.shift(),()=>{}],useEffect:()=>{}},
    'next/link':{default:({children,href})=>React.createElement('a',{href},children)},
    './components/AstrologerTable':{AstrologerTable:()=>null},'./auth/admin-session':{adminFetch:()=>{throw Error('Unexpected request')}}});
  const html=renderToStaticMarkup(React.createElement(h.load('src/features/admin/AdminDashboard.tsx').AdminDashboard));
  assert.match(html,/USD/);assert.match(html,/INR/);assert.doesNotMatch(html,/71[.,]00/);
});

for (const page of ['src/app/admin/analytics/page.tsx','src/app/admin/reports/page.tsx']) test('remaining partner reporting uses verified Admin bridge: '+page,()=>{
  const source=fs.readFileSync(path.join(root,page),'utf8');assert.match(source,/await adminFetch\(/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|Authorization:/);
});
for (const state of ['loading','error','records']) test('analytics '+state+' never fabricates monetary totals',()=>{
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const values=[state==='records'?{totalCustomers:2,collections:[{currency:'USD',amount:1},{currency:'INR',amount:70}]}:{},state==='loading',state==='error'?'Unavailable': ''];
  const h=harness({react:{useState:()=>[values.shift(),()=>{}],useEffect:()=>{},useCallback:fn=>fn},'next/link':{default:({children,href})=>React.createElement('a',{href},children)},'@/features/admin/auth/admin-session':{adminFetch:()=>{throw Error('Unexpected request')}}});
  const html=renderToStaticMarkup(React.createElement(h.load('src/app/admin/analytics/page.tsx').default));
  if(state==='records'){assert.match(html,/USD/);assert.match(html,/INR/);assert.doesNotMatch(html,/71[.,]00/);}
  else assert.doesNotMatch(html,/Successful Payment Collections/);
});

test('consultation oversight has no legacy bearer fallback or unsupported Admin settlement action',()=>{
  const source=fs.readFileSync(path.join(root,'src/app/admin/consultations/page.tsx'),'utf8');
  assert.match(source,/await adminFetch\(/);assert.doesNotMatch(source,/localStorage|sessionStorage|Authorization:/);
  assert.match(source,/ADMIN_CONSULTATION_MUTATIONS_AVAILABLE = false/);
  assert.match(source,/if \(!ADMIN_CONSULTATION_MUTATIONS_AVAILABLE\)/);
  assert.doesNotMatch(source,/Completed Revenue|stats.totalRevenue/);
});

for (const page of ['src/app/admin/payments/page.tsx','src/app/admin/wallet/page.tsx','src/features/admin/marketplace/MarketplaceCategories.tsx','src/features/admin/marketplace/MarketplaceCampaigns.tsx','src/features/admin/marketplace/MarketplaceFinance.tsx','src/features/admin/marketplace/MarketplaceOrders.tsx']) test('Admin reporting/moderation cannot reuse Customer browser tokens: '+page,()=>{
 const source=fs.readFileSync(path.join(root,page),'utf8');assert.match(source,/return refreshAdminSession\(\)/);assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

for(const page of ['src/app/admin/marketplace/page.tsx','src/app/admin/marketplace/products/page.tsx','src/app/admin/marketplace/categories/page.tsx'])test('direct marketplace Admin routes use the same authorized session: '+page,()=>{
 const source=fs.readFileSync(path.join(root,page),'utf8');assert.match(source,/return refreshAdminSession\(\)/);assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
