import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  createApiClient,
  createMemoryTokenStore,
  ErrorCodes,
} from "../src/api/client.ts";

const BASE = "http://api.test/v1";

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const authResult = (access: string, refresh: string) => ({
  data: {
    accessToken: access,
    expiresIn: 900,
    refreshToken: refresh,
    user: { id: "usr_1", displayName: "Hammas", role: "BUYER" },
  },
  meta: { requestId: "req_auth" },
});

test("unwraps data from the envelope, sends base URL and bearer token", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const tokens = createMemoryTokenStore();
  tokens.set({ accessToken: "acc_1", refreshToken: "ref_1" });
  const client = createApiClient({
    baseUrl: BASE,
    tokens,
    fetch: async (url, init) => {
      seen.push({
        url: String(url),
        auth: new Headers(init?.headers).get("authorization"),
      });
      return json(200, { data: { items: [], nextCursor: null }, meta: { requestId: "r" } });
    },
  });

  const page = await client.request<{ items: unknown[]; nextCursor: string | null }>(
    "/categories",
    { query: { limit: 20, cursor: undefined } },
  );

  assert.deepEqual(page, { items: [], nextCursor: null });
  assert.equal(seen[0]!.url, `${BASE}/categories?limit=20`);
  assert.equal(seen[0]!.auth, "Bearer acc_1");
});

test("maps the backend error envelope to ApiError with code, status and requestId", async () => {
  const client = createApiClient({
    baseUrl: BASE,
    tokens: createMemoryTokenStore(),
    fetch: async () =>
      json(422, {
        error: {
          code: ErrorCodes.BID_TOO_LOW,
          message: "Minimum next bid is 1900",
          details: { minimumNext: 1900 },
        },
        meta: { requestId: "req_bid" },
      }),
  });

  await assert.rejects(
    client.request("/sales/s1/bids", { method: "POST", body: { amount: 1 } }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "BID_TOO_LOW");
      assert.equal(err.status, 422);
      assert.equal(err.requestId, "req_bid");
      assert.deepEqual(err.details, { minimumNext: 1900 });
      return true;
    },
  );
});

test("401 refreshes once, stores rotated tokens and retries the original request", async () => {
  const tokens = createMemoryTokenStore();
  tokens.set({ accessToken: "old_access", refreshToken: "old_refresh" });
  const calls: string[] = [];
  const client = createApiClient({
    baseUrl: BASE,
    tokens,
    fetch: async (url, init) => {
      const path = String(url).replace(BASE, "");
      calls.push(path);
      if (path === "/me/following") {
        const auth = new Headers(init?.headers).get("authorization");
        return auth === "Bearer new_access"
          ? json(200, { data: ["ch_1"], meta: {} })
          : json(401, { error: { code: ErrorCodes.INVALID_TOKEN, message: "expired" } });
      }
      if (path === "/auth/refresh") {
        assert.deepEqual(JSON.parse(String(init?.body)), { refreshToken: "old_refresh" });
        return json(200, authResult("new_access", "new_refresh"));
      }
      throw new Error(`unexpected ${path}`);
    },
  });

  const following = await client.request<string[]>("/me/following");

  assert.deepEqual(following, ["ch_1"]);
  assert.deepEqual(calls, ["/me/following", "/auth/refresh", "/me/following"]);
  assert.deepEqual(tokens.get(), { accessToken: "new_access", refreshToken: "new_refresh" });
});

test("concurrent 401s share one refresh, so a rotated refresh token is never reused", async () => {
  const tokens = createMemoryTokenStore();
  tokens.set({ accessToken: "old_access", refreshToken: "old_refresh" });
  let refreshCalls = 0;
  const client = createApiClient({
    baseUrl: BASE,
    tokens,
    fetch: async (url, init) => {
      const path = String(url).replace(BASE, "");
      if (path === "/auth/refresh") {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return json(200, authResult("new_access", "new_refresh"));
      }
      const auth = new Headers(init?.headers).get("authorization");
      return auth === "Bearer new_access"
        ? json(200, { data: path, meta: {} })
        : json(401, { error: { code: ErrorCodes.INVALID_TOKEN, message: "expired" } });
    },
  });

  const results = await Promise.all([
    client.request<string>("/a"),
    client.request<string>("/b"),
    client.request<string>("/c"),
  ]);

  assert.equal(refreshCalls, 1);
  assert.deepEqual(results, ["/a", "/b", "/c"]);
});

test("a failed refresh clears tokens and surfaces the original 401", async () => {
  const tokens = createMemoryTokenStore();
  tokens.set({ accessToken: "old_access", refreshToken: "revoked" });
  const client = createApiClient({
    baseUrl: BASE,
    tokens,
    fetch: async (url) => {
      const path = String(url).replace(BASE, "");
      if (path === "/auth/refresh") {
        return json(401, { error: { code: ErrorCodes.INVALID_TOKEN, message: "reuse" } });
      }
      return json(401, { error: { code: ErrorCodes.INVALID_TOKEN, message: "expired" } });
    },
  });

  await assert.rejects(client.request("/me/following"), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, ErrorCodes.INVALID_TOKEN);
    return true;
  });
  assert.equal(tokens.get(), null);
});

test("a wrong-password login 401 does not attempt a refresh", async () => {
  const tokens = createMemoryTokenStore();
  tokens.set({ accessToken: "old_access", refreshToken: "old_refresh" });
  const paths: string[] = [];
  const client = createApiClient({
    baseUrl: BASE,
    tokens,
    fetch: async (url) => {
      paths.push(String(url).replace(BASE, ""));
      return json(401, {
        error: { code: ErrorCodes.INVALID_CREDENTIALS, message: "Invalid credentials" },
      });
    },
  });

  await assert.rejects(client.login("a@example.com", "wrong"), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, ErrorCodes.INVALID_CREDENTIALS);
    return true;
  });
  assert.deepEqual(paths, ["/auth/login"]);
  assert.deepEqual(tokens.get(), { accessToken: "old_access", refreshToken: "old_refresh" });
});

test("login stores tokens on success", async () => {
  const tokens = createMemoryTokenStore();
  const client = createApiClient({
    baseUrl: BASE,
    tokens,
    fetch: async () => json(200, authResult("acc_login", "ref_login")),
  });

  const result = await client.login("a@example.com", "pw");

  assert.equal(result.user.role, "BUYER");
  assert.deepEqual(tokens.get(), { accessToken: "acc_login", refreshToken: "ref_login" });
});

test("a network failure becomes NETWORK_ERROR with status 0", async () => {
  const client = createApiClient({
    baseUrl: BASE,
    tokens: createMemoryTokenStore(),
    fetch: async () => {
      throw new TypeError("fetch failed");
    },
  });

  await assert.rejects(client.request("/categories"), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, ErrorCodes.NETWORK_ERROR);
    assert.equal(err.status, 0);
    return true;
  });
});

test("204 resolves to undefined, and a non-envelope error becomes UNKNOWN_ERROR", async () => {
  let mode: "empty" | "html" = "empty";
  const client = createApiClient({
    baseUrl: BASE,
    tokens: createMemoryTokenStore(),
    fetch: async () =>
      mode === "empty"
        ? new Response(null, { status: 204 })
        : new Response("<html>502</html>", { status: 502 }),
  });

  assert.equal(await client.request("/me/following", { method: "DELETE" }), undefined);

  mode = "html";
  await assert.rejects(client.request("/categories"), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, ErrorCodes.UNKNOWN_ERROR);
    assert.equal(err.status, 502);
    return true;
  });
});
