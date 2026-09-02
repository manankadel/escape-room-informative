import "./style.css";
import { Engine, Vector3, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { createScene, type Interactable, type Vehicle } from "./game/scene";
import { BLOCKS } from "./data/blocks";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const { scene, camera, charRoot, interactables, door, vehicles, shadowGen } = createScene(engine, canvas) as any;

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
const hoverLabel = document.getElementById("hoverLabel") as HTMLElement | null;
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
  if (hoverLabel) hoverLabel.textContent = `Camera: ${camNames[camMode]}`;
}

// Input — TRUE FPS: mouse right = look right, up = look up
const keys = new Map<string, boolean>();
let mouseX = 0;
let mouseY = 0;
let pitch = 0; // vertical look, positive = look up
let invertX = false; // false = normal (right→right)
let invertY = false; // false = normal (up→up) — WAS inverted before, now fixed
let isPointerLocked = false;

// Character physics
let charYaw = Math.PI; // facing south initially (toward building)
let velY = 0;
let isGrounded = true;
let charSpeed = 0;
let inVehicle: null | "car" | "bike" = null;
let vehicleYaw = 0;
let vehicleSpeed = 0;

// apply initial yaw
charRoot.rotation.y = charYaw;

// ── Load real supercar/bike models (Porsche-level) with fallback ──
async function attachModel(root: any, url: string, file: string, scale = 1, yOffset = 0, yawFix = 0) {
  try {
    const res = await SceneLoader.ImportMeshAsync("", url, file, scene);
    const rootMesh = res.meshes[0] as any;
    // hide placeholders (carBody, etc) near this root if any — find by parent
    // compute bounds to normalize scale
    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    res.meshes.forEach((m: any) => {
      if (!m.getBoundingInfo) return;
      try {
        const b = m.getBoundingInfo();
        const mn = b.minimum, mx = b.maximum;
        min = Vector3.Minimize(min, mn);
        max = Vector3.Maximize(max, mx);
      } catch {}
    });
    const size = max.subtract(min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const target = root.id === "carRoot" ? 2.55 : 1.9;
    const autoScale = maxDim > 0.01 ? target / maxDim : scale;
    rootMesh.parent = root;
    rootMesh.position = new Vector3(0, yOffset, 0);
    rootMesh.rotation.y = yawFix;
    rootMesh.scaling.setAll(autoScale * scale);
    // enable shadows + env
    res.meshes.forEach((m: any) => {
      if (m.material) {
        try { m.receiveShadows = true; } catch {}
      }
      try { shadowGen?.addShadowCaster?.(m, true); } catch {}
    });
    // hide primitive placeholders under same root
    root.getChildMeshes?.().forEach((c: any) => {
      if (c.name.startsWith("carBody") || c.name.startsWith("carCabin") || c.name.startsWith("bikeFrame") || c.name.includes("Wheel") || c.name.includes("carWheel") || c.name.includes("bikeWheel")) {
        // keep wheels? hide only if real model has wheels — hide all placeholders
        if (c !== rootMesh) c.setEnabled?.(false);
      }
    });
    // also hide by name search globally for placeholders near root
    ["carBody","carCabin","carHL","carWheel","bikeFrame","bikeSeat","bikeHandle","bikeWheel","bikeHL"].forEach(n=> {
      scene.meshes.filter((m:any)=> m.name.startsWith(n)).forEach((m:any)=>{ if(m.parent === root || m.parent?.parent === root) m.setEnabled(false); });
    });
    // fallback simple
    showToast(`${root.id === "carRoot" ? "Supercar" : "Sport bike"} loaded — GTA tier!`);
    return true;
  } catch (e) {
    console.warn("Model load failed", url+file, e);
    return false;
  }
}
// Load — do not block game
attachModel(vehicles.find(v=>v.id==="car")!.root, "https://threejs.org/examples/models/gltf/", "ferrari.glb", 1.0, 0.18, Math.PI);
attachModel(vehicles.find(v=>v.id==="bike")!.root, "https://cdn.jsdelivr.net/npm/@baidumap/mapv-three@1.7.1/dist/assets/models/twin/REALISTIC/", "MOTORCYCLE.glb", 0.95, 0.12, 0);

// Fallback: if bike CDN fails, keep our GTA procedural bike (already high-detail) — it stays visible

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

// Modal
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
  camera.detachControl();
  document.exitPointerLock?.();

  if (!found.has(id)) {
    found.add(id);
    renderInventory();
    showToast(`+ ${block.title} discovered`);
    if (found.size >= 3) { const c = interactables.find((i) => i.id === "clock")!; c.locked = false; }
    if (found.size === BLOCKS.length) { /* unlock door */ }
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
  camera.detachControl();
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
  if (gameStarted && winScreen.classList.contains("hidden")) {
    camera.attachControl(canvas, true);
  }
}
function triggerWin() {
  if (found.size !== BLOCKS.length) { showToast("Find all 6 blocks first — the door is still locked."); return; }
  winTime.textContent = timerEl.textContent || "00:00";
  winHints.textContent = String(hintsUsed);
  winScreen.classList.remove("hidden");
  camera.detachControl();
  document.exitPointerLock?.();
  if (timerInterval) window.clearInterval(timerInterval);
}

// Helpers
function distance(a: Vector3, b: Vector3) { return Vector3.Distance(a, b); }
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

// Interaction detection (proximity)
function getNearestInteractable(): Interactable | null {
  let best: Interactable | null = null;
  let bestD = 2.4;
  const p = inVehicle ? vehicles.find(v => v.id === inVehicle)!.root.position : charRoot.position;
  for (const it of interactables) {
    const d = distance(p, it.pos);
    if (d < bestD) { bestD = d; best = it; }
  }
  // door as pseudo-interactable
  const doorPos = new Vector3(0, 1.1, 6);
  const dDoor = distance(p, doorPos);
  if (dDoor < 2.8 && dDoor < bestD) {
    // treat as door interactable via special id
    return { id: "door", mesh: door as any, block: { id: "door", kicker: "", title: "Exit Door", icon: "🚪", color: "#10b981", excerpt: "", html: "", hint: "" } as any, found: false, locked: found.size !== BLOCKS.length, pos: doorPos };
  }
  return best;
}
function getNearestVehicle(): Vehicle | null {
  if (inVehicle) return null;
  let best: Vehicle | null = null;
  let bestD = 3.0;
  for (const v of vehicles) {
    const d = distance(charRoot.position, v.root.position);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

// Try interact (E)
function tryInteract() {
  if (!gameStarted || !blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  // door win
  const near = getNearestInteractable();
  if (near && near.id === "door") {
    triggerWin();
    return;
  }
  if (near) {
    if (near.locked && !found.has(near.id) && near.block.puzzle) { openBlock(near.id); return; }
    if (near.locked && !found.has(near.id)) { showToast("Locked — find more clues first"); return; }
    openBlock(near.id);
    return;
  }
  // vehicle
  const veh = getNearestVehicle();
  if (veh) {
    enterVehicle(veh.id);
    return;
  }
  // if in vehicle, exit
  if (inVehicle) { exitVehicle(); }
}

function enterVehicle(id: "car" | "bike") {
  inVehicle = id;
  const v = vehicles.find(x => x.id === id)!;
  vehicleYaw = v.root.rotation.y;
  vehicleSpeed = 0;
  // hide char
  charRoot.setEnabled(false);
  camMode = "third";
  updateCamLabel();
  showToast(`Entered ${id.toUpperCase()} — WASD to drive · E to exit · SHIFT turbo`);
}

function exitVehicle() {
  if (!inVehicle) return;
  const v = vehicles.find(x => x.id === inVehicle)!;
  // place character beside vehicle
  const offset = new Vector3(Math.cos(vehicleYaw + Math.PI / 2) * 1.6, 0, Math.sin(vehicleYaw + Math.PI / 2) * 1.6);
  charRoot.position.copyFrom(v.root.position.add(offset));
  charRoot.position.y = 0.9;
  charRoot.setEnabled(true);
  charYaw = vehicleYaw;
  charRoot.rotation.y = charYaw;
  inVehicle = null;
  vehicleSpeed = 0;
  showToast("Exited vehicle");
}

// Camera update — with pitch (vertical look) and non-inverted correction
function updateCamera() {
  const targetPos = inVehicle ? vehicles.find(v => v.id === inVehicle)!.root.position : charRoot.position;
  const yaw = inVehicle ? vehicleYaw : charYaw;
  const clampedPitch = Math.max(-0.42, Math.min(0.52, pitch));

  if (camMode === "orbit") {
    camera.setTarget(targetPos.add(new Vector3(0, 1, 0)));
    // in orbit, allow full 360 via pointer lock disabled — don't override
    return;
  }
  if (camMode === "top") {
    camera.setTarget(targetPos);
    camera.radius = 18;
    camera.beta = 0.22 + clampedPitch * 0.22;
    camera.alpha = yaw - Math.PI / 2;
    return;
  }
  if (camMode === "first") {
    const p = inVehicle ? vehicles.find(v => v.id === inVehicle)!.root.position : charRoot.position;
    const eye = p.add(new Vector3(0, inVehicle ? 0.92 : 1.58, 0));
    const fwd = new Vector3(Math.sin(yaw) * Math.cos(clampedPitch), Math.sin(clampedPitch), Math.cos(yaw) * Math.cos(clampedPitch));
    camera.target.copyFrom(eye.add(fwd.scale(5)));
    camera.position.copyFrom(eye);
    camera.beta = 1.35 + clampedPitch * 0.65;
    camera.alpha = yaw - Math.PI / 2;
    camera.radius = 0.7;
    return;
  }
  // third person — GTA chase cam (pitch up = look up = beta increases away from top)
  camera.setTarget(targetPos.add(new Vector3(0, 1.05, 0)));
  camera.radius = inVehicle ? 9.2 : 7.2;
  camera.beta = (inVehicle ? 1.06 : 1.14) + clampedPitch * 0.48;
  camera.alpha = yaw - Math.PI / 2 + mouseX * 0.0042;
}

// Movement loop
scene.onBeforeRenderObservable.add(() => {
  if (!gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) {
    // pause movement
    updateCamera();
    // prompt still update?
    return;
  }

  const dt = engine.getDeltaTime() / 16.6; // ~1 at 60fps
  const isShift = keys.get("shift") || keys.get("shiftleft") || keys.get("shiftright");
  const baseSpeed = 0.085 * dt;
  const sprintMult = 1.75;

  if (inVehicle) {
    // vehicle controls
    const v = vehicles.find(x => x.id === inVehicle)!;
    const accel = 0.012 * dt;
    const maxSpeed = (inVehicle === "bike" ? 0.42 : 0.32) * (isShift ? 1.45 : 1) * dt;
    const steerSpeed = 0.032 * dt * (Math.abs(vehicleSpeed) > 0.02 ? 1 : 0.35);

    const w = keys.get("w") || keys.get("arrowup");
    const s = keys.get("s") || keys.get("arrowdown");
    const a = keys.get("a") || keys.get("arrowleft");
    const d = keys.get("d") || keys.get("arrowright");

    if (w) vehicleSpeed = clamp(vehicleSpeed + accel, -maxSpeed * 0.5, maxSpeed);
    else if (s) vehicleSpeed = clamp(vehicleSpeed - accel, -maxSpeed * 0.5, maxSpeed);
    else vehicleSpeed *= 0.985; // friction

    if (Math.abs(vehicleSpeed) > 0.01) {
      if (a) vehicleYaw -= steerSpeed * Math.sign(vehicleSpeed);
      if (d) vehicleYaw += steerSpeed * Math.sign(vehicleSpeed);
    }

    const move = new Vector3(Math.sin(vehicleYaw) * vehicleSpeed, 0, Math.cos(vehicleYaw) * vehicleSpeed);
    v.root.position.addInPlace(move);
    v.root.rotation.y = vehicleYaw;
    // clamp to world bounds
    v.root.position.x = clamp(v.root.position.x, -42, 42);
    v.root.position.z = clamp(v.root.position.z, -42, 42);
    // simple bounce off archive walls (approx)
    const inArchive = Math.abs(v.root.position.x) < 7.2 && Math.abs(v.root.position.z) < 6.2;
    if (inArchive) {
      // push out
      v.root.position.addInPlace(move.scale(-1.5));
      vehicleSpeed *= -0.4;
    }
  } else {
    // on-foot — TRUE FPS: WASD = character strafe (not camera), mouse = look
    const w = keys.get("w") || keys.get("arrowup");
    const s = keys.get("s") || keys.get("arrowdown");
    const a = keys.get("a") || keys.get("arrowleft");
    const d = keys.get("d") || keys.get("arrowright");
    const forward = new Vector3(Math.sin(charYaw), 0, Math.cos(charYaw));
    const right = new Vector3(Math.sin(charYaw + Math.PI / 2), 0, Math.cos(charYaw + Math.PI / 2));
    let move = new Vector3(0, 0, 0);
    let moving = false;
    if (w) { move.addInPlace(forward); moving = true; }
    if (s) { move.addInPlace(forward.scale(-1)); moving = true; }
    if (a) { move.addInPlace(right.scale(-1)); moving = true; }
    if (d) { move.addInPlace(right); moving = true; }

    if (moving) {
      move.normalize();
      const spd = baseSpeed * (isShift ? sprintMult : 1);
      // bob
      charSpeed = spd;
      const sprint = isShift ? 1.45 : 1;
      const step = move.scale(spd * sprint);
      const next = charRoot.position.add(step);
      // simple world bounds
      next.x = clamp(next.x, -42, 42);
      next.z = clamp(next.z, -42, 42);
      // archive collision — keep doorway open
      const isInArchiveNow = Math.abs(next.x) < 7 && Math.abs(next.z) < 6;
      const isDoorGap = Math.abs(next.x) < 1.4 && next.z > 4.2 && next.z < 7;
      if (isInArchiveNow && !isDoorGap && Math.abs(charRoot.position.x) < 7 && Math.abs(charRoot.position.z) < 6) {
        // inside, allow movement within
        charRoot.position.copyFrom(next);
      } else if (isInArchiveNow && !isDoorGap) {
        // trying to enter through wall — block
        // allow if at door gap
        if (isDoorGap) charRoot.position.copyFrom(next);
        else {
          // slide along wall
        }
      } else {
        charRoot.position.copyFrom(next);
      }
      // footstep bob
      const t = Date.now() * 0.012 * (isShift ? 1.6 : 1);
      charRoot.position.y = 0.9 + Math.abs(Math.sin(t)) * 0.035 * (moving ? 1 : 0);
    } else {
      charSpeed = 0;
      charRoot.position.y = 0.9;
    }
    charRoot.rotation.y = charYaw;

    // gravity / jump
    const wantJump = keys.get(" ") || keys.get("space");
    if (wantJump && isGrounded) {
      velY = 0.18;
      isGrounded = false;
      showToast("Jump!");
    }
    if (!isGrounded) {
      charRoot.position.y += velY * dt;
      velY -= 0.014 * dt;
      if (charRoot.position.y <= 0.9) {
        charRoot.position.y = 0.9;
        velY = 0;
        isGrounded = true;
      }
    }
  }

  updateCamera();

  // Update interact prompt
  const near = getNearestInteractable();
  const veh = getNearestVehicle();
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) {
    interactPrompt.classList.add("hidden");
  } else if (inVehicle) {
    interactPrompt.classList.remove("hidden");
    interactText.textContent = "Press E to exit vehicle";
  } else if (near) {
    interactPrompt.classList.remove("hidden");
    if (near.id === "door") {
      interactText.textContent = found.size === BLOCKS.length ? "Press E to ESCAPE" : `Door locked — ${BLOCKS.length - found.size} blocks left`;
    } else {
      const isFound = found.has(near.id);
      const locked = near.locked && !isFound;
      interactText.textContent = locked ? `${near.block.title} — needs code [E]` : isFound ? `Revisit ${near.block.title} [E]` : `Pick up ${near.block.title} [E]`;
    }
  } else if (veh) {
    interactPrompt.classList.remove("hidden");
    interactText.textContent = `Drive ${veh.id.toUpperCase()} [E]`;
  } else {
    interactPrompt.classList.add("hidden");
  }
});

// Click picking still works as fallback, plus E proximity
scene.onPointerDown = () => {
  if (!gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  // if orbit mode, let camera handle
  if (camMode === "orbit") {
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (!pick?.hit || !pick.pickedMesh) return;
    const mesh: any = pick.pickedMesh;
    let name = mesh.name;
    if (mesh._interactId) name = mesh._interactId;
    if (name === "door" || name === "doorHandle") { triggerWin(); return; }
    const it = interactables.find((x) => x.id === name || x.mesh.name === name);
    if (it) {
      if (it.locked && !found.has(it.id) && it.block.puzzle) openBlock(it.id);
      else if (it.locked && !found.has(it.id)) showToast("Locked — get closer and press E");
      else openBlock(it.id);
    }
  }
};

// Keys
function updateInvertLabel() {
  if (invertBtn) {
    invertBtn.textContent = `INV X: ${invertX ? "ON" : "OFF"}`;
    invertBtn.classList.toggle("bg-amber-500", invertX);
    invertBtn.classList.toggle("text-black", invertX);
    invertBtn.classList.toggle("border-amber-500", invertX);
  }
  if (invertYBtn) {
    invertYBtn.textContent = `INV Y: ${invertY ? "ON" : "OFF"}`;
    invertYBtn.classList.toggle("bg-amber-500", invertY);
    invertYBtn.classList.toggle("text-black", invertY);
    invertYBtn.classList.toggle("border-amber-500", invertY);
  }
}
invertBtn?.addEventListener("click", () => {
  invertX = !invertX;
  updateInvertLabel();
  showToast(`Invert X: ${invertX ? "ON" : "OFF"}`);
});
invertYBtn?.addEventListener("click", () => {
  invertY = !invertY;
  updateInvertLabel();
  showToast(`Invert Y: ${invertY ? "ON" : "OFF"}`);
});
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.set(k, true);
  if (k === "shift") keys.set("shift", true);
  if (e.code === "Space") keys.set(" ", true);
  if (k === "e") {
    if (!keys.get("_eHandled")) {
      keys.set("_eHandled", true);
      tryInteract();
      setTimeout(() => keys.set("_eHandled", false), 250);
    }
  }
  if (k === "i") {
    invertX = !invertX;
    updateInvertLabel();
    showToast(`Invert X: ${invertX ? "ON" : "OFF"}`);
  }
  if (k === "y") {
    invertY = !invertY;
    updateInvertLabel();
    showToast(`Invert Y: ${invertY ? "ON" : "OFF"}`);
  }
  if (k === "c") {
    const order: CamMode[] = ["third", "first", "top", "orbit"];
    const idx = order.indexOf(camMode);
    camMode = order[(idx + 1) % order.length];
    updateCamLabel();
    showToast(`Camera: ${camNames[camMode]}`);
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

// Mouse look (pointer lock)
canvas.addEventListener("click", () => {
  if (!gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  if (camMode !== "orbit") {
    // @ts-ignore
    canvas.requestPointerLock?.();
  }
});
document.addEventListener("pointerlockchange", () => {
  isPointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener("mousemove", (e) => {
  if (!isPointerLocked || !gameStarted) return;
  if (!blockModal.classList.contains("hidden") || !winScreen.classList.contains("hidden")) return;
  const sens = 0.0022; // tighter, less twitch
  const dx = e.movementX * sens;
  const dy = e.movementY * 0.0016;
  const yawDelta = invertX ? -dx : dx;
  const pitchDelta = invertY ? dy : -dy;
  if (inVehicle) {
    vehicleYaw += yawDelta;
  } else {
    charYaw += yawDelta;
    charRoot.rotation.y = charYaw;
  }
  pitch += pitchDelta;
  pitch = clamp(pitch, -0.42, 0.52);
  mouseX += yawDelta * 38;
  mouseX = clamp(mouseX, -54, 54);
  mouseY += pitchDelta * 28;
  setTimeout(() => { mouseX *= 0.90; mouseY *= 0.90; }, 75);
});

// Touch drag for mobile
let touchStart: { x: number; y: number } | null = null;
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});
canvas.addEventListener("touchmove", (e) => {
  if (!touchStart || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - touchStart.x;
  // left half = move, right half = look
  if (touchStart.x < window.innerWidth / 2) {
    // simulate keys? interpret as move
    if (Math.abs(dx) > 18) {
      if (dx > 0) { keys.set("d", true); keys.set("a", false); }
      else { keys.set("a", true); keys.set("d", false); }
      charYaw += dx * 0.001;
    }
  } else {
    charYaw += dx * 0.004;
    charRoot.rotation.y = charYaw;
  }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  e.preventDefault();
}, { passive: false });
canvas.addEventListener("touchend", () => {
  touchStart = null;
  keys.set("a", false); keys.set("d", false);
});

// Buttons
startBtn.onclick = () => {
  intro.classList.add("hidden");
  gameStarted = true;
  startTime = Date.now();
  startTimer();
  camera.attachControl(canvas, true);
  updateCamLabel();
  updateInvertLabel();
  renderInventory();
  showToast("Simulation live — drag to look · WASD move · SHIFT sprint · SPACE jump · E pick/drive — Fixed inverted mouse!");
};
closeModalBtn.onclick = closeBlock;
modalNextBtn.onclick = closeBlock;
blockModal.addEventListener("click", (e) => { if (e.target === blockModal) closeBlock(); });
exitBtn.onclick = triggerWin;
exitBtnMobile.onclick = triggerWin;
camBtn.onclick = () => {
  const order: CamMode[] = ["third", "first", "top", "orbit"];
  camMode = order[(order.indexOf(camMode) + 1) % order.length];
  updateCamLabel();
  showToast(`Camera: ${camNames[camMode]}`);
};
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
  charRoot.position.set(0, 0.9, 9); charYaw = Math.PI; charRoot.rotation.y = charYaw;
  vehicles[0].root.position.set(12, 0.35, 6); vehicles[0].root.rotation.y = -Math.PI / 2; vehicleYaw = vehicles[0].root.rotation.y;
  vehicles[1].root.position.set(-12, 0.3, 6); vehicles[1].root.rotation.y = Math.PI / 2;
  if (inVehicle) { charRoot.setEnabled(true); inVehicle = null; }
  camMode = "third"; updateCamLabel();
  renderInventory(); winScreen.classList.add("hidden"); startTime = Date.now(); showToast("Simulation reset"); if (gameStarted) startTimer();
};
playAgainBtn.onclick = () => { (resetBtn as HTMLButtonElement).click(); winScreen.classList.add("hidden"); startTime = Date.now(); startTimer(); camera.attachControl(canvas, true); };
viewSiteBtn.onclick = () => { winScreen.classList.add("hidden"); showToast("Roam again — press E on any inventory block to revisit"); camera.attachControl(canvas, true); };

window.addEventListener("resize", () => engine.resize());

// Init
renderInventory();
updateCamLabel();
engine.runRenderLoop(() => scene.render());
