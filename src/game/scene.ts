import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  CubeTexture,
  Texture,
  Mesh,
  type AbstractMesh,
  HighlightLayer,
  TransformNode,
  ShadowGenerator,
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

export function createScene(engine: Engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.02, 0.03, 0.06, 1);
  scene.collisionsEnabled = true;

  // --- HDR / ENV (GTA6 look) ---
  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
    "https://assets.babylonjs.com/environments/environmentSpecular.env",
    scene
  );
  scene.environmentIntensity = 0.85;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = 1; // ACES
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.imageProcessingConfiguration.contrast = 1.1;

  // Lights — warm sunset + cool fill (GTA golden hour)
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  hemi.groundColor = new Color3(0.08, 0.06, 0.12);
  hemi.diffuse = new Color3(1, 0.96, 0.88);

  const dir = new DirectionalLight("dir", new Vector3(-0.55, -1, 0.35), scene);
  dir.intensity = 2.6;
  dir.position = new Vector3(35, 32, 12);
  dir.shadowMinZ = 1;
  dir.shadowMaxZ = 110;
  dir.diffuse = new Color3(1, 0.92, 0.78);

  const fill = new DirectionalLight("fill", new Vector3(0.6, -0.5, -0.7), scene);
  fill.intensity = 0.55;
  fill.diffuse = new Color3(0.6, 0.7, 1.0);

  // Shadows — 4K PCSS
  const shadowGen = new ShadowGenerator(4096, dir);
  shadowGen.usePercentageCloserFiltering = true;
  shadowGen.filteringQuality = 2;
  shadowGen.bias = 0.0006;
  shadowGen.normalBias = 0.03;
  shadowGen.frustumEdgeFalloff = 0.8;
  (shadowGen as any).useContactHardeningShadow = true;

  // Fog — very subtle aerial
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor = new Color3(0.12, 0.15, 0.22);

  // Post — pipeline (bloom, tonemap, grain, chromatic) — set up in main.ts after camera creation
  // Curves for filmic — set up in main.ts
  // SSAO — set up in main.ts

  // Skybox
  try {
    scene.createDefaultSkybox(scene.environmentTexture!, true, 900, 0.38, true);
    const sky = scene.getMeshByName("hdrSkyBox") as Mesh | null;
    if (sky) {
      const sMat = sky.material as PBRMaterial;
      if (sMat) sMat.microSurface = 0.88;
    }
  } catch {}

  const mat = (color: string, roughness = 0.8, metallic = 0.12) => {
    const m = new PBRMaterial("m-" + color + Math.random().toString(36).slice(2, 6), scene);
    m.albedoColor = Color3.FromHexString(color);
    m.roughness = roughness;
    m.metallic = metallic;
    m.environmentIntensity = 0.95;
    m.clearCoat.isEnabled = metallic > 0.2;
    m.clearCoat.intensity = metallic > 0.2 ? 0.35 : 0;
    m.sheen.isEnabled = roughness < 0.45;
    return m;
  };
  const enableShadows = (m: AbstractMesh) => {
    shadowGen.addShadowCaster(m as Mesh, true);
    m.receiveShadows = true;
  };

  // ── WORLD ──
  const ground = MeshBuilder.CreateGround("ground", { width: 140, height: 140, subdivisions: 2 }, scene);
  ground.position.y = 0;
  const gMat = new PBRMaterial("gMat", scene);
  gMat.albedoColor = new Color3(0.065, 0.068, 0.082);
  gMat.roughness = 0.92;
  gMat.metallic = 0.02;
  gMat.environmentIntensity = 0.7;
  gMat.specularIntensity = 0.2;
  ground.material = gMat;
  ground.receiveShadows = true;

  // Roads — GTA asphalt with slight reflection
  const roadH = MeshBuilder.CreateGround("roadH", { width: 140, height: 7.2 }, scene);
  roadH.position.y = 0.02;
  const roadMat = new PBRMaterial("roadMat", scene);
  roadMat.albedoColor = new Color3(0.095, 0.095, 0.105);
  roadMat.roughness = 0.58;
  roadMat.metallic = 0.02;
  roadMat.environmentIntensity = 0.55;
  roadH.material = roadMat;
  roadH.receiveShadows = true;

  const roadV = MeshBuilder.CreateGround("roadV", { width: 7.2, height: 140 }, scene);
  roadV.position.y = 0.02;
  roadV.material = roadMat;
  roadV.receiveShadows = true;

  // Curbs
  const curbH1 = MeshBuilder.CreateBox("curbH1", { width: 140, height: 0.14, depth: 0.22 }, scene);
  curbH1.position.set(0, 0.08, 3.75);
  curbH1.material = mat("#b8b9be", 0.82, 0.02);
  const curbH2 = curbH1.clone("curbH2"); curbH2.position.z = -3.75;
  const curbV1 = MeshBuilder.CreateBox("curbV1", { width: 0.22, height: 0.14, depth: 140 }, scene);
  curbV1.position.set(3.75, 0.08, 0); curbV1.material = mat("#b8b9be", 0.82);
  const curbV2 = curbV1.clone("curbV2"); curbV2.position.x = -3.75;

  // Dashed lines + street decals
  for (let i = -64; i <= 64; i += 4) {
    const dh = MeshBuilder.CreateBox(`dashH${i}`, { width: 2.0, height: 0.015, depth: 0.14 }, scene);
    dh.position.set(i, 0.045, 0);
    const dm = new StandardMaterial(`dmH${i}`, scene);
    dm.emissiveColor = new Color3(1, 0.78, 0.05);
    dm.diffuseColor = new Color3(1, 0.84, 0.08);
    dh.material = dm;
    const dv = MeshBuilder.CreateBox(`dashV${i}`, { width: 0.14, height: 0.015, depth: 2.0 }, scene);
    dv.position.set(0, 0.045, i);
    dv.material = dm;
  }
  // manhole covers / decals
  [ {x:9,z:9}, {x:-14,z:-11}, {x:18,z:-7} ].forEach((p, i) => {
    const mh = MeshBuilder.CreateCylinder(`mh${i}`, { diameter: 0.95, height: 0.02 }, scene);
    mh.position.set(p.x, 0.035, p.z);
    mh.material = mat("#0e0e10", 0.9, 0.15);
  });

  // Buildings — taller, GTA blocks with parapets & window grids
  const blockDefs: { pos: Vector3; w: number; d: number; h: number; hue: string }[] = [
    { pos: new Vector3(28,0,28), w: 16, d: 14, h: 9.5, hue: "#171820" },
    { pos: new Vector3(-29,0,26), w: 14, d: 18, h: 12, hue: "#1a1c22" },
    { pos: new Vector3(27,0,-27), w: 18, d: 12, h: 7.5, hue: "#1e1f26" },
    { pos: new Vector3(-26,0,-29), w: 15, d: 15, h: 10.2, hue: "#181a20" },
    { pos: new Vector3(0,0,34), w: 12, d: 10, h: 14, hue: "#1b1d24" },
    { pos: new Vector3(0,0,-34), w: 14, d: 10, h: 8, hue: "#1c1e26" },
  ];
  blockDefs.forEach((def, idx) => {
    const b = MeshBuilder.CreateBox(`bld${idx}`, { width: def.w, height: def.h, depth: def.d }, scene);
    b.position.set(def.pos.x, def.h/2, def.pos.z);
    const bm = mat(def.hue, 0.92, 0.04);
    b.material = bm;
    enableShadows(b as unknown as AbstractMesh);
    b.receiveShadows = true;
    // parapet
    const para = MeshBuilder.CreateBox(`para${idx}`, { width: def.w+0.4, height: 0.55, depth: def.d+0.4 }, scene);
    para.position.set(def.pos.x, def.h+0.28, def.pos.z);
    para.material = mat("#0a0a0e", 0.95);
    // windows — 3 floors with emissive grid
    for (let floor = 0; floor < 3; floor++) {
      const y = def.h*0.35 + floor* def.h*0.22;
      const win = MeshBuilder.CreateBox(`win${idx}_${floor}`, { width: def.w*0.78, height: def.h*0.16, depth: 0.06 }, scene);
      win.position.set(def.pos.x, y, def.pos.z + def.d/2 + 0.03);
      const wm = new PBRMaterial(`wm${idx}${floor}`, scene);
      wm.albedoColor = new Color3(0.02,0.02,0.03);
      wm.emissiveColor = new Color3(0.22+Math.random()*0.08, 0.16+Math.random()*0.06, 0.08+Math.random()*0.05);
      wm.emissiveIntensity = 0.55;
      wm.roughness = 0.25;
      wm.metallic = 0.7;
      win.material = wm;
      // light per window
      const wl = new PointLight(`wl${idx}${floor}`, new Vector3(def.pos.x, y, def.pos.z+def.d/2+1.2), scene);
      wl.intensity = 0.6;
      wl.radius = 2.2;
      wl.diffuse = new Color3(1,0.86,0.6);
      wl.range = 9;
    }
  });

  // Street lamps (GTA style)
  const lampPos = [ new Vector3(8,0,8), new Vector3(-8,0,-8), new Vector3(11,0,-5), new Vector3(-11,0,7) ];
  lampPos.forEach((p, i) => {
    const pole = MeshBuilder.CreateCylinder(`pole${i}`, { diameter: 0.12, height: 5 }, scene);
    pole.position.set(p.x, 2.5, p.z);
    pole.material = mat("#0b0b0f", 0.7, 0.2);
    enableShadows(pole as unknown as AbstractMesh);
    const arm = MeshBuilder.CreateBox(`arm${i}`, { width: 0.08, height: 0.06, depth: 0.9 }, scene);
    arm.position.set(p.x, 5.0, p.z+0.42);
    arm.material = mat("#0b0b0f", 0.8);
    const head = MeshBuilder.CreateBox(`head${i}`, { width: 0.42, height: 0.12, depth: 0.42 }, scene);
    head.position.set(p.x, 4.88, p.z+0.88);
    const hm = new StandardMaterial(`hm${i}`, scene);
    hm.emissiveColor = new Color3(1,0.92,0.7);
    hm.diffuseColor = new Color3(0.9,0.9,0.85);
    head.material = hm;
    const lp = new PointLight(`lamp${i}`, new Vector3(p.x, 4.85, p.z+0.88), scene);
    lp.intensity = 1.35;
    lp.radius = 0.6;
    lp.range = 18;
    lp.diffuse = new Color3(1,0.88,0.65);
    lp.shadowMinZ = 0.5; lp.shadowMaxZ = 18;
    // lens flare-ish disc
    const glow = MeshBuilder.CreateDisc(`glow${i}`, { radius: 0.18 }, scene);
    glow.position.set(p.x, 4.82, p.z+0.88);
    glow.rotation.x = Math.PI/2;
    const gm = new StandardMaterial(`gm${i}`, scene);
    gm.emissiveColor = new Color3(1,0.95,0.78);
    gm.diffuseColor = new Color3(1,1,0.9);
    gm.alpha = 0.55;
    glow.material = gm;
  });

  // Trees — better canopies with two-level + shadows
  for (let i=0;i<22;i++) {
    const x = (Math.random()-0.5)*120;
    const z = (Math.random()-0.5)*120;
    if (Math.abs(x)<11 && Math.abs(z)<11) continue;
    if (Math.abs(x)<5 || Math.abs(z)<5) continue;
    const trunk = MeshBuilder.CreateCylinder(`trunk${i}`, { diameter: 0.42, height: 2.1 }, scene);
    trunk.position.set(x,1.05,z);
    const tm = mat("#1e140e", 0.96);
    trunk.material = tm;
    enableShadows(trunk as unknown as AbstractMesh);
    const c1 = MeshBuilder.CreateSphere(`leaves${i}_1`, { diameter: 2.2 }, scene);
    c1.position.set(x,2.6,z);
    c1.scaling.y = 0.92; c1.scaling.x = 1.08;
    const lm1 = new PBRMaterial(`lm1_${i}`, scene);
    lm1.albedoColor = new Color3(0.07,0.16,0.07);
    lm1.roughness = 0.88;
    lm1.subSurface.isTranslucencyEnabled = true;
    lm1.subSurface.translucencyIntensity = 0.22;
    c1.material = lm1;
    enableShadows(c1 as unknown as AbstractMesh);
    c1.receiveShadows = true;
    const c2 = MeshBuilder.CreateSphere(`leaves${i}_2`, { diameter: 1.55 }, scene);
    c2.position.set(x+0.45,2.15,z+0.22);
    c2.material = lm1.clone(`lm2_${i}`) as PBRMaterial;
    const cL = c2.material as PBRMaterial;
    cL.albedoColor = new Color3(0.09,0.20,0.09);
  }

  // ── ARCHIVE (museum-grade, brass + stone) ──
  const archiveW = 14, archiveD = 12, wallH = 4.2;
  const archiveFloor = MeshBuilder.CreateBox("archiveFloor", { width: archiveW-0.5, height: 0.14, depth: archiveD-0.5 }, scene);
  archiveFloor.position.set(0,0.07,0);
  const stoneMat = new PBRMaterial("stoneMat", scene);
  stoneMat.albedoColor = new Color3(0.11,0.105,0.095);
  stoneMat.roughness = 0.82;
  stoneMat.metallic = 0.03;
  stoneMat.bumpTexture = new Texture("https://assets.babylonjs.com/textures/rock.png", scene);
  (stoneMat.bumpTexture as Texture).level = 0.18;
  (stoneMat.bumpTexture as Texture).uScale = 3; (stoneMat.bumpTexture as Texture).vScale = 3;
  archiveFloor.material = stoneMat;
  archiveFloor.receiveShadows = true;

  // brass trim material
  const brass = mat("#8a6a2a", 0.32, 0.72) as PBRMaterial;
  brass.environmentIntensity = 1.15;
  brass.clearCoat.isEnabled = true; brass.clearCoat.intensity = 0.55;

  const wallMat = mat("#111118", 0.92, 0.06) as PBRMaterial;
  wallMat.roughness = 0.94;

  const mkWall = (name:string, w:number,h:number,d:number, pos:Vector3) => {
    const m = MeshBuilder.CreateBox(name, {width:w,height:h,depth:d}, scene);
    m.position.copyFrom(pos);
    m.material = wallMat;
    m.receiveShadows = true;
    enableShadows(m as unknown as AbstractMesh);
    return m;
  };
  mkWall("wallBack", archiveW, wallH, 0.26, new Vector3(0, wallH/2, -archiveD/2));
  mkWall("wallLeft", 0.26, wallH, archiveD, new Vector3(-archiveW/2, wallH/2, 0));
  mkWall("wallRight",0.26, wallH, archiveD, new Vector3(archiveW/2, wallH/2, 0));
  const doorW = 2.35;
  mkWall("frontLeft", (archiveW-doorW)/2, wallH, 0.26, new Vector3(-(archiveW+doorW)/4, wallH/2, archiveD/2));
  mkWall("frontRight",(archiveW-doorW)/2, wallH, 0.26, new Vector3((archiveW+doorW)/4, wallH/2, archiveD/2));
  mkWall("frontTop", doorW, wallH-2.45, 0.26, new Vector3(0,(wallH+2.45)/2, archiveD/2));
  // lintel brass
  const lintel = MeshBuilder.CreateBox("lintel", {width:doorW+0.3, height:0.12, depth:0.32}, scene);
  lintel.position.set(0, 2.46, archiveD/2);
  lintel.material = brass;

  // Door — walnut + brass handle
  const door = MeshBuilder.CreateBox("door", { width: 2.02, height: 2.32, depth: 0.09 }, scene);
  door.position.set(0,1.16,archiveD/2-0.02);
  const doorWalnut = new PBRMaterial("doorWalnut", scene);
  doorWalnut.albedoColor = new Color3(0.14,0.09,0.055);
  doorWalnut.roughness = 0.58;
  doorWalnut.metallic = 0.06;
  doorWalnut.clearCoat.isEnabled = true; doorWalnut.clearCoat.intensity = 0.22;
  door.material = doorWalnut;
  enableShadows(door as unknown as AbstractMesh);
  const dh = MeshBuilder.CreateSphere("doorHandle", { diameter: 0.15 }, scene);
  dh.position.set(0.62,1.16,archiveD/2+0.08);
  dh.material = brass;

  // ── INTERIOR (upgraded PBR, shadows) ──
  const deskTop = MeshBuilder.CreateBox("deskTop", { width: 3.3, height: 0.14, depth: 1.65 }, scene);
  deskTop.position.set(-3.2,0.9,-2.2);
  const deskWood = new PBRMaterial("deskWood", scene);
  deskWood.albedoColor = new Color3(0.22,0.14,0.08);
  deskWood.roughness = 0.48; deskWood.metallic=0.02;
  deskWood.clearCoat.isEnabled=true; deskWood.clearCoat.intensity=0.18;
  deskTop.material = deskWood; enableShadows(deskTop as unknown as AbstractMesh);
  [[-1.45,-0.62],[1.45,-0.62],[-1.45,0.62],[1.45,0.62]].forEach(([ox,oz],i)=>{
    const leg = MeshBuilder.CreateBox(`leg${i}`,{width:0.09,height:0.9,depth:0.09},scene);
    leg.position.set(-3.2+ox,0.45,-2.2+oz);
    leg.material = mat("#1a120a",0.92); enableShadows(leg as unknown as AbstractMesh);
  });
  const drawer = MeshBuilder.CreateBox("drawer",{width:1.22,height:0.30,depth:0.06},scene);
  drawer.position.set(-3.2,0.72,-1.42);
  drawer.material = mat("#3d2c18",0.62); enableShadows(drawer as unknown as AbstractMesh);
  const drawerHandle = MeshBuilder.CreateBox("handle",{width:0.42,height:0.045,depth:0.02},scene);
  drawerHandle.position.set(-3.2,0.72,-1.38);
  drawerHandle.material = brass; drawerHandle.parent = drawer as any;

  const laptopBase = MeshBuilder.CreateBox("laptopBase",{width:0.92,height:0.045,depth:0.62},scene);
  laptopBase.position.set(-3.2,0.99,-2.1);
  const lapPBR = new PBRMaterial("lapPBR",scene);
  lapPBR.albedoColor = new Color3(0.04,0.04,0.05); lapPBR.roughness=0.28; lapPBR.metallic=0.55;
  laptopBase.material = lapPBR; enableShadows(laptopBase as unknown as AbstractMesh);
  const laptopScreen = MeshBuilder.CreateBox("laptopScreen",{width:0.92,height:0.62,depth:0.045},scene);
  laptopScreen.position.set(-3.2,1.30,-2.40);
  laptopScreen.rotation.x=0.26;
  const lapMat = new PBRMaterial("lapMat",scene);
  lapMat.albedoColor = new Color3(0.03,0.04,0.08);
  lapMat.emissiveColor = new Color3(0.06,0.18,0.42);
  lapMat.emissiveIntensity = 0.85;
  lapMat.roughness=0.18; lapMat.metallic=0.1;
  laptopScreen.material = lapMat;

  const shelf = MeshBuilder.CreateBox("shelf",{width:2.7,height:2.35,depth:0.55},scene);
  shelf.position.set(3.6,1.15,-3.85);
  shelf.material = mat("#1e1a14",0.88); enableShadows(shelf as unknown as AbstractMesh);
  const bookColors = ["#7c3aed","#f59e0b","#10b981","#ec4899","#06b6d4","#e11d48","#f59e0b","#8b5cf6"];
  const bookMeshes: Mesh[] = [];
  bookColors.forEach((c,i)=>{
    const b = MeshBuilder.CreateBox(`book${i}`,{width:0.23,height:0.62,depth:0.38},scene);
    b.position.set(2.75+i*0.245,1.38,-3.82);
    if(i===6) b.position.y+=0.07;
    const bm = new PBRMaterial(`bookMat${i}`,scene);
    bm.albedoColor = Color3.FromHexString(c);
    bm.roughness=0.62; bm.metallic=0.02; bm.clearCoat.isEnabled=true; bm.clearCoat.intensity=0.12;
    b.material = bm; enableShadows(b as unknown as AbstractMesh);
    bookMeshes.push(b);
  });
  const bookInteract = bookMeshes[6];

  const paintFrame = MeshBuilder.CreateBox("paintFrame",{width:1.72,height:1.28,depth:0.08},scene);
  paintFrame.position.set(0.2,2.04,-5.88);
  paintFrame.rotation.z=-0.08;
  const frameMat = new PBRMaterial("frameMat",scene);
  frameMat.albedoColor = new Color3(0.18,0.13,0.06); frameMat.roughness=0.42; frameMat.metallic=0.62;
  paintFrame.material = frameMat; enableShadows(paintFrame as unknown as AbstractMesh);
  const painting = MeshBuilder.CreateBox("painting",{width:1.46,height:1.04,depth:0.025},scene);
  painting.position.set(0.2,2.04,-5.83); painting.rotation.z=-0.08;
  const paintTexMat = new StandardMaterial("paintMat",scene);
  paintTexMat.diffuseColor = new Color3(0.19,0.12,0.08);
  paintTexMat.emissiveColor = new Color3(0.09,0.06,0.04);
  painting.material = paintTexMat;
  const inner = MeshBuilder.CreatePlane("inner",{width:1.22,height:0.82},scene);
  inner.position.set(0.2,2.04,-5.80); inner.rotation.z=-0.08;
  const innerMat = new StandardMaterial("innerMat",scene);
  innerMat.diffuseColor = new Color3(0.44,0.33,0.22);
  inner.material = innerMat;

  const clockBody = MeshBuilder.CreateCylinder("clock",{diameter:0.74,height:0.09},scene);
  clockBody.rotation.x=Math.PI/2; clockBody.position.set(-5.2,2.45,-1.2);
  const clockMat = new PBRMaterial("clockMat",scene);
  clockMat.albedoColor = new Color3(0.96,0.94,0.88); clockMat.roughness=0.38; clockMat.metallic=0.12;
  clockBody.material = clockMat; enableShadows(clockBody as unknown as AbstractMesh);
  const clockRim = MeshBuilder.CreateTorus("rim",{diameter:0.81,thickness:0.042},scene);
  clockRim.position.set(-5.2,2.45,-1.15); clockRim.rotation.x=Math.PI/2;
  clockRim.material = brass; enableShadows(clockRim as unknown as AbstractMesh);
  const handH = MeshBuilder.CreateBox("handH",{width:0.042,height:0.24,depth:0.012},scene);
  handH.position.set(-5.2,2.50,-1.10); handH.material = mat("#0a0a0a",0.9);
  const handM = MeshBuilder.CreateBox("handM",{width:0.022,height:0.32,depth:0.012},scene);
  handM.position.set(-5.2,2.45,-1.10); handM.rotation.z=0.6; handM.material = mat("#0a0a0a",0.9);

  const safeBox = MeshBuilder.CreateBox("safeBox",{width:0.92,height:0.92,depth:0.72},scene);
  safeBox.position.set(4.8,0.46,-4.22);
  const safeSteel = new PBRMaterial("safeSteel",scene);
  safeSteel.albedoColor = new Color3(0.08,0.08,0.09); safeSteel.roughness=0.32; safeSteel.metallic=0.78;
  safeBox.material = safeSteel; enableShadows(safeBox as unknown as AbstractMesh);
  const safeDoor = MeshBuilder.CreateBox("safeDoor",{width:0.92,height:0.92,depth:0.07},scene);
  safeDoor.position.set(4.8,0.46,-3.84);
  safeDoor.material = safeSteel.clone("safeDoorMat") as PBRMaterial; enableShadows(safeDoor as unknown as AbstractMesh);
  const safeDial = MeshBuilder.CreateCylinder("dial",{diameter:0.24,height:0.045},scene);
  safeDial.rotation.x=Math.PI/2; safeDial.position.set(4.8,0.46,-3.795);
  safeDial.material = brass;

  const rug = MeshBuilder.CreateBox("rug",{width:4.2,height:0.02,depth:3.1},scene);
  rug.position.set(0,0.02,-0.5);
  const rugMat = new PBRMaterial("rugMat",scene);
  rugMat.albedoColor = new Color3(0.14,0.12,0.10); rugMat.roughness=1.0; rugMat.metallic=0;
  rug.material = rugMat; rug.receiveShadows=true;

  const pot = MeshBuilder.CreateCylinder("pot",{diameter:0.52,height:0.52},scene);
  pot.position.set(-5.6,0.26,2.2); pot.material = mat("#2a2218",0.92); enableShadows(pot as unknown as AbstractMesh);
  const plant = MeshBuilder.CreateSphere("plant",{diameter:0.72},scene);
  plant.position.set(-5.6,0.78,2.2); plant.scaling.y=1.38;
  const plantMat = new PBRMaterial("plantMat",scene);
  plantMat.albedoColor = new Color3(0.06,0.16,0.07); plantMat.roughness=0.88;
  plantMat.subSurface.isTranslucencyEnabled=true; plantMat.subSurface.translucencyIntensity=0.18;
  plant.material = plantMat; enableShadows(plant as unknown as AbstractMesh);

  // Pendant light inside archive
  const pendant = MeshBuilder.CreateCylinder("pendant",{diameter:0.08,height:1.2},scene);
  pendant.position.set(0,3.55,-0.2); pendant.material = mat("#0a0a0a",0.9);
  const pendHead = MeshBuilder.CreateCylinder("pendHead",{diameter:0.55,height:0.22},scene);
  pendHead.position.set(0,2.92,-0.2);
  const pendMat = new StandardMaterial("pendMat",scene);
  pendMat.emissiveColor = new Color3(1,0.88,0.62); pendMat.diffuseColor = new Color3(0.12,0.10,0.08);
  pendHead.material = pendMat;
  const pendLight = new PointLight("pendLight", new Vector3(0,2.82,-0.2), scene);
  pendLight.intensity = 1.15; pendLight.range = 10; pendLight.diffuse = new Color3(1,0.86,0.65); pendLight.radius=0.45;

  // ── CHARACTER (quixel-ish, not flat) ──
  const charRoot = new TransformNode("charRoot", scene);
  charRoot.position = new Vector3(0,0.9,9.5);
  const charBody = MeshBuilder.CreateCapsule("charBody",{height:1.76,radius:0.33},scene);
  (charBody as any).parent = charRoot;
  charBody.position.y = 0;
  const charPBR = new PBRMaterial("charPBR",scene);
  charPBR.albedoColor = new Color3(0.16,0.17,0.19); charPBR.roughness=0.62; charPBR.metallic=0.12;
  charBody.material = charPBR; shadowGen.addShadowCaster(charBody as Mesh, true);
  // high-vis vest
  const vest = MeshBuilder.CreateBox("vest",{width:0.58,height:0.72,depth:0.38},scene);
  (vest as any).parent = charBody;
  vest.position.set(0,0.18,0);
  const vestMat = new PBRMaterial("vestMat",scene);
  vestMat.albedoColor = new Color3(1,0.72,0.02); vestMat.roughness=0.68; vestMat.metallic=0; vestMat.emissiveColor=new Color3(0.12,0.07,0);
  vest.material = vestMat;
  const strip1 = MeshBuilder.CreateBox("strip1",{width:0.60,height:0.06,depth:0.02},scene);
  (strip1 as any).parent = vest; strip1.position.set(0,0.12,0.20);
  const stripMat = new StandardMaterial("stripMat",scene); stripMat.emissiveColor=new Color3(0.95,0.95,0.98); stripMat.diffuseColor=new Color3(0.9,0.9,0.9);
  strip1.material=stripMat;
  const strip2 = strip1.clone("strip2"); (strip2 as any).parent = vest; strip2.position.y=-0.12;

  const charHead = MeshBuilder.CreateSphere("charHead",{diameter:0.52},scene);
  (charHead as any).parent = charBody; charHead.position.y=0.74;
  const headPBR = new PBRMaterial("headPBR",scene);
  headPBR.albedoColor = new Color3(0.92,0.78,0.62); headPBR.roughness=0.62;
  charHead.material = headPBR;
  const cap = MeshBuilder.CreateCylinder("cap",{diameter:0.54,height:0.14},scene);
  (cap as any).parent = charHead; cap.position.y=0.16;
  const capMat = new PBRMaterial("capMat",scene); capMat.albedoColor=new Color3(0.06,0.06,0.07); capMat.roughness=0.72;
  cap.material=capMat;
  const brim = MeshBuilder.CreateCylinder("brim",{diameter:0.58,height:0.02},scene);
  (brim as any).parent = cap; brim.position.set(0,-0.02,0.18); brim.scaling.z=0.62;
  brim.material=capMat;
  const eyeL = MeshBuilder.CreateSphere("eyeL",{diameter:0.07},scene);
  (eyeL as any).parent = charHead; eyeL.position.set(-0.11,0.02,0.24); eyeL.material = mat("#0a0a0a",0.9);
  const eyeR = MeshBuilder.CreateSphere("eyeR",{diameter:0.07},scene);
  (eyeR as any).parent = charHead; eyeR.position.set(0.11,0.02,0.24); eyeR.material = mat("#0a0a0a",0.9);

  const shadow = MeshBuilder.CreateDisc("shadow",{radius:0.52},scene);
  shadow.rotation.x=Math.PI/2; shadow.position.y=-0.88; (shadow as any).parent = charRoot;
  const sMat = new StandardMaterial("sMat",scene); sMat.diffuseColor=new Color3(0,0,0); sMat.alpha=0.22; shadow.material=sMat;

  // ── VEHICLES — GTA paint ──
  // Car — low, glossy
  const carRoot = new TransformNode("carRoot", scene);
  carRoot.position = new Vector3(13.5,0.42,7.2);
  carRoot.rotation.y = -Math.PI/1.15;
  const carBody = MeshBuilder.CreateBox("carBody",{width:2.45,height:0.62,depth:1.28},scene);
  (carBody as any).parent = carRoot; carBody.position.y=0.28;
  const carPaint = new PBRMaterial("carPaint",scene);
  carPaint.albedoColor = new Color3(0.82,0.08,0.08);
  carPaint.roughness=0.16; carPaint.metallic=0.12; carPaint.clearCoat.isEnabled=true; carPaint.clearCoat.intensity=0.85; carPaint.clearCoat.roughness=0.08;
  carPaint.environmentIntensity=1.1;
  carBody.material = carPaint; shadowGen.addShadowCaster(carBody as Mesh, true);
  const carCabin = MeshBuilder.CreateBox("carCabin",{width:1.18,height:0.52,depth:1.14},scene);
  (carCabin as any).parent = carBody; carCabin.position.set(-0.12,0.56,0);
  const cabinMat = new PBRMaterial("cabinMat",scene);
  cabinMat.albedoColor=new Color3(0.015,0.02,0.03); cabinMat.roughness=0.08; cabinMat.metallic=0.85; cabinMat.environmentIntensity=1.0;
  carCabin.material=cabinMat;
  // headlights
  const hlL = MeshBuilder.CreateBox("hlL",{width:0.06,height:0.16,depth:0.22},scene);
  (hlL as any).parent = carBody; hlL.position.set(1.22,0.08,0.42);
  const hlMat = new StandardMaterial("hlMat",scene); hlMat.emissiveColor=new Color3(1,0.98,0.88); hlMat.diffuseColor=new Color3(0.9,0.9,0.85);
  hlL.material=hlMat;
  const hlR = hlL.clone("hlR"); (hlR as any).parent = carBody; hlR.position.z = -0.42;
  const carHL1 = new PointLight("carHL1", new Vector3(0,0,0), scene);
  carHL1.intensity=0; carHL1.range=14; carHL1.parent = hlL as any;
  const carHL2 = new PointLight("carHL2", new Vector3(0,0,0), scene);
  carHL2.intensity=0; carHL2.parent = hlR as any;
  [[0.78,0.58],[0.78,-0.58],[-0.78,0.58],[-0.78,-0.58]].forEach(([x,z],i)=>{
    const w = MeshBuilder.CreateCylinder(`carWheel${i}`,{diameter:0.54,height:0.26},scene);
    w.rotation.z=Math.PI/2; w.position.set(x,-0.14,z); (w as any).parent = carBody;
    const wMat = new PBRMaterial(`wMat${i}`,scene); wMat.albedoColor=new Color3(0.04,0.04,0.045); wMat.roughness=0.92; wMat.metallic=0.06;
    w.material=wMat; shadowGen.addShadowCaster(w as Mesh, true);
    const rim = MeshBuilder.CreateCylinder(`rim${i}`,{diameter:0.32,height:0.27},scene);
    rim.rotation.z=Math.PI/2; rim.position.set(x,-0.14,z); (rim as any).parent = carBody;
    const rimMat = new PBRMaterial(`rimMat${i}`,scene); rimMat.albedoColor=new Color3(0.78,0.78,0.80); rimMat.roughness=0.18; rimMat.metallic=0.88;
    rim.material=rimMat;
  });

  const bikeRoot = new TransformNode("bikeRoot", scene);
  bikeRoot.position = new Vector3(-14.5,0.36,7.8);
  bikeRoot.rotation.y = Math.PI/1.25;
  const bikeFrame = MeshBuilder.CreateBox("bikeFrame",{width:1.68,height:0.19,depth:0.19},scene);
  (bikeFrame as any).parent = bikeRoot; bikeFrame.position.y=0.48;
  const bikePaint = new PBRMaterial("bikePaint",scene);
  bikePaint.albedoColor=new Color3(0.02,0.68,0.78); bikePaint.roughness=0.22; bikePaint.metallic=0.18; bikePaint.clearCoat.isEnabled=true; bikePaint.clearCoat.intensity=0.55;
  bikeFrame.material=bikePaint; shadowGen.addShadowCaster(bikeFrame as Mesh, true);
  const bikeSeat = MeshBuilder.CreateBox("bikeSeat",{width:0.42,height:0.09,depth:0.22},scene);
  (bikeSeat as any).parent = bikeFrame; bikeSeat.position.set(-0.36,0.15,0); bikeSeat.material = mat("#0a0a0a",0.9);
  const bikeHandle = MeshBuilder.CreateCylinder("bikeHandle",{diameter:0.085,height:0.62},scene);
  bikeHandle.rotation.z=Math.PI/2; (bikeHandle as any).parent = bikeFrame; bikeHandle.position.set(0.68,0.13,0); bikeHandle.material = mat("#0a0a0a",0.9);
  const bikeWheelF = MeshBuilder.CreateTorus("bikeWheelF",{diameter:0.78,thickness:0.065},scene);
  bikeWheelF.position.set(0.84,0.18,0); (bikeWheelF as any).parent = bikeRoot; bikeWheelF.rotation.y=Math.PI/2; bikeWheelF.material = mat("#0a0a0a",0.92);
  shadowGen.addShadowCaster(bikeWheelF as Mesh, true);
  const bikeWheelB = MeshBuilder.CreateTorus("bikeWheelB",{diameter:0.78,thickness:0.065},scene);
  bikeWheelB.position.set(-0.84,0.18,0); (bikeWheelB as any).parent = bikeRoot; bikeWheelB.rotation.y=Math.PI/2; bikeWheelB.material = mat("#0a0a0a",0.92);
  shadowGen.addShadowCaster(bikeWheelB as Mesh, true);
  // bike headlight
  const bikeHL = MeshBuilder.CreateCylinder("bikeHL",{diameter:0.14,height:0.06},scene);
  bikeHL.rotation.z=Math.PI/2; (bikeHL as any).parent = bikeRoot; bikeHL.position.set(0.92,0.46,0);
  const bhlMat = new StandardMaterial("bhlMat",scene); bhlMat.emissiveColor=new Color3(1,0.98,0.9);
  bikeHL.material=bhlMat;

  // Highlight
  const hl = new HighlightLayer("hl", scene);
  hl.blurHorizontalSize = 0.9; hl.blurVerticalSize = 0.9; hl.innerGlow = false;

  const blockById = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
  const interactables: Interactable[] = [
    { id: "desk", mesh: drawer as unknown as AbstractMesh, block: blockById["desk"], found: false, locked: false, pos: new Vector3(-3.2,0.72,-1.42) },
    { id: "bookshelf", mesh: bookInteract as unknown as AbstractMesh, block: blockById["bookshelf"], found: false, locked: false, pos: new Vector3(3.8,1.38,-3.82) },
    { id: "painting", mesh: paintFrame as unknown as AbstractMesh, block: blockById["painting"], found: false, locked: false, pos: new Vector3(0.2,2.04,-5.88) },
    { id: "clock", mesh: clockBody as unknown as AbstractMesh, block: blockById["clock"], found: false, locked: true, pos: new Vector3(-5.2,2.45,-1.2) },
    { id: "laptop", mesh: laptopScreen as unknown as AbstractMesh, block: blockById["laptop"], found: false, locked: false, pos: new Vector3(-3.2,1.30,-2.40) },
    { id: "safe", mesh: safeDoor as unknown as AbstractMesh, block: blockById["safe"], found: false, locked: true, pos: new Vector3(4.8,0.46,-3.84) },
  ];
  interactables.forEach(it => {
    hl.addMesh(it.mesh as Mesh, Color3.FromHexString(it.block.color));
    it.mesh.isPickable = true;
  });
  (drawerHandle as any)._interactId="desk";
  (safeDial as any)._interactId="safe";
  (painting as any)._interactId="painting";
  (inner as any)._interactId="painting";
  (laptopBase as any)._interactId="laptop";
  (clockRim as any)._interactId="clock";
  [drawerHandle,safeDial,painting,inner,laptopBase,clockRim].forEach(m=>{ m.isPickable=true; });
  door.isPickable=true; dh.isPickable=true;

  let t=0;
  scene.onBeforeRenderObservable.add(()=>{
    t+=0.016;
    if(bookInteract) bookInteract.position.y = 1.38 + Math.sin(t*1.2)*0.03 + 0.07;
    if(drawer) drawer.position.z = -1.42 + Math.sin(t*0.8)*0.011;
    if(safeDial) safeDial.rotation.z = Math.sin(t*0.5)*0.05;
    bikeWheelF.rotation.x += 0.008;
    bikeWheelB.rotation.x += 0.008;
    // flicker for street glow
    const flick = 0.92 + Math.sin(t*8)*0.04;
    if((scene.getLightByName("lamp0") as PointLight)) (scene.getLightByName("lamp0") as PointLight).intensity = 1.35*flick;
  });

  const vehicles: Vehicle[] = [
    { id:"car", root:carRoot, mesh:carBody as unknown as Mesh, pos:carRoot.position.clone(), rot:carRoot.rotation.y, speed:0 },
    { id:"bike", root:bikeRoot, mesh:bikeFrame as unknown as Mesh, pos:bikeRoot.position.clone(), rot:bikeRoot.rotation.y, speed:0 },
  ];

  return { scene, charRoot, interactables, door, hl, vehicles, ground, shadowGen };
}
