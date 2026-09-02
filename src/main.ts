import "./style.css";
import { Engine, Vector3, SceneLoader, FreeCamera, TransformNode, DefaultRenderingPipeline, SSAO2RenderingPipeline, ColorCurves, Color4 } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { createScene, type Interactable, type Vehicle } from "./game/scene";
import { BLOCKS } from "./data/blocks";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const { scene, charRoot, interactables, door, vehicles, shadowGen } = createScene(engine) as any;

// ── CAMERA: single FreeCamera we position manually ─────────────────────
const camera = new FreeCamera("cam", new Vector3(0, 5, 15), scene);
camera.attachControl(canvas, false); // we handle mouse ourselves
camera.fov = 1.05; // ~60°
camera.minZ = 0.1;

// ── POST-PROCESSING PIPELINE (GTA6 look) ─────────────────────────────
const pipeline = new DefaultRenderingPipeline("pipe", true, scene, [camera]);
pipeline.samples = 4;
pipeline.fxaaEnabled = true;
pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = 1;
pipeline.imageProcessing.exposure = 1.02;
pipeline.imageProcessing.contrast = 1.08;
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.82;
pipeline.bloomWeight = 0.32;
pipeline.bloomKernel = 64;
pipeline.bloomScale = 0.55;
pipeline.chromaticAberrationEnabled = false;
pipeline.grainEnabled = true;
pipeline.grain.intensity = 6;
pipeline.grain.animated = true;
pipeline.sharpenEnabled = true;
pipeline.sharpen.edgeAmount = 0.18;
pipeline.sharpen.colorAmount = 0.9;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 1.4;
pipeline.imageProcessing.vignetteStretch = 0.35;
pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0.55);
pipeline.imageProcessing.vignetteCameraFov = Math.PI / 3.2;

const curves = new ColorCurves();
curves.globalHue = 8;
curves.globalSaturation = 12;
curves.globalDensity = 4;
pipeline.imageProcessing.colorCurvesEnabled = true;
pipeline.imageProcessing.colorCurves = curves;

try {
  const ssao = new SSAO2RenderingPipeline("ssao", scene, 1.0, [camera]);
  ssao.totalStrength = 0.95;
  ssao.radius = 1.8;
  ssao.base = 0.55;
  ssao.maxZ = 50;
  ssao.minZAspect = 0.2;
  // @ts-ignore
  ssao.samples = 16;
} catch {}

// State
let found = new Set<string>();
let hintsUsed = 0;
let hintsLeft = 3;
let startTime = Date.now();
let timerInterval: number | null = null;
let gameStarted = false;

// DOM
const intro = document.getElementById("intro")!;
const startBtn = document.getElementById("startBtn")!;
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
const camLabel = document.getElementById("camLabel")!;
const camBtn = document.getElementById("camBtn")!;
const invertBtn = document.getElementById("invertBtn") as HTMLButtonElement | null;
const invertYBtn = document.getElementById("invertYBtn") as HTMLButtonElement | null;
const interactPrompt = document.getElementById("interactPrompt")!;
const interactText = document.getElementById("interactText")!;

let activeBlockId: string | null = null;
let codeModalOpen = false;

// Camera modes
type CamMode = "third" | "first" | "top" | "orbit";
let camMode: CamMode = "third";
const camNames: Record<CamMode, string> = { third: "THIRD PERSON", first: "FIRST PERSON", top: "TOP DOWN", orbit: "ORBIT" };
function updateCamLabel() {
  camLabel.textContent = camNames[camMode];
}

// Input
const keys = new Map<string, boolean>();
let yaw = Math.PI;       // character horizontal rotation (radians), 0 = +Z, PI = -Z (south)
let pitch = 0;           // camera vertical angle (radians), + = look up
let invertX = false;     // mouse X invert
let invertY = false;     // mouse Y invert
let isPointerLocked = false;

// Character physics
let velY = 0;
let isGrounded = true;
let inVehicle: null | "car" | "bike" = null;
let vehicleYaw = 0;
let vehicleSpeed = 0;

// Target for camera (character head or vehicle)
const camTarget = new TransformNode("camTarget", scene);

// Initial
charRoot.rotation.y = yaw;

// ── Helpers ────────────────────────────────────────────────────────────
function renderInventory() {
  inventoryEl.innerHTML = "";
  BLOCKS.forEach((b) => {
    const isFound = found.has(b.id);
    const div = document.createElement("div");
    div.className = `h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${isFound ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/30"}`;
    div.innerHTML = `<div class="w-7 h-7 rounded-lg flex items-center justify-center text-sm ${isFound ? "bg-black text-white" : "bg-white/10"}" style="${isFound ? `background:${b.color}` : ""}">${isFound ? b.icon : "?"}</div><div class="text-[9px] font-mono tracking-[0.12em] text-center leading-none px-1">${b.kicker.split("—")[1]?.trim() || b.id.toUpperCase()}</div>`;
    if (isFound) { div.classList.add("cursor-pointer", "hover:scale-[1.02]"); div.onclick = () => openBlock(b.id); }
    inventoryEl.appendChild(div);
  });
  foundCountEl.textContent = String(found.size);
  const pct = Math.round((found.size / BLOCKS.length) * 100);
  progressBar.style.width = pct + "%";
  progressText.textContent = pct + "%";
  modalFound.textContent = String(found.size);
  const remaining = BLOCKS.length - found.size;
  if (remaining === 0) {
    promptText.textContent = "All blocks found — return to the exit door and press E to escape!";
    centerPrompt.classList.add("!bg-emerald-500", "!text-black");
    exitBtn.disabled = false;
    exitBtn.classList.remove("bg-zinc-800", "text-white/40", "cursor-not-allowed");
    exitBtn.classList.add("bg-emerald-500", "text-black", "cursor-pointer");
    exitBtn.innerHTML = `<span class="w-2 h-2 rounded-full bg-black animate-pulse"></span> ESCAPE NOW →`;
    exitBtnMobile.disabled = false;
    exitBtnMobile.classList.add("bg-emerald-500", "text-black");
    exitBtnMobile.textContent = "ESCAPE NOW →";
    (door.material as any)?.emissiveColor?.set?.(0.2, 0.6, 0.2);
  } else {
    modalHint.textContent = remaining === 1 ? "One left — check the safe!" : `${remaining} remaining`;
  }
}
function showToast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2400);
}
function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function startTimer() {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = window.setInterval(() => { timerEl.textContent = formatTime(Date.now() - startTime); }, 500);
}
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function distance(a: Vector3, b: Vector3) { return Vector3.Distance(a, b); }

// ── Modal / Blocks ────────────────────────────────────────────────────
function openBlock(id: string) {
  const block = BLOCKS.find((b) => b.id === id)!;
  if (!block) return;
  if (block.puzzle && !found.has(id)) { openCodePrompt(block); return; }
  activeBlockId = id;
  modalKicker.textContent = block.kicker;
  modalTitle.textContent = block.title;
  modalIcon.textContent = block.icon;
  modalIcon.style.background = block.color;
  modalBody.innerHTML = block.html;
  modalMedia.style.background = `linear-gradient(135deg, ${block.color}22, #000)`;
  blockModal.classList.remove("hidden");
  document.exitPointerLock?.();
  if (!found.has(id)) {
    found.add(id);
    renderInventory();
    showToast(`+ ${block.title} discovered`);
    if (found.size >= 3) { const c = interactables.find((i) => i.id === "clock")!; c.locked = false; }
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
      ${block.id === "safe" ? `<p class="mt-2 text-xs text-white/60">Hint: The code is <b class="text-white">0420</b>.</p>` : ""}
    </div>
    <div class="flex gap-2">
      <input id="codeInput" maxlength="4" inputmode="numeric" placeholder="••••" class="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-center tracking-[0.4em] font-mono text-xl placeholder:text-white/20 focus:outline-none focus:border-amber-500" />
      <button id="codeSubmit" class="px-6 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400">Unlock</button>
    </div>
    <div id="codeError" class="hidden text-xs font-mono text-red-400">Wrong code — try again.</div>
  `;
  blockModal.classList.remove("hidden");
  document.exitPointerLock?.();
  codeModalOpen = true;
  setTimeout(() => (document.getElementById("codeInput") as HTMLInputElement)?.focus(), 80);
  document.getElementById("codeSubmit")!.onclick = () => {
    const val = (document.getElementById("codeInput") as HTMLInputElement).value.trim();
    if (val === block.puzzle!.code) {
      codeModalOpen = false;
      blockModal.classList.add("hidden");
      const real = BLOCKS.find((b) => b.id === block.id)!;
      const orig = (real as any).puzzle;
      (real as any).puzzle = undefined;
      openBlock(real.id);
      (real as any).puzzle = orig;
      const it = interactables.find((i) => i.id === block.id)!; it.locked = false;
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
  if (gameStarted && winScreen.classList.contains("hidden")) canvas.requestPointerLock?.();
}
function triggerWin() {
  if (found.size !== BLOCKS.length) { showToast("Find all 6 blocks first — the door is still locked."); return; }
  winTime.textContent = timerEl.textContent || "00:00";
  winHints.textContent = String(hintsUsed);
  winScreen.classList.remove("hidden");
  document.exitPointerLock?.();
  if (timerInterval) window.clearInterval(timerInterval);
}

// ── Interaction / Proximity ───────────────────────────────────────────
function getPlayerPos() { return inVehicle ? vehicles.find(v => v.id === inVehicle)!.root.position : charRoot.position; }
function getNearestInteractable(): Interactable | null {
  const p = getPlayerPos();
  let best: Interactable | null = null; let bestD = 2.4;
  for (const it of interactables) { const d = distance(p, it.pos); if (d < bestD) { bestD = d; best = it; } }
  const doorPos = new Vector3(0, 1.1, 6);
  const dDoor = distance(p, doorPos);
  if (dDoor < 2.8 && dDoor < bestD) {
    return { id: "door", mesh: door as any, block: { id: "door", kicker: "", title: "Exit Door", icon: "🚪", color: "#10b981", excerpt: "", html: "", hint: "" } as any, found: false, locked: found.size !== BLOCKS.length, pos: doorPos };
  }
  return best;
}
function getNearestVehicle(): Vehicle | null {
  if (inVehicle) return null;
  let best: Vehicle | null = null; let bestD = 3.0;
  for (const v of vehicles) { const d = distance(charRoot.position, v.root.position); if (d < bestD) { bestD = d; best = v; } }
  return best;
}
function tryInteract() {
  if (!gameStarted || !blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  const near = getNearestInteractable();
  if (near && near.id === "door") { triggerWin(); return; }
  if (near) {
    if (near.locked && !found.has(near.id) && near.block.puzzle) { openBlock(near.id); return; }
    if (near.locked && !found.has(near.id)) { showToast("Locked — find more clues first"); return; }
    openBlock(near.id); return;
  }
  const veh = getNearestVehicle();
  if (veh) { enterVehicle(veh.id); return; }
  if (inVehicle) { exitVehicle(); }
}
function enterVehicle(id: "car" | "bike") {
  inVehicle = id;
  const v = vehicles.find(x => x.id === id)!;
  vehicleYaw = v.root.rotation.y;
  vehicleSpeed = 0;
  charRoot.setEnabled(false);
  camMode = "third";
  updateCamLabel();
  showToast(`Entered ${id.toUpperCase()} — WASD drive · E exit · SHIFT boost`);
}
function exitVehicle() {
  if (!inVehicle) return;
  const v = vehicles.find(x => x.id === inVehicle)!;
  const offset = new Vector3(Math.cos(vehicleYaw + Math.PI / 2) * 1.6, 0, Math.sin(vehicleYaw + Math.PI / 2) * 1.6);
  charRoot.position.copyFrom(v.root.position.add(offset));
  charRoot.position.y = 0.9;
  charRoot.setEnabled(true);
  yaw = vehicleYaw;
  charRoot.rotation.y = yaw;
  inVehicle = null;
  vehicleSpeed = 0;
  showToast("Exited vehicle");
}

// ── Camera Update: manual chase cam ──────────────────────────────────
function updateCamera() {
  const p = getPlayerPos();
  const isVehicle = !!inVehicle;
  const targetYaw = isVehicle ? vehicleYaw : yaw;
  const camPitch = clamp(pitch, -0.45, 0.6); // look up/down
  const targetHeight = isVehicle ? 0.7 : 1.55; // eye height

  // camTarget follows player with slight lerp
  camTarget.position.copyFrom(p);
  camTarget.position.y += targetHeight;

  if (camMode === "orbit") {
    // free orbit around target - don't override position, just keep target
    return;
  }
  if (camMode === "top") {
    camera.position.set(p.x, 22, p.z);
    camera.setTarget(camTarget.position);
    return;
  }
  if (camMode === "first") {
    // FPS: camera at eyes, looking along yaw+pitch
    const fwd = new Vector3(
      Math.sin(targetYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      Math.cos(targetYaw) * Math.cos(camPitch)
    );
    camera.position.copyFrom(camTarget.position);
    camera.setTarget(camTarget.position.add(fwd.scale(10)));
    return;
  }
  // THIRD PERSON: chase cam behind character
  const dist = isVehicle ? 8.5 : 6.2;
  const heightOffset = isVehicle ? 2.0 : 1.8;
  const backOffset = new Vector3(
    -Math.sin(targetYaw) * dist,
    heightOffset + camPitch * 1.2,
    -Math.cos(targetYaw) * dist
  );
  camera.position.copyFrom(camTarget.position.add(backOffset));
  camera.setTarget(camTarget.position.add(new Vector3(0, camPitch * 1.5, 0)));
}

// ── Vehicle / Character Movement ─────────────────────────────────────
scene.onBeforeRenderObservable.add(() => {
  if (!gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) {
    updateCamera(); return;
  }

  const dt = engine.getDeltaTime() / 16.6;
  const isShift = keys.get("shift") || keys.get("shiftleft") || keys.get("shiftright");

  if (inVehicle) {
    // Vehicle physics
    const v = vehicles.find(x => x.id === inVehicle)!;
    const accel = 0.012 * dt;
    const maxSpeed = (inVehicle === "bike" ? 0.42 : 0.32) * (isShift ? 1.45 : 1) * dt;
    const steerSpeed = 0.032 * dt * (Math.abs(vehicleSpeed) > 0.02 ? 1 : 0.35);

    if (keys.get("w") || keys.get("arrowup")) vehicleSpeed = clamp(vehicleSpeed + accel, -maxSpeed * 0.5, maxSpeed);
    else if (keys.get("s") || keys.get("arrowdown")) vehicleSpeed = clamp(vehicleSpeed - accel, -maxSpeed * 0.5, maxSpeed);
    else vehicleSpeed *= 0.985;

    if (Math.abs(vehicleSpeed) > 0.01) {
      if (keys.get("a") || keys.get("arrowleft")) vehicleYaw -= steerSpeed * Math.sign(vehicleSpeed);
      if (keys.get("d") || keys.get("arrowright")) vehicleYaw += steerSpeed * Math.sign(vehicleSpeed);
    }

    const move = new Vector3(Math.sin(vehicleYaw) * vehicleSpeed, 0, Math.cos(vehicleYaw) * vehicleSpeed);
    v.root.position.addInPlace(move);
    v.root.rotation.y = vehicleYaw;
    v.root.position.x = clamp(v.root.position.x, -42, 42);
    v.root.position.z = clamp(v.root.position.z, -42, 42);
    // keep out of archive
    if (Math.abs(v.root.position.x) < 7.2 && Math.abs(v.root.position.z) < 6.2) {
      v.root.position.addInPlace(move.scale(-1.5));
      vehicleSpeed *= -0.4;
    }
  } else {
    // Character: WASD = strafe relative to YAW only. Mouse = yaw/pitch.
    const w = keys.get("w") || keys.get("arrowup");
    const s = keys.get("s") || keys.get("arrowdown");
    const a = keys.get("a") || keys.get("arrowleft");
    const d = keys.get("d") || keys.get("arrowright");

    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
    let move = new Vector3(0, 0, 0);
    let moving = false;
    if (w) { move.addInPlace(forward); moving = true; }
    if (s) { move.addInPlace(forward.scale(-1)); moving = true; }
    if (a) { move.addInPlace(right.scale(-1)); moving = true; }
    if (d) { move.addInPlace(right); moving = true; }

    if (moving) {
      move.normalize();
      const spd = 0.085 * dt * (isShift ? 1.75 : 1);
      const step = move.scale(spd);
      const next = charRoot.position.add(step);
      next.x = clamp(next.x, -42, 42);
      next.z = clamp(next.z, -42, 42);
      // archive collision (allow doorway)
      const inArch = Math.abs(next.x) < 7 && Math.abs(next.z) < 6;
      const atDoor = Math.abs(next.x) < 1.4 && next.z > 4.2 && next.z < 7;
      if (inArch && !atDoor && Math.abs(charRoot.position.x) < 7 && Math.abs(charRoot.position.z) < 6) {
        charRoot.position.copyFrom(next);
      } else if (inArch && !atDoor) {
        if (atDoor) charRoot.position.copyFrom(next);
      } else {
        charRoot.position.copyFrom(next);
      }
      // bob
      const t = Date.now() * 0.012 * (isShift ? 1.6 : 1);
      charRoot.position.y = 0.9 + Math.abs(Math.sin(t)) * 0.035;
    } else {
      charRoot.position.y = 0.9;
    }
    // Character body rotation follows yaw
    charRoot.rotation.y = yaw;

    // Jump
    if ((keys.get(" ") || keys.get("space")) && isGrounded) { velY = 0.18; isGrounded = false; }
    if (!isGrounded) {
      charRoot.position.y += velY * dt;
      velY -= 0.014 * dt;
      if (charRoot.position.y <= 0.9) { charRoot.position.y = 0.9; velY = 0; isGrounded = true; }
    }
  }

  updateCamera();

  // Interaction prompt
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) {
    interactPrompt.classList.add("hidden");
  } else if (inVehicle) {
    interactPrompt.classList.remove("hidden"); interactText.textContent = "Press E to exit vehicle";
  } else {
    const near = getNearestInteractable();
    const veh = getNearestVehicle();
    if (near) {
      interactPrompt.classList.remove("hidden");
      if (near.id === "door") interactText.textContent = found.size === BLOCKS.length ? "Press E to ESCAPE" : `Door locked — ${BLOCKS.length - found.size} blocks left`;
      else {
        const isFound = found.has(near.id);
        const locked = near.locked && !isFound;
        interactText.textContent = locked ? `${near.block.title} — needs code [E]` : isFound ? `Revisit ${near.block.title} [E]` : `Pick up ${near.block.title} [E]`;
      }
    } else if (veh) {
      interactPrompt.classList.remove("hidden"); interactText.textContent = `Drive ${veh.id.toUpperCase()} [E]`;
    } else {
      interactPrompt.classList.add("hidden");
    }
  }
});

// ── Mouse Look (pointer lock) ────────────────────────────────────────
canvas.addEventListener("click", () => {
  if (!gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  if (camMode !== "orbit") canvas.requestPointerLock?.();
});
document.addEventListener("pointerlockchange", () => { isPointerLocked = document.pointerLockElement === canvas; });
document.addEventListener("mousemove", (e) => {
  if (!isPointerLocked || !gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  const sens = 0.0022;
  const dx = e.movementX * sens;
  const dy = e.movementY * sens * 0.7; // vertical slightly slower
  // STANDARD FPS: right → +yaw (turn right), up → +pitch (look up)
  const yawDelta = invertX ? -dx : dx;
  const pitchDelta = invertY ? dy : -dy; // e.movementY: down = positive, so -dy = up = +pitch
  if (inVehicle) vehicleYaw += yawDelta;
  else { yaw += yawDelta; charRoot.rotation.y = yaw; }
  pitch += pitchDelta;
  pitch = clamp(pitch, -0.45, 0.6);
});
// Touch fallback
let touchStart: { x: number; y: number } | null = null;
canvas.addEventListener("touchstart", (e) => { if (e.touches.length === 1) touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; });
canvas.addEventListener("touchmove", (e) => {
  if (!touchStart || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - touchStart.x;
  const dy = e.touches[0].clientY - touchStart.y;
  if (touchStart.x < window.innerWidth / 2) {
    // left side = move (simulate WASD briefly) — optional
    yaw += dx * 0.003;
    charRoot.rotation.y = yaw;
  } else {
    yaw += dx * 0.003;
    pitch += -dy * 0.0015;
    pitch = clamp(pitch, -0.45, 0.6);
    charRoot.rotation.y = yaw;
  }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  e.preventDefault();
}, { passive: false });
canvas.addEventListener("touchend", () => { touchStart = null; });

// ── Keys ──────────────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.set(k, true);
  if (k === "shift") keys.set("shift", true);
  if (e.code === "Space") keys.set(" ", true);
  if (k === "e") {
    if (!keys.get("_eHandled")) { keys.set("_eHandled", true); tryInteract(); setTimeout(() => keys.set("_eHandled", false), 250); }
  }
  if (k === "i") { invertX = !invertX; updateInvertLabel(); showToast(`Invert X: ${invertX ? "ON" : "OFF"}`); }
  if (k === "y") { invertY = !invertY; updateInvertLabel(); showToast(`Invert Y: ${invertY ? "ON" : "OFF"}`); }
  if (k === "c") {
    const order: CamMode[] = ["third", "first", "top", "orbit"];
    camMode = order[(order.indexOf(camMode) + 1) % order.length];
    updateCamLabel(); showToast(`Camera: ${camNames[camMode]}`);
  }
  if (k === "escape" && !blockModal.classList.contains("hidden")) closeBlock();
  if (k === "h") (hintBtn as HTMLButtonElement).click();
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  keys.set(k, false);
  if (k === "shift") keys.set("shift", false);
  if (e.code === "Space") keys.set(" ", false);
});

function updateInvertLabel() {
  if (invertBtn) { invertBtn.textContent = `INV X: ${invertX ? "ON" : "OFF"}`; invertBtn.classList.toggle("bg-amber-500", invertX); invertBtn.classList.toggle("text-black", invertX); invertBtn.classList.toggle("border-amber-500", invertX); }
  if (invertYBtn) { invertYBtn.textContent = `INV Y: ${invertY ? "ON" : "OFF"}`; invertYBtn.classList.toggle("bg-amber-500", invertY); invertYBtn.classList.toggle("text-black", invertY); invertYBtn.classList.toggle("border-amber-500", invertY); }
}

// Buttons
startBtn.onclick = () => {
  intro.classList.add("hidden"); gameStarted = true; startTime = Date.now(); startTimer();
  canvas.requestPointerLock?.(); updateCamLabel(); updateInvertLabel(); renderInventory();
  showToast("WASD = move · Mouse = look · E = interact · C = camera · I/Y = invert");
};
closeModalBtn.onclick = closeBlock;
modalNextBtn.onclick = closeBlock;
blockModal.addEventListener("click", (e) => { if (e.target === blockModal) closeBlock(); });
exitBtn.onclick = triggerWin;
exitBtnMobile.onclick = triggerWin;
camBtn.onclick = () => { const o: CamMode[] = ["third","first","top","orbit"]; camMode = o[(o.indexOf(camMode)+1)%o.length]; updateCamLabel(); showToast(`Camera: ${camNames[camMode]}`); };
hintBtn.onclick = () => {
  if (hintsLeft <= 0) { showToast("No hints left"); return; }
  const unfound = BLOCKS.filter((b) => !found.has(b.id));
  if (unfound.length === 0) { showToast("All blocks found — go to the door and press E!"); return; }
  hintsLeft--; hintsUsed++; hintCountEl.textContent = String(hintsLeft);
  const target = unfound[Math.floor(Math.random() * unfound.length)];
  const it = interactables.find((i) => i.id === target.id)!;
  showToast(`Hint: ${target.hint}`);
  let c = 0; const iv = window.setInterval(() => { (it.mesh as any).visibility = c % 2 === 0 ? 0.6 : 1; c++; if (c > 6) { (it.mesh as any).visibility = 1; window.clearInterval(iv); } }, 180);
  if (hintsLeft === 0) hintBtn.classList.add("opacity-50", "pointer-events-none");
};
resetBtn.onclick = () => {
  found.clear(); hintsUsed = 0; hintsLeft = 3; hintCountEl.textContent = "3";
  hintBtn.classList.remove("opacity-50", "pointer-events-none");
  interactables.forEach((it) => { if (it.id === "clock" || it.id === "safe") it.locked = true; else it.locked = false; });
  charRoot.position.set(0, 0.9, 9.5); yaw = Math.PI; charRoot.rotation.y = yaw;
  vehicles[0].root.position.set(13.5, 0.42, 7.2); vehicles[0].root.rotation.y = -Math.PI/1.15; vehicleYaw = vehicles[0].root.rotation.y;
  vehicles[1].root.position.set(-14.5, 0.36, 7.8); vehicles[1].root.rotation.y = Math.PI/1.25;
  if (inVehicle) { charRoot.setEnabled(true); inVehicle = null; }
  camMode = "third"; updateCamLabel(); renderInventory(); winScreen.classList.add("hidden"); startTime = Date.now(); showToast("Simulation reset"); if (gameStarted) startTimer();
};
playAgainBtn.onclick = () => { (resetBtn as HTMLButtonElement).click(); winScreen.classList.add("hidden"); startTime = Date.now(); startTimer(); canvas.requestPointerLock?.(); };
viewSiteBtn.onclick = () => { winScreen.classList.add("hidden"); showToast("Roam again — press E on inventory blocks to revisit"); canvas.requestPointerLock?.(); };

window.addEventListener("resize", () => engine.resize());

// ── Load GLB models ──────────────────────────────────────────────────
async function attachModel(root: any, url: string, file: string, scale = 1, yOffset = 0, yawFix = 0) {
  try {
    const res = await SceneLoader.ImportMeshAsync("", url, file, scene);
    const rootMesh = res.meshes[0] as any;
    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    res.meshes.forEach((m: any) => { try { const b = m.getBoundingInfo(); min = Vector3.Minimize(min, b.minimum); max = Vector3.Maximize(max, b.maximum); } catch {} });
    const size = max.subtract(min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const target = root.id === "carRoot" ? 2.55 : 1.9;
    const autoScale = maxDim > 0.01 ? target / maxDim : scale;
    rootMesh.parent = root; rootMesh.position = new Vector3(0, yOffset, 0); rootMesh.rotation.y = yawFix;
    rootMesh.scaling.setAll(autoScale * scale);
    res.meshes.forEach((m: any) => { try { m.receiveShadows = true; shadowGen?.addShadowCaster?.(m, true); } catch {} });
    root.getChildMeshes?.().forEach((c: any) => { if (c.name.startsWith("carBody")||c.name.startsWith("carCabin")||c.name.startsWith("bikeFrame")||c.name.includes("Wheel")) if (c !== rootMesh) c.setEnabled?.(false); });
    showToast(`${root.id === "carRoot" ? "Supercar" : "Sport bike"} loaded`);
    return true;
  } catch (e) { console.warn("Model load failed", url+file, e); return false; }
}
attachModel(vehicles.find(v=>v.id==="car")!.root, "https://threejs.org/examples/models/gltf/", "ferrari.glb", 1.0, 0.18, Math.PI);
attachModel(vehicles.find(v=>v.id==="bike")!.root, "https://cdn.jsdelivr.net/npm/@baidumap/mapv-three@1.7.1/dist/assets/models/twin/REALISTIC/", "MOTORCYCLE.glb", 0.95, 0.12, 0);

renderInventory(); updateCamLabel(); updateInvertLabel();
engine.runRenderLoop(() => scene.render());