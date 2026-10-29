// Zero allocation, in its own process (node --test runs each file alone), so other tests' pages
// don't shape what V8 learns about the step: one battle, as on a real page.
import test from "node:test";
import assert from "node:assert/strict";
import * as W from "../src/world.ts";
import { fixture, glyphRow, script } from "./fixture.mjs";
import { minorGCs } from "./gc.mjs";

test("a busy battle steps without allocating (no minor GC in 20 000 steps)", async () => {
  const t = fixture({ battle: { fortifications: true }, glyphs: glyphRow(400), random: false });
  const each = script(t), s = t.w.s;
  const frames = (n) => {
    for (let k = 0; k < n; k++) {
      each(k);
      if (s[W.OVER]) s[W.OVER] = 0;
      if (t.base.hp <= 0) t.base.hp = 100; // keep the base (and its squads) coming
      t.e.advance(0.02);
    }
  };
  frames(20000); // warm up: the JIT settles
  const gcs = await minorGCs(() => frames(20000));
  assert.ok(t.w.tanks.count > 0 || t.w.s[W.KILLS] > 0, "tanks fought");
  assert.equal(gcs, 0);
});
