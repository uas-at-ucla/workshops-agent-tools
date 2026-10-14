#!/usr/bin/env node
// UAS Workshops helper for agents that cannot load the MCP server themselves.
// It signs an instructor in through the browser and calls the same MCP tools
// over HTTP. Tokens are kept in a private file and are never printed.
// Requires Node 18+; no dependencies.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MCP_URL =
  process.env.UAS_WORKSHOPS_MCP_URL || "https://uas.seas.ucla.edu/workshops/mcp";
const DIR =
  process.env.UAS_WORKSHOPS_CONFIG_DIR ||
  path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "uas-workshops",
  );
const CREDENTIALS = path.join(DIR, "credentials.json");
const PENDING = path.join(DIR, "pending.json");
const SCOPE = "openid profile email workshops:edit";
const SIGN_IN_MINUTES = 10;
const SELF = fileURLToPath(import.meta.url);

const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};
const write = (file, value) => {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
};
const remove = (file) => fs.rmSync(file, { force: true });
const fail = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: text.slice(0, 300) };
  }
  return { status: response.status, ok: response.ok, body };
};
const form = (fields) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields),
});

async function discover() {
  const mcp = new URL(MCP_URL);
  const resource = await json(
    new URL("/.well-known/oauth-protected-resource" + mcp.pathname, mcp),
  );
  const issuer = resource.body.authorization_servers?.[0];
  if (!resource.ok || !issuer)
    fail("The workshop server did not describe how to sign in. Try again later.");
  const at = new URL(issuer);
  for (const url of [
    new URL("/.well-known/oauth-authorization-server" + at.pathname, at),
    issuer.replace(/\/$/, "") + "/.well-known/openid-configuration",
  ]) {
    const metadata = await json(url);
    if (metadata.ok && metadata.body.authorization_endpoint)
      return { resource: resource.body.resource || MCP_URL, ...metadata.body };
  }
  fail("Workshop sign-in is temporarily unavailable. Try again later.");
}

const portFree = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(0));
    probe.listen(port, "127.0.0.1", () => {
      const chosen = probe.address().port;
      probe.close(() => resolve(chosen));
    });
  });

function openBrowser(url) {
  let wsl = false;
  try {
    wsl =
      process.platform === "linux" &&
      /microsoft/i.test(fs.readFileSync("/proc/version", "utf8"));
  } catch {}
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32" || wsl
        ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { stdio: "ignore", detached: true });
      child.once("error", () => resolve(false));
      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

const claims = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
};
function save(pending, tokens) {
  const who = claims(tokens.id_token || tokens.access_token);
  write(CREDENTIALS, {
    mcp: MCP_URL,
    client_id: pending.client_id,
    port: pending.port,
    token_endpoint: pending.token_endpoint,
    revocation_endpoint: pending.revocation_endpoint,
    account: who.email || who.preferred_username || who.name || "your account",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expires_at: Date.now() + (Number(tokens.expires_in) || 600) * 1000,
  });
}

async function rpc(token, method, params) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  let text = await response.text();
  if ((response.headers.get("content-type") || "").includes("event-stream"))
    text = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .pop();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: String(text).slice(0, 300) };
  }
  return { status: response.status, body };
}

// Exchange the browser's authorization code and record the outcome for `wait`.
async function finish(pending, callback) {
  const error = callback.searchParams.get("error");
  if (error)
    throw new Error(
      "Sign-in was not completed: " +
        (callback.searchParams.get("error_description") || error),
    );
  if (callback.searchParams.get("state") !== pending.state)
    throw new Error("This sign-in link does not match the current attempt.");
  const tokens = await json(
    pending.token_endpoint,
    form({
      grant_type: "authorization_code",
      client_id: pending.client_id,
      redirect_uri: pending.redirect_uri,
      code: callback.searchParams.get("code") || "",
      code_verifier: pending.verifier,
      resource: pending.resource,
    }),
  );
  if (!tokens.ok || !tokens.body.access_token)
    throw new Error(
      "The sign-in could not be completed. Run `login` again to retry.",
    );
  save(pending, tokens.body);
  const check = await rpc(tokens.body.access_token, "tools/list");
  const account = read(CREDENTIALS).account;
  if (check.status === 403) {
    remove(CREDENTIALS);
    throw new Error(
      `Signed in as ${account}, but that account is not an instructor. ` +
        "Sign in with the instructor account, or ask a maintainer for instructor access.",
    );
  }
  if (check.status !== 200) {
    remove(CREDENTIALS);
    throw new Error("Signed in, but the workshop server refused the session.");
  }
  return account;
}

async function login(args) {
  const manual = args.indexOf("--callback-url");
  if (manual >= 0) {
    const pending = read(PENDING);
    if (!pending?.verifier) fail("No sign-in is in progress. Run `login` first.");
    try {
      const account = await finish(pending, new URL(args[manual + 1] || ""));
      write(PENDING, { status: "done" });
      console.log(`Signed in as ${account} with instructor access.`);
    } catch (e) {
      fail(e.message);
    }
    return;
  }
  const metadata = await discover();
  // Stop a listener left over from an attempt that is still open.
  const earlier = read(PENDING);
  if (earlier?.status === "waiting" && earlier.pid && earlier.expires_at > Date.now()) {
    try {
      process.kill(earlier.pid);
      await sleep(150);
    } catch {}
  }
  const known = read(CREDENTIALS);
  let client_id = known?.mcp === MCP_URL ? known.client_id : null;
  let port = client_id ? await portFree(known.port) : 0;
  if (!port) {
    port = await portFree(0);
    const registered = await json(metadata.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: `UAS Workshops agent helper (${os.hostname()})`,
        redirect_uris: [`http://127.0.0.1:${port}/callback`],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    if (!registered.ok)
      fail(
        registered.status === 429
          ? "Too many sign-in attempts from this network. Wait an hour and try again."
          : "The workshop server could not set up sign-in. Try again later.",
      );
    client_id = registered.body.client_id;
  }
  const verifier = randomBytes(48).toString("base64url");
  const pending = {
    status: "waiting",
    client_id,
    port,
    redirect_uri: `http://127.0.0.1:${port}/callback`,
    verifier,
    state: randomBytes(24).toString("base64url"),
    token_endpoint: metadata.token_endpoint,
    revocation_endpoint: metadata.revocation_endpoint,
    resource: metadata.resource,
    expires_at: Date.now() + SIGN_IN_MINUTES * 60000,
  };
  write(PENDING, pending);
  const url =
    metadata.authorization_endpoint +
    "?" +
    new URLSearchParams({
      response_type: "code",
      client_id,
      redirect_uri: pending.redirect_uri,
      scope: SCOPE,
      state: pending.state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      resource: pending.resource,
    });
  // The listener outlives this command so the agent gets its prompt back.
  const listener = spawn(process.execPath, [SELF, "_listen"], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  listener.unref();
  write(PENDING, { ...pending, pid: listener.pid });
  for (let n = 0; n < 40 && (await portFree(port)); n++) await sleep(50);
  const opened = args.includes("--no-browser") ? false : await openBrowser(url);
  console.log(
    (opened
      ? "Sign-in page opened in the browser:"
      : "Open this link in a browser to sign in:") +
      "\n\n  " +
      url +
      "\n\nTell the instructor to sign in with their instructor account, then run `wait`." +
      `\nThe link is valid for ${SIGN_IN_MINUTES} minutes.` +
      "\nBrowser on another machine? After signing in, pass the address of the page it" +
      "\nends on: `login --callback-url '<address>'`.",
  );
}

function listen() {
  const pending = read(PENDING);
  if (!pending?.verifier) process.exit(1);
  const page = (title, detail) =>
    `<!doctype html><meta charset="utf-8"><title>UAS Workshops</title><body style="font:16px system-ui;background:#111;color:#fff;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:420px;padding:24px"><h1 style="font-size:22px">${title}</h1><p style="color:#d1d5db;line-height:1.6">${detail}</p></div>`;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, pending.redirect_uri);
    if (url.pathname !== "/callback") return res.writeHead(404).end();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    try {
      const account = await finish(pending, url);
      write(PENDING, { status: "done" });
      res.end(
        page(
          "You're signed in",
          `Your agent can now edit UAS workshop drafts as ${account.replace(/[<>&]/g, "")}. You can close this tab.`,
        ),
      );
    } catch (e) {
      write(PENDING, { status: "error", message: e.message });
      res.end(page("Sign-in did not finish", e.message.replace(/[<>&]/g, "")));
    }
    server.close(() => process.exit(0));
  });
  server.on("error", () => {
    write(PENDING, {
      ...pending,
      status: "error",
      message: "Could not listen for the browser. Run `login` again.",
    });
    process.exit(1);
  });
  server.listen(pending.port, "127.0.0.1");
  setTimeout(() => {
    if (read(PENDING)?.status === "waiting")
      write(PENDING, {
        status: "error",
        message: "Nobody signed in before the link expired. Run `login` again.",
      });
    process.exit(0);
  }, pending.expires_at - Date.now());
}

async function wait(args) {
  const at = args.indexOf("--timeout");
  const seconds = at >= 0 ? Number(args[at + 1]) || 300 : 300;
  for (const end = Date.now() + seconds * 1000; Date.now() < end; ) {
    const pending = read(PENDING);
    if (pending?.status === "done" && read(CREDENTIALS))
      return console.log(
        `Signed in as ${read(CREDENTIALS).account} with instructor access.`,
      );
    if (pending?.status === "error") fail(pending.message);
    if (!pending) fail("No sign-in is in progress. Run `login` first.");
    await sleep(1000);
  }
  fail(
    "Still waiting for the instructor to sign in. Run `wait` again, or `login` for a new link.",
    2,
  );
}

async function token() {
  const saved = read(CREDENTIALS);
  if (!saved || saved.mcp !== MCP_URL)
    fail("Not signed in. Run `login`, ask the instructor to sign in, then `wait`.", 3);
  if (saved.expires_at - Date.now() > 30000) return saved.access_token;
  if (saved.refresh_token) {
    const tokens = await json(
      saved.token_endpoint,
      form({
        grant_type: "refresh_token",
        client_id: saved.client_id,
        refresh_token: saved.refresh_token,
      }),
    );
    if (tokens.ok && tokens.body.access_token) {
      write(CREDENTIALS, {
        ...saved,
        access_token: tokens.body.access_token,
        refresh_token: tokens.body.refresh_token || saved.refresh_token,
        expires_at: Date.now() + (Number(tokens.body.expires_in) || 600) * 1000,
      });
      return tokens.body.access_token;
    }
  }
  fail("The sign-in has expired. Run `login`, ask the instructor to sign in, then `wait`.", 3);
}

async function request(method, params) {
  const result = await rpc(await token(), method, params);
  if (result.status === 401)
    fail("The sign-in has expired. Run `login`, ask the instructor to sign in, then `wait`.", 3);
  if (result.status === 403)
    fail("This account no longer has instructor access.", 3);
  if (result.status !== 200 || result.body.error)
    fail(
      "The workshop server rejected the request: " +
        (result.body.error?.message || result.body.message || result.status),
    );
  return result.body.result;
}

async function call(args) {
  const [name, input] = args;
  if (!name) fail("Usage: call <tool> ['<json arguments>' | @file.json | -]");
  let text = input || "{}";
  if (input === "-") text = fs.readFileSync(0, "utf8");
  else if (input?.startsWith("@")) text = fs.readFileSync(input.slice(1), "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("Tool arguments must be one JSON object.");
  }
  const result = await request("tools/call", { name, arguments: parsed });
  const output = (result.content || [])
    .map((part) => part.text ?? "")
    .join("\n");
  if (result.isError) fail(output || "The tool reported an error.");
  console.log(output);
}

const [command, ...args] = process.argv.slice(2);
if (command === "login") await login(args);
else if (command === "_listen") listen();
else if (command === "wait") await wait(args);
else if (command === "call") await call(args);
else if (command === "tools")
  for (const tool of (await request("tools/list")).tools)
    console.log(
      `${tool.name}${tool.annotations?.readOnlyHint ? "" : " (changes data)"}\n  ${tool.description}\n  arguments: ${JSON.stringify(tool.inputSchema?.properties || {})}`,
    );
else if (command === "status") {
  const saved = read(CREDENTIALS);
  if (!saved || saved.mcp !== MCP_URL) fail("Not signed in.", 3);
  await token();
  console.log(`Signed in as ${saved.account}.`);
} else if (command === "guide") {
  // The site serves the current instructions for agents.
  const guide = await fetch(new URL("agent.txt", MCP_URL)).catch(() => null);
  if (!guide?.ok) fail("The instructions could not be loaded. Try again later.");
  console.log(await guide.text());
} else if (command === "logout") {
  // The sign-in can outlive this file by weeks, so end it at the server too.
  const saved = read(CREDENTIALS);
  let revoked = false;
  if (saved?.refresh_token && saved.revocation_endpoint)
    revoked = await json(
      saved.revocation_endpoint,
      form({
        client_id: saved.client_id,
        token: saved.refresh_token,
        token_type_hint: "refresh_token",
      }),
    ).then(
      (r) => r.ok,
      () => false,
    );
  remove(CREDENTIALS);
  remove(PENDING);
  console.log(
    revoked
      ? "Signed out on this machine and ended the sign-in at the workshop server."
      : "Signed out on this machine.",
  );
} else
  console.log(
    [
      "UAS Workshops agent helper",
      "",
      "  login                 open the sign-in page and return immediately",
      "  wait [--timeout 300]  wait until the instructor has signed in",
      "  status                show whether this machine is signed in",
      "  tools                 list the workshop tools and their arguments",
      "  call <tool> [args]    call a tool; args are JSON, @file.json or - for stdin",
      "  guide                 print the instructions for agents",
      "  logout                forget the sign-in on this machine",
    ].join("\n"),
  );
