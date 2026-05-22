const requiredSecurityHeaders = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options"
];

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function targetUrl() {
  const value = readArg("--url") || process.env.EDGE_NOTE_SMOKE_URL || process.env.EDGE_NOTE_PUBLIC_URL;
  if (!value) {
    throw new Error("Set EDGE_NOTE_SMOKE_URL or pass --url https://your-edge-note-domain.example");
  }

  const url = new URL(value);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Production smoke URL must use https.");
  }
  return url.origin;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  throw new Error(message);
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json" },
    redirect: "manual"
  });
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    fail(`${path} did not return valid JSON.`);
  }

  return { response, json };
}

function assertSecurityHeaders(response, path) {
  for (const header of requiredSecurityHeaders) {
    if (!response.headers.get(header)) {
      fail(`${path} is missing ${header}.`);
    }
  }
}

async function checkHealth(baseUrl) {
  const { response, json } = await getJson(baseUrl, "/api/health");
  if (response.status !== 200 || json?.ok !== true || json?.service !== "edge-note") {
    fail("/api/health did not return the expected service payload.");
  }
  assertSecurityHeaders(response, "/api/health");
  pass("/api/health");
}

async function checkConfig(baseUrl) {
  const { response, json } = await getJson(baseUrl, "/api/config");
  if (response.status !== 200) {
    fail("/api/config did not return 200.");
  }
  if (typeof json?.attachmentLimitMb !== "number" || json?.syncMode !== "manual") {
    fail("/api/config did not return safe client settings.");
  }
  assertSecurityHeaders(response, "/api/config");
  pass("/api/config");
}

async function checkAuthStatus(baseUrl) {
  const { response, json } = await getJson(baseUrl, "/api/auth/status");
  if (response.status !== 200) {
    fail("/api/auth/status did not return 200.");
  }
  if (typeof json?.authenticated !== "boolean" || typeof json?.setupRequired !== "boolean") {
    fail("/api/auth/status did not return auth state.");
  }
  assertSecurityHeaders(response, "/api/auth/status");
  pass("/api/auth/status");
}

async function checkDatabaseDiagnostics(baseUrl) {
  const { response, json } = await getJson(baseUrl, "/api/setup/database-diagnostics");
  if (response.status !== 200 || typeof json?.ok !== "boolean") {
    fail("/api/setup/database-diagnostics did not return diagnostic state.");
  }
  if (!json?.target?.host || !json?.target?.database || !json?.target?.user) {
    fail("/api/setup/database-diagnostics is missing database target details.");
  }
  assertSecurityHeaders(response, "/api/setup/database-diagnostics");
  pass(`/api/setup/database-diagnostics ${json.ok ? "connected" : "reported an error"}`);
}

async function checkOriginProtection(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://not-edge-note.invalid"
    },
    body: JSON.stringify({ password: "not-the-real-password" }),
    redirect: "manual"
  });

  if (response.status !== 403) {
    fail("Production origin protection did not reject a cross-origin write request.");
  }
  assertSecurityHeaders(response, "/api/auth/login");
  pass("cross-origin write rejection");
}

async function main() {
  const baseUrl = targetUrl();
  console.log(`Running EDGE Note production smoke test against ${baseUrl}`);

  await checkHealth(baseUrl);
  await checkConfig(baseUrl);
  await checkAuthStatus(baseUrl);
  await checkDatabaseDiagnostics(baseUrl);
  await checkOriginProtection(baseUrl);

  console.log("EDGE Note production smoke test passed.");
}

main().catch((error) => {
  console.error(`Production smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
