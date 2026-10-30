# Disposable PostgreSQL 18 integration checks

Run `node test/isolated-integration/pg18.cjs` from the built backend using Node 22, installed dependencies and a running local Docker engine with `postgres:18-alpine` already available. The harness never reads an existing database URL: it owns a random loopback-only tmpfs container and cleans up only that labelled container. No real Firebase login, storage, payment or push provider is used. Evidence is generated under the ignored `.runtime` subdirectory. This is synthetic HTTP/service verification, not native-device or real-provider E2E.

Use `node test/isolated-integration/pg18.cjs --full-tests` for the complete Jest suite including database account-link tests. Those tests require the random loopback target and a runner-created database nonce; they reject existing or fixed targets. Synthetic wallet/subscription/chart fixtures are created only after this proof. No real account, Google login, wallet or provider is used.
