import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CONFIG = {
  modelUrl: './assets/robot.glb',
  dracoPath: 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/',
  fps: 24,

  pages: [
    { id: 'home',     frame: 0,   camera: 'CAM_01_Room' },
    { id: 'download', frame: 140, camera: 'CAM_02_Music' },
  ],

  frames: {
    loop:  { start: 200, end: 920 },
    groove:  { start: 200, end: 440 },
    hpOff:   { start: 440, end: 468 },
    pistol:  { start: 472, end: 582 },
    rifle:   { start: 586, end: 702 },
    sniper:  { start: 708, end: 862 },
    hpOn:    { start: 866, end: 902 },
  },

  loopEnterAt: Infinity,
  scrollSmoothing: 10,
  loopBlendSpeed: 4,

  camera: {
    fov: 35,
    damping: 4,
    phoneFitWidth: 6.6,
    phoneFitMargin: 1.1,
    phoneMaxFov: 80,
  },

  hideObjects: /^(Studio_Root|COVER_|TRACK_Platform)/,

  robotNodeName: null,
  robotCenterIgnore: /gun|flash|smoke|phone|cover|platform/i,

  emissive: {
    materials: ['M_Emissive_Face', 'M_Emissive_Blue'],
    colors: { blue: '#2f7dff', cyan: '#1ac0ff', red: '#ff1f0a', green: '#0dff40' },
    defaultColor: 'blue',
    moods: [
      { section: 'groove', color: 'cyan' },
      { section: 'pistol', color: 'red' },
      { section: 'rifle',  color: 'red' },
      { section: 'sniper', color: 'cyan' },
    ],
    glow: 2.0,
    beatEvery: 15,
    beatBoost: 0.9,
    colorBlendSpeed: 8,
  },

  flash: {
    namePattern: /^GUN_.*_Flash$/,
    scaleThreshold: 0.1,
    color: 0xffa64d,
    intensity: 40,
    distance: 8,
    decay: 18,
  },

  cover: {
    enabled: true,
    namePattern: /cover/i,
    fadeFrames: { start: 100, end: 140 },
  },

  smoke: { namePattern: /smoke/i, maxOpacity: 0.65 },

  bloom: { strength: 0.35, radius: 0.4, threshold: 1.5 },

  render: {
    exposure: 1.0,
    maxPixelRatio: 2,
    maxPixelRatioPhone: 1.5,
  },

  lights: {
    environment: 0.9,
    hemisphere: 0.4,
    key: 1.2,
  },
};

const pageEls = CONFIG.pages.map((p) => document.getElementById(p.id));
const PAGE_COUNT = pageEls.length;
const IS_PHONE =
  window.matchMedia('(pointer: coarse)').matches &&
  Math.min(screen.width, screen.height) <= 820;
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

document.documentElement.classList.add('reveal-ready');
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      entry.target.classList.toggle('is-visible', entry.isIntersecting);
    }
  },
  { threshold: 0.35 }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.render.exposure;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.05, 500);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = CONFIG.lights.environment;
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, CONFIG.lights.hemisphere));
const keyLight = new THREE.DirectionalLight(0xffffff, CONFIG.lights.key);
keyLight.position.set(3, 6, 5);
scene.add(keyLight);

const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold
);
Object.assign(bloomPass.blendMaterial, {
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
});
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  const cap = IS_PHONE ? CONFIG.render.maxPixelRatioPhone : CONFIG.render.maxPixelRatio;
  const pr = Math.min(window.devicePixelRatio || 1, cap);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const dampFactor = (lambda, dt) => 1 - Math.exp(-lambda * dt);
const inRange = (frame, r) => frame >= r.start && frame < r.end;
const frameToTime = (frame) => frame / CONFIG.fps;

function scrollProgress() {
  const y = window.scrollY;
  for (let i = PAGE_COUNT - 1; i > 0; i--) {
    const top = pageEls[i].offsetTop;
    if (y >= top) return PAGE_COUNT - 1;
    const prevTop = pageEls[i - 1].offsetTop;
    if (y >= prevTop) return i - 1 + clamp01((y - prevTop) / (top - prevTop));
  }
  return 0;
}

const pageIndex = (progress) => Math.max(0, Math.min(Math.floor(progress), PAGE_COUNT - 2));

function scrollFrameFor(progress) {
  if (PAGE_COUNT < 2) return CONFIG.pages[0].frame;
  const i = pageIndex(progress);
  return lerp(CONFIG.pages[i].frame, CONFIG.pages[i + 1].frame, clamp01(progress - i));
}

function findObject(root, test) {
  let found = null;
  root.traverse((o) => { if (!found && test(o)) found = o; });
  return found;
}

function materialsOf(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');

function setLoadProgress(fraction) {
  const pct = Math.round(clamp01(fraction) * 100);
  loaderFill.style.width = pct + '%';
  loaderText.textContent = `Loading ${pct}%`;
}

const state = {
  ready: false,
  scrollFrame: 0,
  loopFrame: CONFIG.frames.loop.start,
  loopWeight: 0,
  inLoop: false,
  frame: 0,
};

let mixer, scrollAction, loopAction;
let robotNode = null;
const robotCenterLocal = new THREE.Vector3();
const cameraEmpties = [];
const emissiveMaterials = [];
const flashes = [];
const coverMaterials = [];

function colorCover() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  for (const c of coverMaterials) c.material.color.set(bg);
}
window.addEventListener('ored-theme', colorCover);

const moodColor = new THREE.Color(CONFIG.emissive.colors[CONFIG.emissive.defaultColor]);
const moodTarget = new THREE.Color();

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const FALLBACK_CAMERA_OFFSET = new THREE.Vector3(0, 0.6, 9);

const draco = new DRACOLoader().setDecoderPath(CONFIG.dracoPath);
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);

gltfLoader.load(
  CONFIG.modelUrl,
  (gltf) => {
    setupModel(gltf);
    setLoadProgress(1);
    loaderEl.classList.add('is-done');
    state.ready = true;
    startLoop();
  },
  (xhr) => {
    if (xhr.lengthComputable) setLoadProgress(xhr.loaded / xhr.total);
  },
  (err) => {
    console.error('Failed to load', CONFIG.modelUrl, err);
    loaderText.textContent =
      location.protocol === 'file:'
        ? 'Open this site through a local web server (see README / Live Server), not by double-clicking index.html.'
        : `Could not load ${CONFIG.modelUrl}. Check that the file exists.`;
  }
);

function setupModel(gltf) {
  const model = gltf.scene;
  scene.add(model);

  model.traverse((obj) => {
    if (CONFIG.flash.namePattern.test(obj.name)) {
      const light = new THREE.PointLight(CONFIG.flash.color, 0, CONFIG.flash.distance, 2);
      scene.add(light);
      flashes.push({ mesh: obj, light, level: 0 });
    }

    if (!obj.isMesh) return;

    for (const mat of materialsOf(obj)) {
      if (CONFIG.emissive.materials.includes(mat.name) && !emissiveMaterials.includes(mat)) {
        emissiveMaterials.push(mat);
      }
    }

    if (CONFIG.smoke.namePattern.test(obj.name)) {
      for (const mat of materialsOf(obj)) {
        mat.transparent = true;
        mat.depthWrite = false;
        mat.opacity = Math.min(mat.opacity, CONFIG.smoke.maxOpacity);
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
      obj.renderOrder = 10;
    }

    for (const mat of materialsOf(obj)) {
      if (mat.transparent) mat.depthWrite = false;
    }

    if (CONFIG.cover.enabled && CONFIG.cover.namePattern.test(obj.name)) {
      for (const mat of materialsOf(obj)) {
        coverMaterials.push({ material: mat, baseOpacity: mat.opacity });
        mat.transparent = true;
        mat.needsUpdate = true;
      }
      obj.renderOrder = 5;
    }
  });

  if (CONFIG.hideObjects) {
    model.traverse((obj) => { if (CONFIG.hideObjects.test(obj.name)) obj.visible = false; });
  }

  for (const { camera: name } of CONFIG.pages) {
    const empty = model.getObjectByName(name);
    if (!empty) console.warn(`Camera empty "${name}" not found in the GLB.`);
    cameraEmpties.push(empty || null);
  }

  robotNode = CONFIG.robotNodeName
    ? model.getObjectByName(CONFIG.robotNodeName)
    : findObject(model, (o) => /robot|head/i.test(o.name) && !/phone/i.test(o.name));
  if (!robotNode) {
    console.warn('Robot node not found; centring on the scene origin. Set CONFIG.robotNodeName.');
    robotNode = model;
  }

  const clip = gltf.animations[0];
  mixer = new THREE.AnimationMixer(model);
  if (clip) {
    scrollAction = mixer.clipAction(clip);
    loopAction = mixer.clipAction(clip.clone());
    for (const action of [scrollAction, loopAction]) {
      action.play();
      action.paused = true;
    }
  } else {
    console.warn('No animation clip found in the GLB.');
  }

  colorCover();

  const p = scrollProgress();
  state.scrollFrame = scrollFrameFor(p);
  state.inLoop = p >= CONFIG.loopEnterAt;
  state.loopWeight = state.inLoop ? 1 : 0;
  applyAnimation();

  const box = robotBounds();
  if (box.isEmpty()) robotNode.getWorldPosition(tmpA);
  else box.getCenter(tmpA);
  robotCenterLocal.copy(robotNode.worldToLocal(tmpA.clone()));

  computeCameraGoal(p, tmpDesired, tmpTarget);
  camPos.copy(tmpDesired);
  camLook.copy(tmpTarget);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  console.info('[Ored] robot node:', robotNode.name, '| flashes:', flashes.map((f) => f.mesh.name),
    '| emissive materials:', emissiveMaterials.map((m) => m.name), '| cover materials:', coverMaterials.length);
}

function robotBounds() {
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  robotNode.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== robotNode.parent; p = p.parent) {
      if (p !== robotNode && CONFIG.robotCenterIgnore.test(p.name)) return;
    }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(meshBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return box;
}

function updateAnimationState(dt) {
  const { loop } = CONFIG.frames;
  const progress = scrollProgress();

  state.scrollFrame = lerp(state.scrollFrame, scrollFrameFor(progress), dampFactor(CONFIG.scrollSmoothing, dt));

  state.inLoop = progress >= CONFIG.loopEnterAt;
  if (reducedMotionQuery.matches) {
    state.loopFrame = loop.start;
  } else if (state.inLoop || state.loopWeight > 0.001) {
    state.loopFrame += dt * CONFIG.fps;
    const length = loop.end - loop.start;
    while (state.loopFrame >= loop.end) state.loopFrame -= length;
  }

  const goal = state.inLoop ? 1 : 0;
  state.loopWeight = lerp(state.loopWeight, goal, dampFactor(CONFIG.loopBlendSpeed, dt));
  if (Math.abs(state.loopWeight - goal) < 0.001) state.loopWeight = goal;
  if (state.loopWeight === 0) state.loopFrame = loop.start;

  applyAnimation();
}

function applyAnimation() {
  state.frame = state.loopWeight > 0.5 ? state.loopFrame : state.scrollFrame;
  if (!scrollAction) return;
  scrollAction.time = frameToTime(state.scrollFrame);
  loopAction.time = frameToTime(state.loopFrame);
  scrollAction.setEffectiveWeight(1 - state.loopWeight);
  loopAction.setEffectiveWeight(state.loopWeight);
  mixer.update(0);
  scene.updateMatrixWorld();
}

function robotCenter(out) {
  return robotNode.localToWorld(out.copy(robotCenterLocal));
}

function emptyPosition(index, out, target) {
  const empty = cameraEmpties[index];
  if (empty) return empty.getWorldPosition(out);
  return out.copy(target).add(FALLBACK_CAMERA_OFFSET);
}

function computeCameraGoal(progress, outPos, outTarget) {
  robotCenter(outTarget);

  if (PAGE_COUNT < 2) {
    emptyPosition(0, outPos, outTarget);
  } else {
    const i = pageIndex(progress);
    const t = smoothstep(clamp01(progress - i));
    emptyPosition(i, tmpA, outTarget);
    emptyPosition(i + 1, tmpB, outTarget);
    outPos.lerpVectors(tmpA, tmpB, t);
  }

  fitPortrait(outPos, outTarget);
}

function fitPortrait(pos, target) {
  const cfg = CONFIG.camera;
  let fov = cfg.fov;
  if (camera.aspect < 1) {
    const halfWidth = cfg.phoneFitWidth * 0.5 * cfg.phoneFitMargin;
    const offset = tmpA.subVectors(pos, target);
    const dist = offset.length();
    const tanHalfH = halfWidth / dist;
    fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalfH / camera.aspect));
    if (fov > cfg.phoneMaxFov) {
      fov = cfg.phoneMaxFov;
      const maxTanHalfH = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * camera.aspect;
      pos.copy(target).addScaledVector(offset.normalize(), halfWidth / maxTanHalfH);
    }
    fov = Math.max(fov, cfg.fov);
  }
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function updateCamera(dt) {
  computeCameraGoal(scrollProgress(), tmpDesired, tmpTarget);
  const k = dampFactor(CONFIG.camera.damping, dt);
  camPos.lerp(tmpDesired, k);
  camLook.lerp(tmpTarget, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function moodColorName(frame) {
  for (const mood of CONFIG.emissive.moods) {
    if (inRange(frame, CONFIG.frames[mood.section])) return mood.color;
  }
  return CONFIG.emissive.defaultColor;
}

function updateEmissive(dt) {
  if (!emissiveMaterials.length) return;
  const cfg = CONFIG.emissive;
  const frame = state.frame;

  moodTarget.set(cfg.colors[moodColorName(frame)]);
  moodColor.lerp(moodTarget, dampFactor(cfg.colorBlendSpeed, dt));

  const lum = Math.max(0.05, 0.2126 * moodColor.r + 0.7152 * moodColor.g + 0.0722 * moodColor.b);
  let intensity = cfg.glow / lum;

  if (state.loopWeight > 0.5 && inRange(frame, CONFIG.frames.groove)) {
    const phase = ((frame - CONFIG.frames.groove.start) % cfg.beatEvery) / cfg.beatEvery;
    intensity *= 1 + cfg.beatBoost * Math.pow(1 - phase, 3);
  }

  for (const mat of emissiveMaterials) {
    mat.emissive.copy(moodColor);
    mat.emissiveIntensity = intensity;
  }
}

function updateFlashes(dt) {
  for (const f of flashes) {
    const s = f.mesh.scale;
    const firing = f.mesh.visible && Math.max(s.x, s.y, s.z) > CONFIG.flash.scaleThreshold;
    if (firing) f.level = 1;
    else f.level *= Math.exp(-CONFIG.flash.decay * dt);
    if (f.level < 0.005) f.level = 0;

    f.light.intensity = f.level * CONFIG.flash.intensity * (firing ? 0.85 + Math.random() * 0.3 : 1);
    if (f.level > 0) f.mesh.getWorldPosition(f.light.position);
  }
}

function updateCover() {
  if (!coverMaterials.length) return;
  const { start, end } = CONFIG.cover.fadeFrames;
  const fade = smoothstep(clamp01((state.frame - start) / (end - start)));
  for (const c of coverMaterials) {
    c.material.opacity = c.baseOpacity * fade;
    c.material.depthWrite = fade > 0.99;
    c.material.visible = fade > 0.001;
  }
}

const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  updateAnimationState(dt);
  updateCamera(dt);
  updateEmissive(dt);
  updateFlashes(dt);
  updateCover();
  composer.render(dt);
}

function startLoop() {
  if (!state.ready || document.hidden) return;
  clock.getDelta();
  renderer.setAnimationLoop(tick);
}

function stopLoop() {
  renderer.setAnimationLoop(null);
}

document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));

window.ORED = { CONFIG, state, scene, camera, bloomPass };
