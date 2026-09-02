import {
  Engine,
  Scene,
  ArcRotateCamera,
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
} from "@babylonjs/core";
import { BLOCKS, type Block } from "../data/blocks";

export type Interactable = {
  id: string;
  mesh: AbstractMesh;
  block: Block;
  found: boolean;
  locked: boolean;
};

export function createScene(engine: Engine, canvas: HTMLCanvasElement) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.04, 0.06, 1);

  // Camera — orbit, limited, game-like
  const camera = new ArcRotateCamera("cam", -Math.PI / 2.2, Math.PI / 2.8, 9, new Vector3(0, 1.2, 0), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 0.8;
  camera.upperBetaLimit = 1.45;
  camera.lowerAlphaLimit = -Math.PI / 1.3;
  camera.upperAlphaLimit = Math.PI / 1.3;
  camera.wheelPrecision = 60;
  camera.panningSensibility = 0;
  camera.useAutoRotationBehavior = false;

  // Lights
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  hemi.groundColor = new Color3(0.1, 0.08, 0.12);

  const dir = new DirectionalLight("dir", new Vector3(-0.6, -1, 0.4), scene);
  dir.intensity = 1.1;
  dir.position = new Vector3(6, 8, 4);

  // Fog-ish
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.03;
  scene.fogColor = new Color3(0.04, 0.04, 0.06);

  // Materials helper
  const mat = (color: string, roughness = 0.8, metallic = 0.1) => {
    const m = new PBRMaterial("m-" + color, scene);
    m.albedoColor = Color3.FromHexString(color);
    m.roughness = roughness;
    m.metallic = metallic;
    return m;
  };

  // Room — floor, walls, ceiling
  const floor = MeshBuilder.CreateBox("floor", { width: 12, height: 0.2, depth: 10 }, scene);
  floor.position.y = -0.1;
  floor.material = mat("#1a1a1f", 0.9);
  const floorMat = floor.material as PBRMaterial;
  floorMat.albedoColor = new Color3(0.12, 0.11, 0.13);

  // walls
  const wallBack = MeshBuilder.CreateBox("wallBack", { width: 12, height: 5, depth: 0.2 }, scene);
  wallBack.position.set(0, 2.5, -5);
  wallBack.material = mat("#141419", 0.95);

  const wallLeft = MeshBuilder.CreateBox("wallLeft", { width: 0.2, height: 5, depth: 10 }, scene);
  wallLeft.position.set(-6, 2.5, 0);
  wallLeft.material = mat("#18181e", 0.95);

  const wallRight = MeshBuilder.CreateBox("wallRight", { width: 0.2, height: 5, depth: 10 }, scene);
  wallRight.position.set(6, 2.5, 0);
  wallRight.material = mat("#18181e", 0.95);

  // subtle wall panels
  for (let i = -1; i <= 1; i++) {
    const p = MeshBuilder.CreateBox(`panel-${i}`, { width: 2.2, height: 2.2, depth: 0.04 }, scene);
    p.position.set(i * 3, 2.2, -4.88);
    const pm = mat("#1e1e26", 0.85);
    pm.emissiveColor = new Color3(0.02, 0.02, 0.03);
    p.material = pm;
  }

  // Desk (left side)
  const deskTop = MeshBuilder.CreateBox("deskTop", { width: 3.2, height: 0.12, depth: 1.6 }, scene);
  deskTop.position.set(-2.2, 0.9, -1.2);
  deskTop.material = mat("#2a1f14", 0.7, 0.0);
  // legs
  [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(([ox, oz], idx) => {
    const leg = MeshBuilder.CreateBox(`leg${idx}`, { width: 0.08, height: 0.9, depth: 0.08 }, scene);
    leg.position.set(-2.2 + ox, 0.45, -1.2 + oz);
    leg.material = mat("#1a120a", 0.9);
  });
  // drawer — interactable 1
  const drawer = MeshBuilder.CreateBox("drawer", { width: 1.2, height: 0.28, depth: 0.05 }, scene);
  drawer.position.set(-2.2, 0.72, -0.42);
  drawer.material = mat("#3a2a18", 0.6);

  const drawerHandle = MeshBuilder.CreateBox("handle", { width: 0.4, height: 0.04, depth: 0.02 }, scene);
  drawerHandle.position.set(-2.2, 0.72, -0.38);
  drawerHandle.material = mat("#f59e0b", 0.3, 0.6);
  drawerHandle.parent = drawer;

  // Laptop on desk — interactable
  const laptopBase = MeshBuilder.CreateBox("laptopBase", { width: 0.9, height: 0.04, depth: 0.6 }, scene);
  laptopBase.position.set(-2.2, 0.98, -1.1);
  laptopBase.material = mat("#0a0a0a", 0.4, 0.2);
  const laptopScreen = MeshBuilder.CreateBox("laptopScreen", { width: 0.9, height: 0.6, depth: 0.04 }, scene);
  laptopScreen.position.set(-2.2, 1.28, -1.38);
  laptopScreen.rotation.x = 0.25;
  const lapMat = mat("#0b0b14", 0.5);
  lapMat.emissiveColor = new Color3(0.08, 0.18, 0.35);
  lapMat.emissiveIntensity = 0.6;
  laptopScreen.material = lapMat;

  // Bookshelf (right wall)
  const shelf = MeshBuilder.CreateBox("shelf", { width: 2.6, height: 2.2, depth: 0.5 }, scene);
  shelf.position.set(3.2, 1.1, -3.8);
  shelf.material = mat("#1e1a14", 0.85);
  // books
  const bookColors = ["#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#e11d48", "#f59e0b", "#8b5cf6"];
  const bookMeshes: Mesh[] = [];
  bookColors.forEach((c, i) => {
    const b = MeshBuilder.CreateBox(`book${i}`, { width: 0.22, height: 0.6, depth: 0.36 }, scene);
    b.position.set(2.35 + i * 0.24, 1.35, -3.78);
    if (i === 6) b.position.y += 0.06; // slightly out
    b.material = mat(c, 0.7);
    bookMeshes.push(b);
  });
  // the glowing book (index 6) is the interactable
  const bookInteract = bookMeshes[6];

  // Painting on back wall — interactable
  const paintingFrame = MeshBuilder.CreateBox("paintFrame", { width: 1.6, height: 1.2, depth: 0.06 }, scene);
  paintingFrame.position.set(0.2, 2.0, -4.86);
  paintingFrame.rotation.z = -0.08; // crooked
  paintingFrame.material = mat("#2a1f0f", 0.6);
  const painting = MeshBuilder.CreateBox("painting", { width: 1.4, height: 1.0, depth: 0.02 }, scene);
  painting.position.set(0.2, 2.0, -4.82);
  painting.rotation.z = -0.08;
  const paintMat = new StandardMaterial("paintMat", scene);
  paintMat.diffuseColor = new Color3(0.18, 0.12, 0.08);
  paintMat.emissiveColor = new Color3(0.12, 0.08, 0.06);
  painting.material = paintMat;
  // subtle inner
  const inner = MeshBuilder.CreatePlane("inner", { width: 1.2, height: 0.8 }, scene);
  inner.position.set(0.2, 2.0, -4.80);
  inner.rotation.z = -0.08;
  const innerMat = new StandardMaterial("innerMat", scene);
  innerMat.diffuseColor = new Color3(0.42, 0.32, 0.22);
  inner.material = innerMat;

  // Clock — interactable (puzzle)
  const clockBody = MeshBuilder.CreateCylinder("clock", { diameter: 0.7, height: 0.08 }, scene);
  clockBody.rotation.x = Math.PI / 2;
  clockBody.position.set(-4.2, 2.4, -2.0);
  clockBody.rotation.z = 0;
  const clockMat = mat("#f5f1e8", 0.5);
  clockMat.emissiveColor = new Color3(0.04, 0.04, 0.03);
  clockBody.material = clockMat;
  const clockRim = MeshBuilder.CreateTorus("rim", { diameter: 0.76, thickness: 0.04 }, scene);
  clockRim.position.set(-4.2, 2.4, -1.96);
  clockRim.rotation.x = Math.PI / 2;
  clockRim.material = mat("#1a1a1a", 0.3, 0.5);
  // hands
  const handH = MeshBuilder.CreateBox("handH", { width: 0.04, height: 0.22, depth: 0.01 }, scene);
  handH.position.set(-4.2, 2.45, -1.92);
  handH.material = mat("#111", 0.9);
  const handM = MeshBuilder.CreateBox("handM", { width: 0.02, height: 0.3, depth: 0.01 }, scene);
  handM.position.set(-4.2, 2.4, -1.92);
  handM.rotation.z = 0.6;
  handM.material = mat("#111", 0.9);

  // Safe (back right corner) — interactable puzzle
  const safeBox = MeshBuilder.CreateBox("safeBox", { width: 0.9, height: 0.9, depth: 0.7 }, scene);
  safeBox.position.set(4.2, 0.45, -3.6);
  safeBox.material = mat("#1a1a1a", 0.4, 0.4);
  const safeDoor = MeshBuilder.CreateBox("safeDoor", { width: 0.9, height: 0.9, depth: 0.06 }, scene);
  safeDoor.position.set(4.2, 0.45, -3.22);
  safeDoor.material = mat("#2a2a2a", 0.5, 0.3);
  const safeDial = MeshBuilder.CreateCylinder("dial", { diameter: 0.22, height: 0.04 }, scene);
  safeDial.rotation.x = Math.PI / 2;
  safeDial.position.set(4.2, 0.45, -3.18);
  safeDial.material = mat("#f59e0b", 0.4, 0.7);

  // Exit door (front wall)
  const doorFrame = MeshBuilder.CreateBox("doorFrame", { width: 1.4, height: 2.4, depth: 0.12 }, scene);
  doorFrame.position.set(0, 1.2, 4.94);
  doorFrame.material = mat("#0a0a0a", 0.6);
  const door = MeshBuilder.CreateBox("door", { width: 1.2, height: 2.2, depth: 0.06 }, scene);
  door.position.set(0, 1.2, 4.90);
  const doorMat = mat("#1a120a", 0.8) as PBRMaterial;
  doorMat.albedoColor = new Color3(0.12, 0.08, 0.05);
  door.material = doorMat;
  const doorHandle = MeshBuilder.CreateSphere("doorHandle", { diameter: 0.12 }, scene);
  doorHandle.position.set(0.4, 1.2, 4.96);
  doorHandle.material = mat("#f59e0b", 0.3, 0.8);

  // Rug
  const rug = MeshBuilder.CreateBox("rug", { width: 4, height: 0.02, depth: 3 }, scene);
  rug.position.set(0, 0.01, 0.5);
  const rugMat = new StandardMaterial("rugMat", scene);
  rugMat.diffuseColor = new Color3(0.18, 0.15, 0.12);
  rug.material = rugMat;

  // Plant-ish
  const pot = MeshBuilder.CreateCylinder("pot", { diameter: 0.5, height: 0.5 }, scene);
  pot.position.set(-4.8, 0.25, 2.5);
  pot.material = mat("#2a2218", 0.9);
  const plant = MeshBuilder.CreateSphere("plant", { diameter: 0.7 }, scene);
  plant.position.set(-4.8, 0.75, 2.5);
  plant.scaling.y = 1.4;
  const plantMat = mat("#1a2e1a", 0.9);
  plantMat.albedoColor = new Color3(0.12, 0.22, 0.12);
  plant.material = plantMat;

  // Ceiling light
  const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.22 }, scene);
  bulb.position.set(0, 4.2, 0);
  const bulbMat = new StandardMaterial("bulbMat", scene);
  bulbMat.emissiveColor = new Color3(1, 0.9, 0.6);
  bulbMat.diffuseColor = new Color3(1, 1, 0.9);
  bulb.material = bulbMat;
  const bulbLight = new HemisphericLight("bulbHemi", new Vector3(0, -1, 0), scene);
  bulbLight.intensity = 0.35;

  // Highlight layer
  const hl = new HighlightLayer("hl", scene);
  hl.blurHorizontalSize = 0.8;
  hl.blurVerticalSize = 0.8;

  // Map interactables
  const blockById = Object.fromEntries(BLOCKS.map(b => [b.id, b]));

  const interactables: Interactable[] = [
    { id: "desk", mesh: drawer as unknown as AbstractMesh, block: blockById["desk"], found: false, locked: false },
    { id: "bookshelf", mesh: bookInteract as unknown as AbstractMesh, block: blockById["bookshelf"], found: false, locked: false },
    { id: "painting", mesh: paintingFrame as unknown as AbstractMesh, block: blockById["painting"], found: false, locked: false },
    { id: "clock", mesh: clockBody as unknown as AbstractMesh, block: blockById["clock"], found: false, locked: true },
    { id: "laptop", mesh: laptopScreen as unknown as AbstractMesh, block: blockById["laptop"], found: false, locked: false },
    { id: "safe", mesh: safeDoor as unknown as AbstractMesh, block: blockById["safe"], found: false, locked: true },
  ];

  // Add glow to all interactables, stronger pulse for unfound
  interactables.forEach(it => {
    hl.addMesh(it.mesh as Mesh, Color3.FromHexString(it.block.color));
    // make pickable
    it.mesh.isPickable = true;
  });

  // also make related meshes pickable forwarding to same interactable
  // drawer handle click should count as desk
  drawerHandle.isPickable = true;
  (drawerHandle as any)._interactId = "desk";
  safeDial.isPickable = true;
  (safeDial as any)._interactId = "safe";
  painting.isPickable = true;
  (painting as any)._interactId = "painting";
  inner.isPickable = true;
  (inner as any)._interactId = "painting";
  laptopBase.isPickable = true;
  (laptopBase as any)._interactId = "laptop";
  clockRim.isPickable = true;
  (clockRim as any)._interactId = "clock";

  // door is not an interactable block but exit
  door.isPickable = true;
  doorHandle.isPickable = true;

  // gentle floating for hint
  let t = 0;
  scene.onBeforeRenderObservable.add(() => {
    t += 0.016;
    bookInteract.position.y = 1.35 + Math.sin(t * 1.2) * 0.03 + 0.06;
    drawer.position.z = -0.42 + Math.sin(t * 0.8) * 0.015;
    safeDial.rotation.z = Math.sin(t * 0.5) * 0.05;
  });

  return { scene, camera, interactables, door, hl, engine };
}
