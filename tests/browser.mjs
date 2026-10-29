// The built package in a real browser: drive, fire into the page's words, the bases' walls in the
// buttons, hard cover, building, the page's own clicks and fields, pause, game over, the phone stick,
// and Recall giving the page back byte for byte.
// Run after `npm run build`: node tests/browser.mjs (CHROMIUM_PATH picks a browser binary).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
if (!existsSync("dist/index.js")) throw new Error("Build first: npm run build");
const types = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(root, path === "/" ? "tests/fixtures/page.html" : path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const snapshot = (page) => page.evaluate(() => document.documentElement.outerHTML);
const state = (page) => page.evaluate(() => window.game.getSnapshot());
let where = "start";
try {
  where = "play and recall";
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  const before = await snapshot(page);
  await page.evaluate(() => window.launch());
  let s = await state(page);
  assert.equal(s.status, "running");
  assert.equal(await page.locator("[data-fizlet-host=sherman-bytes]").count(), 1, "the scoreboard is on the page");
  assert.equal(s.bases, 2, "the page's two buttons are bases");
  assert.equal(s.barriers, 8, "each base has four walls");
  assert.equal(s.armor, 100);
  // The walls are drawn in the buttons themselves; hard cover is outlined in place.
  await page.waitForFunction(() => document.querySelectorAll("#alpha > [data-fizlet-host=sherman-bytes-art], aside > [data-fizlet-host=sherman-bytes-art]").length === 2);
  // Aim up at the heading and fire: letters turn into bits, points come in.
  const p = s.player;
  await page.mouse.move(p.x, 60);
  await page.keyboard.down("Space");
  await page.waitForTimeout(2000);
  await page.keyboard.up("Space");
  s = await state(page);
  assert.ok(s.score > 0 && s.xp > 0, `scored (${s.score})`);
  assert.match(await page.locator("#board").innerText(), /[01]/, "letters became bits");
  assert.ok(s.board.spent > 0, JSON.stringify(s.board));
  // Drive: the tank moves.
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowLeft");
  assert.ok((await state(page)).player.x < p.x - 20, "drove left");
  // B builds cover ahead of the turret (aim at open ground below): scrap is spent.
  const q = (await state(page)).player;
  await page.mouse.move(q.x, Math.min(780, q.y + 120));
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(900);
  s = await state(page);
  assert.ok(await page.evaluate(() => window.events.includes("build-start")), "B started a build");
  assert.equal(s.cover, 1, "the cover is up");
  // A click on a link does not follow it while playing.
  await page.click("#link");
  assert.ok(!page.url().endsWith("#away"), "links don't navigate while playing");
  // Typing in the page's own field stays the page's.
  await page.click("#field");
  await page.keyboard.type("hi there");
  assert.equal(await page.inputValue("#field"), "hi there");
  await page.locator("#field").blur();
  // Pause and resume (P), then Recall (Escape) gives every letter and button back.
  await page.mouse.move(600, 400);
  await page.keyboard.press("KeyP");
  assert.equal((await state(page)).status, "paused");
  const t = (await state(page)).elapsed;
  await page.waitForTimeout(300);
  assert.equal((await state(page)).elapsed, t, "paused time stands still");
  await page.keyboard.press("KeyP");
  assert.equal((await state(page)).status, "running");
  await page.keyboard.press("Escape");
  assert.equal((await state(page)).status, "idle");
  await page.fill("#field", "");
  assert.equal(await snapshot(page), before, "Recall restores the page exactly");
  assert.deepEqual(errors, []);

  where = "frame time";
  await page.evaluate(() => window.launch());
  await page.mouse.move(640, 200);
  await page.keyboard.down("Space");
  await page.waitForTimeout(6000);
  await page.keyboard.up("Space");
  s = await state(page);
  assert.ok(s.alive > 0, "the first wave came");
  assert.ok(s.frameMs < 4, `average frame work ${s.frameMs.toFixed(2)} ms`);
  assert.ok(s.board.indexed > 0 && s.board.measurements <= 900, JSON.stringify(s.board));
  await page.evaluate(() => window.game.destroy());
  assert.equal(await page.locator("[data-fizlet-host]").count(), 0);
  await page.close();

  where = "game over";
  // An undefended tank: the waves come and wear its armor down.
  const over = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await over.goto(url);
  const bare = await snapshot(over);
  await over.evaluate(() => window.launch({ controls: "keyboard" }));
  await over.waitForFunction(() => window.game.getSnapshot().status === "gameover", null, { timeout: 150000 });
  s = await state(over);
  assert.equal(s.armor, 0);
  assert.match(await over.locator("[data-fizlet-host=sherman-bytes]").evaluate((h) => h.shadowRoot.textContent), /GAME OVER/);
  assert.equal(await over.locator("[data-fizlet-host=sherman-bytes-art]").count(), 0, "the in-page art is gone with the run");
  await over.keyboard.press("Escape");
  assert.equal((await state(over)).status, "idle");
  assert.equal(await snapshot(over), bare, "the page is back after the run ends");
  // A run that fails to start (a bad selector) leaves nothing behind.
  const failed = await over.evaluate(() => {
    try {
      window.launch({ wallSelector: "[[bad" });
      return "started";
    } catch {
      return window.game.getSnapshot().status;
    }
  });
  assert.equal(failed, "idle");
  assert.equal(await snapshot(over), bare, "a failed start changes nothing");
  await over.close();

  where = "phone";
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.goto(url + "?bare");
  await pp.evaluate(() => window.launch());
  const stick = await pp.evaluate(() => {
    const r = document.querySelector("[data-fizlet-host=sherman-bytes]").shadowRoot.querySelector(".bui-stick").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const p0 = (await state(pp)).player;
  const cdp = await phone.newCDPSession(pp);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  let moved = 0;
  for (const [dx, dy] of [[1, 0], [0, -1], [-1, 0], [0, 1]]) {
    await touch("touchStart", stick.x, stick.y);
    for (let k = 1; k <= 6; k++) await touch("touchMove", stick.x + dx * k * 10, stick.y + dy * k * 10);
    await pp.waitForTimeout(400);
    await touch("touchEnd");
    const p1 = (await state(pp)).player;
    moved = Math.max(moved, Math.hypot(p1.x - p0.x, p1.y - p0.y));
  }
  assert.ok(moved > 40, `the stick drives the tank (${moved.toFixed(0)} px)`);
  await phone.close();
  console.log("Sherman Bytes browser: bases and walls, hard cover, firing into the page, driving, building, links and fields, pause, Recall restores exactly, frame time, game over (Escape closes it), failed start leaves nothing, phone stick passed.");
} catch (err) {
  console.error(`browser test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
  server.close();
}
