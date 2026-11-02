// Browser smoke test using Chrome's native debugging protocol; no test dependency.
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve("dist");
const artifacts = path.resolve("output");
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  const target =
    fs.existsSync(file) && fs.statSync(file).isFile()
      ? file
      : path.join(root, "index.html");
  const ext = path.extname(target);
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".ttf": "font/ttf",
      ".png": "image/png",
    }[ext] || "application/octet-stream",
  );
  fs.createReadStream(target).pipe(res);
});
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, ws;
async function main() {
  await new Promise((r) => server.listen(4173, "127.0.0.1", r));
  const executable =
    process.env.SHOPAFLO_CHROME ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  chrome = spawn(
    executable,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9223",
      "--user-data-dir=" + path.join(artifacts, "browser-profile"),
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let pages;
  for (let i = 0; i < 40; i++) {
    try {
      pages = await (
        await fetch("http://127.0.0.1:9223/json", {
          signal: AbortSignal.timeout(1500),
        })
      ).json();
      break;
    } catch {
      await pause(250);
    }
  }
  if (!pages) throw new Error("Chrome debugging port did not start");
  ws = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let next = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    }
    if (msg.method === "Runtime.exceptionThrown")
      errors.push(
        msg.params.exceptionDetails.text +
          " " +
          (msg.params.exceptionDetails.exception?.description || ""),
      );
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  const body = () => evaluate("document.body.innerText");
  const snapshot = async (name) => {
    const result = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      path.join(artifacts, name + ".png"),
      Buffer.from(result.data, "base64"),
    );
  };
  const click = async (label) => {
    const ok = await evaluate(
      `(()=>{const e=[...document.querySelectorAll('[role="button"],[role="tab"],[aria-label]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}||e.innerText.trim()===${JSON.stringify(label)});if(!e)return false;(e.querySelector('input')||e).click();return true;})()`,
    );
    assert.ok(ok, "Control missing: " + label);
    await pause(350);
  };
  const fill = async (label, value) => {
    const ok = await evaluate(
      `(()=>{const e=[...document.querySelectorAll('input,textarea')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)return false;const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
    );
    assert.ok(ok, "Input missing: " + label);
    await pause(100);
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Page.navigate", { url: "http://127.0.0.1:4173" });
  await pause(3500);
  assert.match(await body(), /Shop live. Discover differently./);
  await snapshot("onboarding");
  await click("Continue");
  assert.match(await body(), /Bid in real time./);
  await click("Continue");
  assert.match(await body(), /Follow the sellers you love./);
  await click("Get Started");
  assert.match(await body(), /Where shopping goes live./);
  await snapshot("welcome");
  await click("Sign In");
  await click("Forgot Password");
  await fill("Email", "alex@example.com");
  await click("Send Reset Link");
  await pause(650);
  assert.match(await body(), /Check your email/);
  await click("Back to Sign In");
  await click("Don't have an account? Sign Up");
  await click("Create Account");
  assert.match(await body(), /Enter your full name/);
  for (const [label, value] of [
    ["Full name", "Demo Collector"],
    ["Username", "demo_collector"],
    ["Email", "collector@example.com"],
    ["Password", "demopass123"],
    ["Confirm password", "demopass123"],
  ])
    await fill(label, value);
  await click("Accept terms");
  await snapshot("signup");
  await click("Create Account");
  await pause(650);
  assert.match(await body(), /One last little step/);
  await snapshot("verification");
  await fill("Verification code", "111111");
  await click("Verify");
  assert.match(await body(), /does not match/);
  await fill("Verification code", "123456");
  await click("Verify");
  await pause(650);
  assert.match(await body(), /BID \$1,500/);
  await click("BID $1,500");
  await click("Confirm $1,500");
  assert.match(await body(), /winning/);
  await pause(3200);
  assert.match(await body(), /outbid/);
  await click("BID $1,700");
  await click("Confirm $1,700");
  await pause(11500);
  assert.match(await body(), /YOU WON/);
  await click("Complete purchase");
  assert.match(await body(), /Shipping address/);
  await click("Continue");
  assert.match(await body(), /Payment method/);
  await click("Continue");
  assert.match(await body(), /Order review/);
  await click("Confirm mock purchase");
  assert.match(await body(), /all yours/i);
  await click("View orders");
  assert.match(await body(), /Processing/);
  assert.match(await body(), /\$1,700/);
  for (const [tab, text] of [
    ["Discover", "Live now"],
    ["Sell", "Your studio"],
    ["Inbox", "Messages"],
    ["Profile", "Your corner"],
  ]) {
    await click(tab);
    assert.ok((await body()).includes(text), "Tab failed: " + tab);
  }
  await click("Saved");
  assert.match(await body(), /Save your next favorite/);
  await click("Back");
  await click("Purchases");
  assert.match(await body(), /SF-1042/);
  await click("Back");
  await click("Sell");
  await click("Create listing");
  assert.match(await body(), /Listing type/);
  await click("Back");
  await click("Schedule show");
  assert.match(await body(), /STEP 1 OF 6/);
  await click("Back");
  await click("Inbox");
  await click("Profile");
  await click("Settings");
  await click("Edit profile");
  await fill("Full name", "Updated Collector");
  await click("Save profile");
  await click("Back");
  assert.match(await body(), /Updated Collector/);
  await click("Settings");
  await click("Payment methods");
  await click("Add demo card");
  await fill("Card nickname", "Travel demo");
  await fill("Last four demo digits", "5555");
  await click("Save demo card");
  assert.match(await body(), /5555/);
  await click("Back");
  await click("Addresses");
  await click("Add address");
  for (const [label, value] of [
    ["Recipient name", "Demo Collector"],
    ["Street address", "456 Demo Street"],
    ["City", "Seattle"],
    ["State", "WA"],
    ["ZIP code", "98101"],
  ])
    await fill(label, value);
  await click("Save address");
  assert.match(await body(), /456 Demo Street/);
  await click("Back");
  await click("Security");
  await click("Verify profile");
  await fill("Verification code", "123456");
  await click("Verify");
  await pause(650);
  assert.match(await body(), /VERIFIED/);
  await click("Back");
  await click("Log out");
  assert.match(await body(), /Where shopping goes live./);
  assert.ok(
    await evaluate('!document.querySelector("[role=tab]")'),
    "Auth gate must hide main tabs",
  );
  await click("Sign In");
  await fill("Email", "alex@example.com");
  await fill("Password", "demopass123");
  await click("Show password");
  assert.ok(
    await evaluate(
      `document.querySelector('input[aria-label="Password"]').type==='text'`,
    ),
  );
  await click("Sign In");
  await pause(650);
  assert.match(await body(), /BID \$1,500/);
  await click("Profile");
  await click("Settings");
  await click("Preview states");
  await click("Loading");
  assert.ok(
    await evaluate(
      `!!document.querySelector('[aria-label="Loading content"]')`,
    ),
  );
  await click("Offline");
  assert.match(await body(), /offline/);
  await click("Discover");
  await click("View Air Jordan 4 Retro");
  assert.match(await body(), /The find/);
  await click("Back");
  await click("Notifications");
  assert.match(await body(), /Activity/);
  await click("Back");
  await click("Inbox");
  await click("Message SneakerVault");
  assert.match(await body(), /Offer · Vintage varsity jacket/);
  await click("Back");
  await click("Discover");
  await click("Sell");
  await click("Schedule show");
  await fill("Show title", "Foundation test show");
  for (let i = 0; i < 5; i++) await click("Continue");
  await click("Schedule show");
  assert.match(await body(), /Foundation test show/);
  await click("Discover");
  await pause(1500);
  const screenshot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    path.join(artifacts, "discover.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  await call("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 667,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await click("Live");
  await pause(500);
  assert.ok(
    await evaluate("document.documentElement.scrollWidth<=320"),
    "Horizontal overflow at 320px",
  );
  const small = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    path.join(artifacts, "live-small.png"),
    Buffer.from(small.data, "base64"),
  );
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(
    "PASS: onboarding, signup, OTP rejection/verification, reset, logout/signin, profiles/settings, local orders/shows, five tabs, bid/outbid/win, checkout, nested routes, states, 320px layout; no runtime exceptions.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    ws?.close();
    chrome?.kill();
    server.close();
  });
