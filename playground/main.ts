import { createShermanBytes } from "../src/index";
let game: ReturnType<typeof createShermanBytes> | undefined;
const status = document.querySelector<HTMLElement>("#status")!;
document.querySelector("#launch")!.addEventListener("click", () => {
  game?.destroy();
  game = createShermanBytes({
    root: "main",
    targetSelector: "[data-base]",
    onState: (state) => {
      status.textContent = `${state.status} · ${state.armor ?? 100}% armor · ${state.captured ?? 0}/${state.bases ?? 0} bases`;
    },
  });
  game.start();
});
document
  .querySelector("#recall")!
  .addEventListener("click", () => game?.destroy());
window.addEventListener("pagehide", () => game?.destroy());
