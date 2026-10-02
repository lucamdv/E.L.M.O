import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [url, outputPath, widthText, heightText] = process.argv.slice(2);
const width = Number(widthText);
const height = Number(heightText);

if (!url || !outputPath || !Number.isFinite(width) || !Number.isFinite(height)) {
  throw new Error("Usage: node scripts/capture-responsive.mjs <url> <output> <width> <height>");
}

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9337 + Math.floor(Math.random() * 400);
const profile = path.join(process.env.TEMP ?? ".", `codex-elmo-cdp-${process.pid}`);
const chrome = spawn(chromePath, [
  "--headless=new",
  "--hide-scrollbars",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--use-angle=swiftshader",
  "--no-first-run",
  "--disable-extensions",
  "--disable-background-timer-throttling",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchJson(endpoint, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still initializing.
    }
    await wait(100);
  }
  throw new Error(`Chrome DevTools did not become available at ${endpoint}`);
}

try {
  await fetchJson(`http://127.0.0.1:${port}/json/version`);
  const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!created.ok) throw new Error(`Could not create capture tab: ${created.status}`);
  const target = await created.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let messageId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    messageId += 1;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });

  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 640,
    screenWidth: width,
    screenHeight: height,
  });
  await send("Page.enable");
  await send("Page.navigate", { url });
  const expectedTime = new URL(url).searchParams.get("time");
  for (let attempt = 0; attempt < 48; attempt += 1) {
    await wait(250);
    const ready = await send("Runtime.evaluate", {
      expression: `Boolean(document.querySelector("[role=img]") && ${JSON.stringify(expectedTime)} ? document.body.innerText.includes(${JSON.stringify(expectedTime ?? "")}) : document.readyState === "complete")`,
      returnByValue: true,
    });
    if (ready.result.value) break;
  }
  // Give the lazily loaded WebGL character and its face geometry enough time
  // to settle under SwiftShader before the deterministic validation capture.
  await wait(12000);
  const metrics = await send("Runtime.evaluate", {
    expression: "JSON.stringify({href:location.href,innerWidth,innerHeight,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,orb:document.querySelector('[role=img]')?.getAttribute('aria-label'),preview:document.body.innerText.slice(0,180)})",
    returnByValue: true,
  });
  const capture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(capture.data, "base64"));
  process.stdout.write(`${metrics.result.value}\n${outputPath}\n`);
  socket.close();
} finally {
  chrome.kill("SIGTERM");
  await wait(250);
  if (!chrome.killed) chrome.kill("SIGKILL");
}
