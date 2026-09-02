import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Mesh,
  type AbstractMesh,
  HighlightLayer,
  ArcRotateCamera,
  TransformNode,
} from "@babylonjs/core";
import { BLOCKS, type Block } from "../data/blocks";

export type Interactable = {
  id: string;
  mesh: AbstractMesh;
  block: Block;
  found: boolean;
  locked: boolean;
  pos: Vector3;
};

export type Vehicle = {
  id: "car" | "bike";
  root: TransformNode;
  mesh: Mesh;
  pos: Vector3;
  rot: number;
  speed: number;
};

export function createScene(engine: Engine, canvas: HTMLCanvasElement) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.04, 0.06, 1);
  scene.collisionsEnabled = true;

  // Camera — we use ArcRotate that will follow character/vehicle
  const camera = new ArcRotateCamera("cam", -Math.PI / 2, 1.1, 9, new Vector3(0, 1, 0), scene);
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 22;
  camera.lowerBetaLimit = 0.15;
  camera.upperBetaLimit = 1.55;
  camera.wheelPrecision = 30;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;
  hemi.groundColor = new Color3(0.12, 0.1, 0.14);

  const dir = new DirectionalLight("dir", new Vector3(-0.6, -1, 0.4), scene);
  dir.intensity = 1.15;
  dir.position = new Vector3(20, 20, 10);

  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = new Color3(0.06, 0.06, 0.09);

  const mat = (color: string, roughness = 0.8, metallic = 0.1) => {
    const m = new PBRMaterial("m-" + color, scene);
    m.albedoColor = Color3.FromHexString(color);
    m.roughness = roughness;
    m.metallic = metallic;
    return m;
  };

  // ── WORLD ──
  // Large ground
  const ground = MeshBuilder.CreateGround("ground", { width: 90, height: 90 }, scene);
  ground.position.y = 0;
  const gMat = new StandardMaterial("gMat", scene);
  gMat.diffuseColor = new Color3(0.08, 0.08, 0.09);
  ground.material = gMat;
  ground.checkCollisions = false;

  // Roads (cross)
  const roadH = MeshBuilder.CreateGround("roadH", { width: 90, height: 6 }, scene);
  roadH.position.y = 0.02;
  roadH.position.z = 0;
  const roadMat = new StandardMaterial("roadMat", scene);
  roadMat.diffuseColor = new Color3(0.13, 0.13, 0.14);
  roadH.material = roadMat;

  const roadV = MeshBuilder.CreateGround("roadV", { width: 6, height: 90 }, scene);
  roadV.position.y = 0.02;
  roadV.position.x = 0;
  roadV.material = roadMat;

  // dashed line
  for (let i = -40; i <= 40; i += 4) {
    const dash = MeshBuilder.CreateBox(`dashH${i}`, { width: 1.8, height: 0.02, depth: 0.1 }, scene);
    dash.position.set(i, 0.04, 0);
    dash.material = mat("#f59e0b", 0.9);
    const dash2 = MeshBuilder.CreateBox(`dashV${i}`, { width: 0.1, height: 0.02, depth: 1.8 }, scene);
    dash2.position.set(0, 0.04, i);
    dash2.material = mat("#f59e0b", 0.9);
  }

  // Sidewalks / city blocks
  const blockPositions: Vector3[] = [
    new Vector3(18, 0, 18), new Vector3(-18, 0, 18),
    new Vector3(18, 0, -18), new Vector3(-18, 0, -18),
    new Vector3(0, 0, 22), new Vector3(0, 0, -22),
  ];
  blockPositions.forEach((pos, idx) => {
    const h = 3 + Math.random() * 4;
    const b = MeshBuilder.CreateBox(`bld${idx}`, { width: 10, height: h, depth: 10 }, scene);
    b.position.set(pos.x, h / 2, pos.z);
    b.material = mat(idx % 2 === 0 ? "#18181e" : "#1c1c24", 0.95);
    // windows
    const win = MeshBuilder.CreateBox(`win${idx}`, { width: 8, height: h * 0.6, depth: 0.05 }, scene);
    win.position.set(pos.x, h / 2 + 0.2, pos.z + 5.02);
    const wm = new StandardMaterial(`wm${idx}`, scene);
    wm.emissiveColor = new Color3(0.15, 0.12, 0.08);
    wm.diffuseColor = new Color3(0.1, 0.1, 0.12);
    win.material = wm;
  });

  // Trees
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
    if (Math.abs(x) < 4 || Math.abs(z) < 4) continue; // avoid roads
    const trunk = MeshBuilder.CreateCylinder(`trunk${i}`, { diameter: 0.35, height: 1.5 }, scene);
    trunk.position.set(x, 0.75, z);
    trunk.material = mat("#2a1f14", 0.9);
    const leaves = MeshBuilder.CreateSphere(`leaves${i}`, { diameter: 1.6 }, scene);
    leaves.position.set(x, 1.9, z);
    const lm = mat("#122612", 0.9);
    lm.albedoColor = new Color3(0.08 + Math.random() * 0.06, 0.18 + Math.random() * 0.08, 0.08);
    leaves.material = lm;
  }

  // ── THE ARCHIVE BUILDING (center, contains escape room) ──
  const archiveW = 14, archiveD = 12;
  const wallH = 4;
  const wallThickness = 0.25;

  // floor inside archive (different color)
  const archiveFloor = MeshBuilder.CreateBox("archiveFloor", { width: archiveW - 0.5, height: 0.15, depth: archiveD - 0.5 }, scene);
  archiveFloor.position.set(0, 0.075, 0);
  archiveFloor.material = mat("#14141a", 0.9);

  // walls (with opening for door at front z = archiveD/2)
  const wallBack = MeshBuilder.CreateBox("wallBack", { width: archiveW, height: wallH, depth: wallThickness }, scene);
  wallBack.position.set(0, wallH / 2, -archiveD / 2);
  wallBack.material = mat("#1a1a22", 0.95);

  const wallLeft = MeshBuilder.CreateBox("wallLeft", { width: wallThickness, height: wallH, depth: archiveD }, scene);
  wallLeft.position.set(-archiveW / 2, wallH / 2, 0);
  wallLeft.material = mat("#1c1c26", 0.95);

  const wallRight = MeshBuilder.CreateBox("wallRight", { width: wallThickness, height: wallH, depth: archiveD }, scene);
  wallRight.position.set(archiveW / 2, wallH / 2, 0);
  wallRight.material = mat("#1c1c26", 0.95);

  // front wall split for doorway
  const doorW = 2.2;
  const frontLeft = MeshBuilder.CreateBox("frontLeft", { width: (archiveW - doorW) / 2, height: wallH, depth: wallThickness }, scene);
  frontLeft.position.set(-(archiveW + doorW) / 4, wallH / 2, archiveD / 2);
  frontLeft.material = mat("#1a1a22", 0.95);
  const frontRight = MeshBuilder.CreateBox("frontRight", { width: (archiveW - doorW) / 2, height: wallH, depth: wallThickness }, scene);
  frontRight.position.set((archiveW + doorW) / 4, wallH / 2, archiveD / 2);
  frontRight.material = mat("#1a1a22", 0.95);
  const frontTop = MeshBuilder.CreateBox("frontTop", { width: doorW, height: wallH - 2.4, depth: wallThickness }, scene);
  frontTop.position.set(0, (wallH + 2.4) / 2, archiveD / 2);
  frontTop.material = mat("#1a1a22", 0.95);

  // door (inside opening, exit)
  const door = MeshBuilder.CreateBox("door", { width: 1.9, height: 2.2, depth: 0.08 }, scene);
  door.position.set(0, 1.1, archiveD / 2 - 0.02);
  const doorMat = mat("#1a120a", 0.8) as PBRMaterial;
  doorMat.albedoColor = new Color3(0.12, 0.08, 0.05);
  door.material = doorMat;
  const doorHandle = MeshBuilder.CreateSphere("doorHandle", { diameter: 0.14 }, scene);
  doorHandle.position.set(0.6, 1.1, archiveD / 2 + 0.06);
  doorHandle.material = mat("#f59e0b", 0.3, 0.8);

  // ── INTERIOR PROPS (same as before but centered) ──
  // Desk
  const deskTop = MeshBuilder.CreateBox("deskTop", { width: 3.2, height: 0.12, depth: 1.6 }, scene);
  deskTop.position.set(-3.2, 0.9, -2.2);
  deskTop.material = mat("#2a1f14", 0.7);
  [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(([ox, oz], idx) => {
    const leg = MeshBuilder.CreateBox(`leg${idx}`, { width: 0.08, height: 0.9, depth: 0.08 }, scene);
    leg.position.set(-3.2 + ox, 0.45, -2.2 + oz);
    leg.material = mat("#1a120a", 0.9);
  });
  const drawer = MeshBuilder.CreateBox("drawer", { width: 1.2, height: 0.28, depth: 0.05 }, scene);
  drawer.position.set(-3.2, 0.72, -1.42);
  drawer.material = mat("#3a2a18", 0.6);
  const drawerHandle = MeshBuilder.CreateBox("handle", { width: 0.4, height: 0.04, depth: 0.02 }, scene);
  drawerHandle.position.set(-3.2, 0.72, -1.38);
  drawerHandle.material = mat("#f59e0b", 0.3, 0.6);
  drawerHandle.parent = drawer;

  const laptopBase = MeshBuilder.CreateBox("laptopBase", { width: 0.9, height: 0.04, depth: 0.6 }, scene);
  laptopBase.position.set(-3.2, 0.98, -2.1);
  laptopBase.material = mat("#0a0a0a", 0.4, 0.2);
  const laptopScreen = MeshBuilder.CreateBox("laptopScreen", { width: 0.9, height: 0.6, depth: 0.04 }, scene);
  laptopScreen.position.set(-3.2, 1.28, -2.38);
  laptopScreen.rotation.x = 0.25;
  const lapMat = mat("#0b0b14", 0.5);
  lapMat.emissiveColor = new Color3(0.08, 0.18, 0.35);
  lapMat.emissiveIntensity = 0.6;
  laptopScreen.material = lapMat;

  // Bookshelf
  const shelf = MeshBuilder.CreateBox("shelf", { width: 2.6, height: 2.2, depth: 0.5 }, scene);
  shelf.position.set(3.6, 1.1, -3.8);
  shelf.material = mat("#1e1a14", 0.85);
  const bookColors = ["#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#e11d48", "#f59e0b", "#8b5cf6"];
  const bookMeshes: Mesh[] = [];
  bookColors.forEach((c, i) => {
    const b = MeshBuilder.CreateBox(`book${i}`, { width: 0.22, height: 0.6, depth: 0.36 }, scene);
    b.position.set(2.75 + i * 0.24, 1.35, -3.78);
    if (i === 6) b.position.y += 0.06;
    b.material = mat(c, 0.7);
    bookMeshes.push(b);
  });
  const bookInteract = bookMeshes[6];

  // Painting
  const paintingFrame = MeshBuilder.CreateBox("paintFrame", { width: 1.6, height: 1.2, depth: 0.06 }, scene);
  paintingFrame.position.set(0.2, 2.0, -5.86);
  paintingFrame.rotation.z = -0.08;
  paintingFrame.material = mat("#2a1f0f", 0.6);
  const painting = MeshBuilder.CreateBox("painting", { width: 1.4, height: 1.0, depth: 0.02 }, scene);
  painting.position.set(0.2, 2.0, -5.82);
  painting.rotation.z = -0.08;
  const paintMat = new StandardMaterial("paintMat", scene);
  paintMat.diffuseColor = new Color3(0.18, 0.12, 0.08);
  paintMat.emissiveColor = new Color3(0.12, 0.08, 0.06);
  painting.material = paintMat;
  const inner = MeshBuilder.CreatePlane("inner", { width: 1.2, height: 0.8 }, scene);
  inner.position.set(0.2, 2.0, -5.80);
  inner.rotation.z = -0.08;
  const innerMat = new StandardMaterial("innerMat", scene);
  innerMat.diffuseColor = new Color3(0.42, 0.32, 0.22);
  inner.material = innerMat;

  // Clock
  const clockBody = MeshBuilder.CreateCylinder("clock", { diameter: 0.7, height: 0.08 }, scene);
  clockBody.rotation.x = Math.PI / 2;
  clockBody.position.set(-5.2, 2.4, -1.2);
  const clockMat = mat("#f5f1e8", 0.5);
  clockMat.emissiveColor = new Color3(0.04, 0.04, 0.03);
  clockBody.material = clockMat;
  const clockRim = MeshBuilder.CreateTorus("rim", { diameter: 0.76, thickness: 0.04 }, scene);
  clockRim.position.set(-5.2, 2.4, -1.16);
  clockRim.rotation.x = Math.PI / 2;
  clockRim.material = mat("#1a1a1a", 0.3, 0.5);
  const handH = MeshBuilder.CreateBox("handH", { width: 0.04, height: 0.22, depth: 0.01 }, scene);
  handH.position.set(-5.2, 2.45, -1.12);
  handH.material = mat("#111", 0.9);
  const handM = MeshBuilder.CreateBox("handM", { width: 0.02, height: 0.3, depth: 0.01 }, scene);
  handM.position.set(-5.2, 2.4, -1.12);
  handM.rotation.z = 0.6;
  handM.material = mat("#111", 0.9);

  // Safe
  const safeBox = MeshBuilder.CreateBox("safeBox", { width: 0.9, height: 0.9, depth: 0.7 }, scene);
  safeBox.position.set(4.8, 0.45, -4.2);
  safeBox.material = mat("#1a1a1a", 0.4, 0.4);
  const safeDoor = MeshBuilder.CreateBox("safeDoor", { width: 0.9, height: 0.9, depth: 0.06 }, scene);
  safeDoor.position.set(4.8, 0.45, -3.82);
  safeDoor.material = mat("#2a2a2a", 0.5, 0.3);
  const safeDial = MeshBuilder.CreateCylinder("dial", { diameter: 0.22, height: 0.04 }, scene);
  safeDial.rotation.x = Math.PI / 2;
  safeDial.position.set(4.8, 0.45, -3.78);
  safeDial.material = mat("#f59e0b", 0.4, 0.7);

  const rug = MeshBuilder.CreateBox("rug", { width: 4, height: 0.02, depth: 3 }, scene);
  rug.position.set(0, 0.02, -0.5);
  const rugMat = new StandardMaterial("rugMat", scene);
  rugMat.diffuseColor = new Color3(0.18, 0.15, 0.12);
  rug.material = rugMat;

  const pot = MeshBuilder.CreateCylinder("pot", { diameter: 0.5, height: 0.5 }, scene);
  pot.position.set(-5.6, 0.25, 2.2);
  pot.material = mat("#2a2218", 0.9);
  const plant = MeshBuilder.CreateSphere("plant", { diameter: 0.7 }, scene);
  plant.position.set(-5.6, 0.75, 2.2);
  plant.scaling.y = 1.4;
  const plantMat2 = mat("#1a2e1a", 0.9);
  plantMat2.albedoColor = new Color3(0.12, 0.22, 0.12);
  plant.material = plantMat2;

  // ── CHARACTER ──
  const charRoot = new TransformNode("charRoot", scene);
  charRoot.position = new Vector3(0, 0.9, 9); // spawn outside front
  const charBody = MeshBuilder.CreateCapsule("charBody", { height: 1.75, radius: 0.32 }, scene);
  charBody.parent = charRoot as any;
  charBody.position.y = 0;
  const charMat = mat("#f59e0b", 0.6, 0.1);
  charMat.emissiveColor = new Color3(0.08, 0.05, 0.01);
  charBody.material = charMat;
  const charHead = MeshBuilder.CreateSphere("charHead", { diameter: 0.5 }, scene);
  charHead.parent = charBody as any;
  charHead.position.y = 0.72;
  const headMat = mat("#fbbf24", 0.6);
  charHead.material = headMat;
  // eyes
  const eyeL = MeshBuilder.CreateSphere("eyeL", { diameter: 0.08 }, scene);
  eyeL.parent = charHead as any;
  eyeL.position.set(-0.12, 0.05, 0.22);
  eyeL.material = mat("#0a0a0a", 0.9);
  const eyeR = MeshBuilder.CreateSphere("eyeR", { diameter: 0.08 }, scene);
  eyeR.parent = charHead as any;
  eyeR.position.set(0.12, 0.05, 0.22);
  eyeR.material = mat("#0a0a0a", 0.9);
  // shadow
  const shadow = MeshBuilder.CreateDisc("shadow", { radius: 0.45 }, scene);
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = -0.88;
  shadow.parent = charRoot as any;
  const sMat = new StandardMaterial("sMat", scene);
  sMat.diffuseColor = new Color3(0, 0, 0);
  sMat.alpha = 0.25;
  shadow.material = sMat;

  // ── VEHICLES ──
  // Car
  const carRoot = new TransformNode("carRoot", scene);
  carRoot.position = new Vector3(12, 0.35, 6);
  carRoot.rotation.y = -Math.PI / 2;
  const carBody = MeshBuilder.CreateBox("carBody", { width: 2.2, height: 0.7, depth: 1.2 }, scene);
  carBody.parent = carRoot as any;
  carBody.position.y = 0.25;
  carBody.material = mat("#dc2626", 0.4, 0.2);
  const carCabin = MeshBuilder.CreateBox("carCabin", { width: 1.1, height: 0.55, depth: 1.1 }, scene);
  carCabin.parent = carBody as any;
  carCabin.position.set(-0.15, 0.55, 0);
  carCabin.material = mat("#0a0a0f", 0.7, 0.1);
  const carMat2 = carCabin.material as PBRMaterial;
  carMat2.emissiveColor = new Color3(0.02, 0.05, 0.1);
  // wheels
  const wheelPos: [number, number][] = [[0.7, 0.55], [0.7, -0.55], [-0.7, 0.55], [-0.7, -0.55]];
  wheelPos.forEach(([x, z], i) => {
    const w = MeshBuilder.CreateCylinder(`carWheel${i}`, { diameter: 0.5, height: 0.22 }, scene);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, -0.15, z);
    w.parent = carBody as any;
    w.material = mat("#0a0a0a", 0.9);
  });
  // bike
  const bikeRoot = new TransformNode("bikeRoot", scene);
  bikeRoot.position = new Vector3(-12, 0.3, 6);
  bikeRoot.rotation.y = Math.PI / 2;
  const bikeFrame = MeshBuilder.CreateBox("bikeFrame", { width: 1.6, height: 0.18, depth: 0.18 }, scene);
  bikeFrame.parent = bikeRoot as any;
  bikeFrame.position.y = 0.45;
  bikeFrame.material = mat("#06b6d4", 0.5, 0.2);
  const bikeSeat = MeshBuilder.CreateBox("bikeSeat", { width: 0.4, height: 0.08, depth: 0.2 }, scene);
  bikeSeat.parent = bikeFrame as any;
  bikeSeat.position.set(-0.35, 0.14, 0);
  bikeSeat.material = mat("#111", 0.9);
  const bikeHandle = MeshBuilder.CreateCylinder("bikeHandle", { diameter: 0.08, height: 0.6 }, scene);
  bikeHandle.rotation.z = Math.PI / 2;
  bikeHandle.parent = bikeFrame as any;
  bikeHandle.position.set(0.65, 0.12, 0);
  bikeHandle.material = mat("#111", 0.9);
  const bikeWheelF = MeshBuilder.CreateTorus("bikeWheelF", { diameter: 0.7, thickness: 0.06 }, scene);
  bikeWheelF.position.set(0.8, 0.15, 0);
  bikeWheelF.parent = bikeRoot as any;
  bikeWheelF.rotation.y = Math.PI / 2;
  bikeWheelF.material = mat("#0a0a0a", 0.9);
  const bikeWheelB = MeshBuilder.CreateTorus("bikeWheelB", { diameter: 0.7, thickness: 0.06 }, scene);
  bikeWheelB.position.set(-0.8, 0.15, 0);
  bikeWheelB.parent = bikeRoot as any;
  bikeWheelB.rotation.y = Math.PI / 2;
  bikeWheelB.material = mat("#0a0a0a", 0.9);

  // Highlight
  const hl = new HighlightLayer("hl", scene);
  hl.blurHorizontalSize = 0.8;
  hl.blurVerticalSize = 0.8;

  const blockById = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
  const interactables: Interactable[] = [
    { id: "desk", mesh: drawer as unknown as AbstractMesh, block: blockById["desk"], found: false, locked: false, pos: new Vector3(-3.2, 0.72, -1.42) },
    { id: "bookshelf", mesh: bookInteract as unknown as AbstractMesh, block: blockById["bookshelf"], found: false, locked: false, pos: new Vector3(3.8, 1.35, -3.78) },
    { id: "painting", mesh: paintingFrame as unknown as AbstractMesh, block: blockById["painting"], found: false, locked: false, pos: new Vector3(0.2, 2.0, -5.86) },
    { id: "clock", mesh: clockBody as unknown as AbstractMesh, block: blockById["clock"], found: false, locked: true, pos: new Vector3(-5.2, 2.4, -1.2) },
    { id: "laptop", mesh: laptopScreen as unknown as AbstractMesh, block: blockById["laptop"], found: false, locked: false, pos: new Vector3(-3.2, 1.28, -2.38) },
    { id: "safe", mesh: safeDoor as unknown as AbstractMesh, block: blockById["safe"], found: false, locked: true, pos: new Vector3(4.8, 0.45, -3.82) },
  ];

  interactables.forEach(it => {
    hl.addMesh(it.mesh as Mesh, Color3.FromHexString(it.block.color));
    it.mesh.isPickable = true;
  });
  // forwarding
  (drawerHandle as any)._interactId = "desk";
  (safeDial as any)._interactId = "safe";
  (painting as any)._interactId = "painting";
  (inner as any)._interactId = "painting";
  (laptopBase as any)._interactId = "laptop";
  (clockRim as any)._interactId = "clock";
  drawerHandle.isPickable = true; safeDial.isPickable = true; painting.isPickable = true; inner.isPickable = true; laptopBase.isPickable = true; clockRim.isPickable = true;
  door.isPickable = true; doorHandle.isPickable = true;

  let t = 0;
  scene.onBeforeRenderObservable.add(() => {
    t += 0.016;
    if (bookInteract) bookInteract.position.y = 1.35 + Math.sin(t * 1.2) * 0.03 + 0.06;
    if (drawer) drawer.position.z = -1.42 + Math.sin(t * 0.8) * 0.012;
    if (safeDial) safeDial.rotation.z = Math.sin(t * 0.5) * 0.05;
    // slow wheel spin hint for vehicles when idle
    bikeWheelF.rotation.x += 0.01;
    bikeWheelB.rotation.x += 0.01;
  });

  const vehicles: Vehicle[] = [
    { id: "car", root: carRoot, mesh: carBody as unknown as Mesh, pos: carRoot.position.clone(), rot: carRoot.rotation.y, speed: 0 },
    { id: "bike", root: bikeRoot, mesh: bikeFrame as unknown as Mesh, pos: bikeRoot.position.clone(), rot: bikeRoot.rotation.y, speed: 0 },
  ];

  return { scene, camera, charRoot, charBody, interactables, door, hl, engine, vehicles, ground };
}
