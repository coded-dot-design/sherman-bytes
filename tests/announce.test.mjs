// The announcer (./src/announce.ts, the fizlet/announce contract): one shared polite region,
// coalesced per key, at most one write per gap, identical text re-announced, timers cleared.
import test from "node:test";
import assert from "node:assert/strict";
import { announcer } from "../src/announce.ts";

/** Just enough of a document: elements with attributes, style, text, append / remove. */
function fakeDoc() {
  const body = { kids: [], append(el) { el.parent = body; body.kids.push(el); } };
  const el = () => ({
    attrs: {}, style: {}, textContent: "", parent: null, writes: 0,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    get isConnected() { return this.parent === body; },
    remove() { body.kids.splice(body.kids.indexOf(this), 1); this.parent = null; },
  });
  return {
    body,
    createElement: () => el(),
    querySelector: (sel) => (sel === "[data-fz-announce]" ? body.kids.find((k) => "data-fz-announce" in k.attrs) ?? null : null),
    get region() { return body.kids.find((k) => "data-fz-announce" in k.attrs); },
  };
}

test("one polite, atomic, visually hidden region, created on the first write", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const doc = fakeDoc(), a = announcer({ doc });
  assert.equal(doc.body.kids.length, 0, "lazy");
  a.say("score", "Score 10");
  const r = doc.region;
  assert.deepEqual(r.attrs, { "data-fz-announce": "", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  assert.match(r.style.cssText, /position:fixed/);
  assert.match(r.style.cssText, /clip-path:inset\(50%\)/);
  assert.doesNotMatch(r.style.cssText, /display:\s*none/);
  assert.equal(r.textContent, "Score 10");
  // A second announcer shares it, and leaves it alone on destroy.
  const b = announcer({ doc });
  t.mock.timers.tick(1000);
  b.say("lives", "Armor 75%");
  assert.equal(doc.body.kids.length, 1);
  b.destroy();
  assert.equal(doc.region, r);
  a.destroy();
  assert.equal(doc.body.kids.length, 0, "the creator removes it");
});

test("rate limited and coalesced: the latest text per key, first-queued order, one write per gap", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const doc = fakeDoc(), a = announcer({ doc, gap: 1 });
  a.say("score", "Score 10"); // written at once
  for (let i = 2; i <= 9; i++) a.say("score", `Score ${i}0`);
  a.say("lives", "Armor 50%");
  a.say("score", "Score 100");
  assert.equal(doc.region.textContent, "Score 10", "nothing more within the gap");
  t.mock.timers.tick(999);
  assert.equal(doc.region.textContent, "Score 10");
  t.mock.timers.tick(1);
  assert.equal(doc.region.textContent, "Score 100. Armor 50%");
  // The next one waits for the gap again.
  a.say("status", "Paused");
  t.mock.timers.tick(500);
  assert.equal(doc.region.textContent, "Score 100. Armor 50%");
  t.mock.timers.tick(500);
  assert.equal(doc.region.textContent, "Paused");
  a.destroy();
});

test("flush writes now; identical text is still re-announced; destroy clears the timer", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const doc = fakeDoc(), a = announcer({ doc });
  a.say("status", "Paused");
  a.say("status", "Paused");
  a.flush();
  assert.equal(doc.region.textContent.trim(), "Paused");
  assert.notEqual(doc.region.textContent, "Paused", "changed, so it is read again");
  t.mock.timers.tick(1000);
  a.say("status", "Paused");
  assert.equal(doc.region.textContent, "Paused");
  a.say("score", "Score 5"); // pending behind the gap
  a.destroy();
  t.mock.timers.tick(5000);
  assert.equal(doc.body.kids.length, 0);
});
