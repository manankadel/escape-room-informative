import "./style.css";
import { Engine } from "@babylonjs/core";
import { createScene } from "./game/scene";
import { BLOCKS } from "./data/blocks";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const { scene, camera, interactables, door } = createScene(engine, canvas);

// State
let found = new Set<string>();
let hintsUsed = 0;
let hintsLeft = 3;
let startTime = Date.now();
let timerInterval: number | null = null;
let gameStarted = false;
let hoveredId: string | null = null;

// DOM refs
const intro = document.getElementById("intro")!;
const startBtn = document.getElementById("startBtn")!;
const hud = document.getElementById("hud")!;
const hoverLabel = document.getElementById("hoverLabel")!;
const promptText = document.getElementById("promptText")!;
const foundCountEl = document.getElementById("foundCount")!;
const progressBar = document.getElementById("progressBar")!;
const progressText = document.getElementById("progressText")!;
const inventoryEl = document.getElementById("inventory")!;
const timerEl = document.getElementById("timer")!;
const exitBtn = document.getElementById("exitBtn") as HTMLButtonElement;
const exitBtnMobile = document.getElementById("exitBtnMobile") as HTMLButtonElement;
const hintBtn = document.getElementById("hintBtn")!;
const hintCountEl = document.getElementById("hintCount")!;
const resetBtn = document.getElementById("resetBtn")!;
const toastEl = document.getElementById("toast")!;

const blockModal = document.getElementById("blockModal")!;
const modalKicker = document.getElementById("modalKicker")!;
const modalTitle = document.getElementById("modalTitle")!;
const modalIcon = document.getElementById("modalIcon")!;
const modalBody = document.getElementById("modalBody")!;
const modalMedia = document.getElementById("modalMedia")!;
const modalFound = document.getElementById("modalFound")!;
const modalHint = document.getElementById("modalHint")!;
const closeModalBtn = document.getElementById("closeModal")!;
const modalNextBtn = document.getElementById("modalNext")!;
const centerPrompt = document.getElementById("centerPrompt")!;

const winScreen = document.getElementById("winScreen")!;
const winTime = document.getElementById("winTime")!;
const winHints = document.getElementById("winHints")!;
const playAgainBtn = document.getElementById("playAgain")!;
const viewSiteBtn = document.getElementById("viewSite")!;

let activeBlockId: string | null = null;
let codeModalOpen = false;

// Inventory render
function renderInventory() {
  inventoryEl.innerHTML = "";
  BLOCKS.forEach((b) => {
    const isFound = found.has(b.id);
    const div = document.createElement("div");
    div.className = `h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${isFound ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/30"}`;
    div.innerHTML = `
      <div class="w-7 h-7 rounded-lg flex items-center justify-center text-sm ${isFound ? "bg-black text-white" : "bg-white/10"}" style="${isFound ? `background:${b.color}` : ""}">${isFound ? b.icon : "?"}</div>
      <div class="text-[9px] font-mono tracking-[0.12em] text-center leading-none px-1">${b.kicker.split("—")[1]?.trim() || b.id.toUpperCase()}</div>
    `;
    if (isFound) {
      div.classList.add("cursor-pointer", "hover:scale-[1.02]");
      div.onclick = () => openBlock(b.id);
    }
    inventoryEl.appendChild(div);
  });
  foundCountEl.textContent = String(found.size);
  const pct = Math.round((found.size / BLOCKS.length) * 100);
  progressBar.style.width = pct + "%";
  progressText.textContent = pct + "%";
  modalFound.textContent = String(found.size);

  const remaining = BLOCKS.length - found.size;
  if (remaining === 0) {
    promptText.textContent = "All blocks found — the exit is unlocked! Go to the door.";
    centerPrompt.classList.add("!bg-emerald-500", "!text-black");
    exitBtn.disabled = false;
    exitBtn.classList.remove("bg-zinc-800", "text-white/40", "cursor-not-allowed");
    exitBtn.classList.add("bg-emerald-500", "text-black", "cursor-pointer", "pulse");
    exitBtn.innerHTML = `<span class="w-2 h-2 rounded-full bg-black animate-pulse"></span> ESCAPE NOW →`;
    exitBtnMobile.disabled = false;
    exitBtnMobile.classList.add("bg-emerald-500", "text-black");
    exitBtnMobile.textContent = "ESCAPE NOW →";
    // door glow
    door.material && ((door.material as any).emissiveColor?.set?.(0.2, 0.6, 0.2));
  } else {
    modalHint.textContent = remaining === 1 ? "One left — check the safe!" : `${remaining} remaining`;
  }
}

function showToast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function startTimer() {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = window.setInterval(() => {
    timerEl.textContent = formatTime(Date.now() - startTime);
  }, 500);
}

function openBlock(id: string) {
  const block = BLOCKS.find((b) => b.id === id)!;
  if (!block) return;

  // puzzle check
  if (block.puzzle && !found.has(id)) {
    // need code — show code prompt inside modal
    openCodePrompt(block);
    return;
  }

  activeBlockId = id;
  modalKicker.textContent = block.kicker;
  modalTitle.textContent = block.title;
  modalIcon.textContent = block.icon;
  modalIcon.style.background = block.color;
  modalBody.innerHTML = block.html;
  modalMedia.style.background = `linear-gradient(135deg, ${block.color}22, #000)`;
  blockModal.classList.remove("hidden");
  camera.detachControl();

  if (!found.has(id)) {
    found.add(id);
    renderInventory();
    showToast(`+ ${block.title} discovered`);
    // unlock dependents
    if (found.size >= 3) {
      const clock = interactables.find((i) => i.id === "clock")!;
      clock.locked = false;
    }
    if (found.has("clock") && found.size >= 4) {
      // nothing
    }
    // safe unlocks after 4 found OR clock solved
    if (found.size >= 4) {
      void interactables.find((i) => i.id === "safe")!;
    }
    if (found.size === BLOCKS.length) {
      setTimeout(() => {
        // auto hint door
      }, 800);
    }
  }
}

function openCodePrompt(block: (typeof BLOCKS)[number]) {
  activeBlockId = block.id;
  modalKicker.textContent = block.kicker + " — LOCKED";
  modalTitle.textContent = "Enter the code";
  modalIcon.textContent = "⌘";
  modalIcon.style.background = block.color;
  modalMedia.style.background = `linear-gradient(135deg, ${block.color}22, #000)`;
  modalBody.innerHTML = `
    <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
      <div class="text-xs font-mono tracking-[0.15em] text-amber-400">CLUE</div>
      <p class="mt-1 text-white">${block.puzzle!.clue}</p>
      ${block.id === "safe" ? `<p class="mt-2 text-xs text-white/60">Hint: Check the other blocks. The code is <b class="text-white">0420</b> — but try to solve it first.</p>` : ""}
    </div>
    <div class="flex gap-2">
      <input id="codeInput" maxlength="4" inputmode="numeric" placeholder="••••" class="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-center tracking-[0.4em] font-mono text-xl placeholder:text-white/20 focus:outline-none focus:border-amber-500" />
      <button id="codeSubmit" class="px-6 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400">Unlock</button>
    </div>
    <div id="codeError" class="hidden text-xs font-mono text-red-400">Wrong code — try again.</div>
  `;
  blockModal.classList.remove("hidden");
  camera.detachControl();
  codeModalOpen = true;
  setTimeout(() => (document.getElementById("codeInput") as HTMLInputElement)?.focus(), 100);
  document.getElementById("codeSubmit")!.onclick = () => {
    const val = (document.getElementById("codeInput") as HTMLInputElement).value.trim();
    if (val === block.puzzle!.code) {
      codeModalOpen = false;
      // unlock and open real content
      blockModal.classList.add("hidden");
      // now open real
      const real = BLOCKS.find((b) => b.id === block.id)!;
      // temporarily clear puzzle to allow open
      const orig = real.puzzle;
      (real as any).puzzle = undefined;
      openBlock(real.id);
      (real as any).puzzle = orig;
      // mark locked false
      const it = interactables.find((i) => i.id === block.id)!;
      it.locked = false;
      showToast("Code accepted — block unlocked");
    } else {
      document.getElementById("codeError")!.classList.remove("hidden");
      showToast("Incorrect code");
    }
  };
  document.getElementById("codeInput")!.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (document.getElementById("codeSubmit") as HTMLButtonElement).click();
  });
}

function closeBlock() {
  blockModal.classList.add("hidden");
  codeModalOpen = false;
  activeBlockId = null;
  if (gameStarted) camera.attachControl(canvas, true);
  if (found.size === BLOCKS.length) {
    // keep win check
  }
}

function triggerWin() {
  if (found.size !== BLOCKS.length) {
    showToast("Find all 6 blocks first — the door is still locked.");
    return;
  }
  winTime.textContent = timerEl.textContent || "00:00";
  winHints.textContent = String(hintsUsed);
  winScreen.classList.remove("hidden");
  camera.detachControl();
  if (timerInterval) window.clearInterval(timerInterval);
}

// Picking
scene.onPointerMove = () => {
  const pick = scene.pick(scene.pointerX, scene.pointerY);
  if (pick?.hit && pick.pickedMesh) {
    const mesh: any = pick.pickedMesh;
    let id = mesh.name;
    // remap forwarded
    if (mesh._interactId) id = mesh._interactId;
    // check if door
    if (id === "door" || id === "doorHandle") {
      hoveredId = "door";
      hoverLabel.textContent = found.size === BLOCKS.length ? "Escape →" : "Locked — find all blocks";
      hoverLabel.classList.remove("hidden");
      canvas.style.cursor = "pointer";
      return;
    }
    const it = interactables.find((x) => x.id === id || x.mesh.name === id);
    if (it) {
      hoveredId = it.id;
      const locked = it.locked && !found.has(it.id);
      hoverLabel.textContent = locked ? "Locked — needs code" : `Inspect — ${it.block.title}`;
      hoverLabel.classList.remove("hidden");
      canvas.style.cursor = "pointer";
      return;
    }
  }
  hoveredId = null;
  hoverLabel.classList.add("hidden");
  canvas.style.cursor = "grab";
};

scene.onPointerDown = () => {
  if (blockModal && !blockModal.classList.contains("hidden")) return;
  if (winScreen && !winScreen.classList.contains("hidden")) return;
  if (!gameStarted) return;

  const pick = scene.pick(scene.pointerX, scene.pointerY);
  if (!pick?.hit || !pick.pickedMesh) return;
  const mesh: any = pick.pickedMesh;
  let name = mesh.name;
  if (mesh._interactId) name = mesh._interactId;

  if (name === "door" || name === "doorHandle") {
    triggerWin();
    return;
  }
  const it = interactables.find((x) => x.id === name || x.mesh.name === name);
  if (!it) return;
  if (it.locked && !found.has(it.id) && it.block.puzzle) {
    openBlock(it.id);
  } else if (it.locked && !found.has(it.id)) {
    showToast("Locked — find more clues first");
  } else {
    openBlock(it.id);
  }
};

// Buttons
startBtn.onclick = () => {
  intro.classList.add("hidden");
  gameStarted = true;
  startTime = Date.now();
  startTimer();
  camera.attachControl(canvas, true);
  showToast("Room entered — find the 6 hidden blocks");
};

closeModalBtn.onclick = closeBlock;
modalNextBtn.onclick = closeBlock;
blockModal.addEventListener("click", (e) => {
  if (e.target === blockModal) closeBlock();
});

exitBtn.onclick = triggerWin;
exitBtnMobile.onclick = triggerWin;

hintBtn.onclick = () => {
  if (hintsLeft <= 0) {
    showToast("No hints left");
    return;
  }
  const unfound = BLOCKS.filter((b) => !found.has(b.id));
  if (unfound.length === 0) {
    showToast("All blocks found — go to the door!");
    return;
  }
  hintsLeft--;
  hintsUsed++;
  hintCountEl.textContent = String(hintsLeft);
  const target = unfound[Math.floor(Math.random() * unfound.length)];
  // flash highlight
  const it = interactables.find((i) => i.id === target.id)!;
  const orig = it.mesh.material;
  showToast(`Hint: ${target.hint}`);
  // quick pulse
  let c = 0;
  const iv = window.setInterval(() => {
    (it.mesh as any).visibility = c % 2 === 0 ? 0.6 : 1;
    c++;
    if (c > 6) {
      (it.mesh as any).visibility = 1;
      window.clearInterval(iv);
    }
  }, 180);
  if (hintsLeft === 0) {
    hintBtn.classList.add("opacity-50", "pointer-events-none");
  }
};

resetBtn.onclick = () => {
  found.clear();
  hintsUsed = 0;
  hintsLeft = 3;
  hintCountEl.textContent = "3";
  hintBtn.classList.remove("opacity-50", "pointer-events-none");
  interactables.forEach((it) => {
    if (it.id === "clock" || it.id === "safe") it.locked = true;
    else it.locked = false;
  });
  renderInventory();
  winScreen.classList.add("hidden");
  startTime = Date.now();
  showToast("Room reset");
  if (gameStarted) startTimer();
};

playAgainBtn.onclick = () => {
  resetBtn.click();
  winScreen.classList.add("hidden");
  startTime = Date.now();
  startTimer();
  camera.attachControl(canvas, true);
};

viewSiteBtn.onclick = () => {
  winScreen.classList.add("hidden");
  // open all blocks sequentially? just show inventory hint
  showToast("Click inventory slots to revisit blocks");
  camera.attachControl(canvas, true);
};

// Keyboard
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !blockModal.classList.contains("hidden")) closeBlock();
  if (e.key === "h" || e.key === "H") hintBtn.click();
});

// Resize
window.addEventListener("resize", () => engine.resize());

// Init
renderInventory();
engine.runRenderLoop(() => scene.render());

// Preload hint
setTimeout(() => {
  if (!gameStarted) return;
}, 1000);
