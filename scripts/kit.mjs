// The Board UI kit CSS (Fizlet's ui brick) this game bakes into its shadow root: only the sections
// it uses (1 tokens, 2 keys, 4 sticker keys, 5 overlay, 8 comms toast, 11 touch pad, 12 readouts),
// minified: the skirmish bar's pause / countdown / result overlays need 4 and 5. The kit's sections
// are self-contained by design; Battlefield's cards and the rest stay out.
import { transform } from "esbuild";
import { readFileSync } from "node:fs";

export const KIT_SECTIONS = [1, 2, 4, 5, 8, 11, 12];
export async function kitCss(file = "vendor/fizlet/ui/board-ui.css") {
  const parts = readFileSync(file, "utf8").split(/(?=\/\* -{10} \d+\. )/);
  const text = parts.filter((p) => KIT_SECTIONS.includes(Number(/^\/\* -{10} (\d+)\./.exec(p)?.[1]))).join("");
  for (const part of [".bui-readouts", ".bui-toast", ".bui-stick", ".bui-arcade", ".bui-overlay", ".bui-sticker-key"])
    if (!text.includes(part)) throw new Error(`board-ui.css sections moved (${part} missing): update KIT_SECTIONS`);
  return (await transform(text, { loader: "css", minify: true })).code;
}
