import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CONFIG = {
  modelUrl: './assets/robot.glb',
  // Draco decoder files
  dracoPath: 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/',
  fps: 24,

  frames: {
    room:  { start: 0,   end: 100 }, // scroll-driven
    music: { start: 100, end: 200 }, // scroll-driven
    loop:  { start: 200, end: 920 }, // plays automatically (920 == 200, seamless)

    // Sections inside the page-3 loop
    groove:  { start: 200, end: 440 }, // headphones on, nods on the beat, sways, 360 spin
    hpOff:   { start: 440, end: 468 }, // headphones open and lift off
    pistol:  { start: 472, end: 582 }, // pistol docks on right ear, slow bursts
    rifle:   { start: 586, end: 702 }, // assault rifle, slow 3-round bursts
    sniper:  { start: 708, end: 862 }, // sniper, 3 heavy shots
    hpOn:    { start: 866, end: 902 }, // headphones come back down and clamp on
  },


  loopEnterAt: 1.97,

  scrollSmoothing: 10,

  loopBlendSpeed: 4,

  camera: {
    fov: 35,
    empties: ['CAM_01_Room', 'CAM_02_Music', 'CAM_03_Guns'],
    damping: 4,
    phoneFitWidth: 6.6,
    phoneFitMargin: 1.1,
    phoneMaxFov: 80,
  },

  robotNodeName: null,
  robotCenterIgnore: /gun|flash|smoke|phone|cover|platform/i,

  // Face / LED mood colours
  emissive: {
    materials: ['M_Emissive_Face', 'M_Emissive_Blue'],
    colors: { cyan: '#1ac0ff', red: '#ff1f0a', green: '#0dff40' },
    defaultColor: 'green',
    // Which colour each section uses 
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

  // Muzzle flashes: meshes named GUN_*_Flash with scale above threshold → warm light pulse
  flash: {
    namePattern: /^GUN_.*_Flash$/,
    scaleThreshold: 0.1,
    color: 0xffa64d,
    intensity: 40,
    distance: 8,
    decay: 18, // fade speed after the flash mesh disappears (per second)
  },

  // White cover fade on 
  cover: {
    enabled: true,
    namePattern: /cover/i,
    fadeFrames: { start: 100, end: 140 },
  },

  smoke: { namePattern: /smoke/i, maxOpacity: 0.65 },

  bloom: { strength: 0.35, radius: 0.4, threshold: 1.0 },

  render: {
    exposure: 1.0,
    maxPixelRatio: 2,
    maxPixelRatioPhone: 1.5,
    clearColor: 0x000000,
  },

  lights: {
    hemisphere: 0.6,
    key: 1.4,
  },
};

const PAGE_COUNT = 3;
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.render.exposure;
renderer.setClearColor(CONFIG.render.clearColor, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.05, 500);

// No background or environment image: everything you see comes from your GLB.
// These two plain lights only make sure the model isn't pitch black.
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, CONFIG.lights.hemisphere));
const keyLight = new THREE.DirectionalLight(0xffffff, CONFIG.lights.key);
keyLight.position.set(3, 6, 5);
scene.add(keyLight);

// Composer renders into a multisampled HDR target so we keep anti-aliasing with bloom
const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass()); // tone mapping + sRGB

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
// Frame-rate independent exponential smoothing
const dampFactor = (lambda, dt) => 1 - Math.exp(-lambda * dt);
const inRange = (frame, r) => frame >= r.start && frame < r.end;
const frameToTime = (frame) => frame / CONFIG.fps;

function scrollProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  if (max <= 0) return 0;
  return clamp01(window.scrollY / max) * (PAGE_COUNT - 1);
}

/** The animation frame that matches the current scroll position */
function scrollFrameFor(progress) {
  const { room, music } = CONFIG.frames;
  if (progress < 1) return lerp(room.start, room.end, progress);
  return lerp(music.start, music.end, clamp01(progress - 1));
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

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */
const state = {
  ready: false,
  scrollFrame: 0, // smoothed scroll-driven frame
  loopFrame: CONFIG.frames.loop.start, // auto-playing frame on page 3
  loopWeight: 0, // 0 = scroll animation, 1 = loop animation
  inLoop: false,
  frame: 0, // the frame that "wins" right now (used for effects)
};

let mixer, scrollAction, loopAction;
let robotNode = null;
const robotCenterLocal = new THREE.Vector3(); // robot centre in robotNode's local space
const cameraEmpties = [];
const emissiveMaterials = [];
const flashes = []; // { mesh, light, level }
const coverMaterials = []; // { material, baseOpacity }

const moodColor = new THREE.Color(CONFIG.emissive.colors[CONFIG.emissive.defaultColor]);
const moodTarget = new THREE.Color();

// Camera smoothing state
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const FALLBACK_CAMERA_OFFSET = new THREE.Vector3(0, 0.6, 9);

/* ---------------------------------------------------------
   Load the GLB
   --------------------------------------------------------- */
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
  // Note: cameras inside the GLB are ignored on purpose — the camera is driven from JS.

  model.traverse((obj) => {
    // Muzzle flashes → one pre-created point light each (intensity 0 until fired).
    // Creating lights up front avoids shader recompiles mid-animation.
    if (CONFIG.flash.namePattern.test(obj.name)) {
      const light = new THREE.PointLight(CONFIG.flash.color, 0, CONFIG.flash.distance, 2);
      scene.add(light);
      flashes.push({ mesh: obj, light, level: 0 });
    }

    if (!obj.isMesh) return;

    // Face / LED materials
    for (const mat of materialsOf(obj)) {
      if (CONFIG.emissive.materials.includes(mat.name) && !emissiveMaterials.includes(mat)) {
        emissiveMaterials.push(mat);
      }
    }

    // Smoke: transparent, no depth writes, drawn after opaque objects
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

    // Any other blended material: don't write depth, so things behind it still show
    for (const mat of materialsOf(obj)) {
      if (mat.transparent) mat.depthWrite = false;
    }

    // White cover (opacity driven from code, see updateCover)
    if (CONFIG.cover.enabled && CONFIG.cover.namePattern.test(obj.name)) {
      for (const mat of materialsOf(obj)) {
        coverMaterials.push({ material: mat, baseOpacity: mat.opacity });
        mat.transparent = true;
        mat.needsUpdate = true;
      }
      obj.renderOrder = 5;
    }

  });

  // Camera reference empties
  for (const name of CONFIG.camera.empties) {
    const empty = model.getObjectByName(name);
    if (!empty) console.warn(`Camera empty "${name}" not found in the GLB.`);
    cameraEmpties.push(empty || null);
  }

  // Robot node the camera keeps centred
  robotNode = CONFIG.robotNodeName
    ? model.getObjectByName(CONFIG.robotNodeName)
    : findObject(model, (o) => /robot|head/i.test(o.name) && !/phone/i.test(o.name));
  if (!robotNode) {
    console.warn('Robot node not found; centring on the scene origin. Set CONFIG.robotNodeName.');
    robotNode = model;
  }

  // Animation: one clip, two actions (scroll + loop) so we can crossfade between them
  const clip = gltf.animations[0];
  mixer = new THREE.AnimationMixer(model);
  if (clip) {
    scrollAction = mixer.clipAction(clip);
    loopAction = mixer.clipAction(clip.clone());
    for (const action of [scrollAction, loopAction]) {
      action.play();
      action.paused = true; // we set action.time ourselves every frame
    }
  } else {
    console.warn('No animation clip found in the GLB.');
  }

  // Start at whatever the current scroll position is (browsers restore scroll on reload)
  const p = scrollProgress();
  state.scrollFrame = scrollFrameFor(p);
  state.inLoop = p >= CONFIG.loopEnterAt;
  state.loopWeight = state.inLoop ? 1 : 0;
  applyAnimation();

  // Remember where the robot's centre is relative to its node, so tracking it each frame is cheap
  const box = robotBounds();
  if (box.isEmpty()) robotNode.getWorldPosition(tmpA);
  else box.getCenter(tmpA);
  robotCenterLocal.copy(robotNode.worldToLocal(tmpA.clone()));

  // Place the camera immediately (no easing in from the origin)
  computeCameraGoal(p, tmpDesired, tmpTarget);
  camPos.copy(tmpDesired);
  camLook.copy(tmpTarget);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  console.info('[Ored] robot node:', robotNode.name, '| flashes:', flashes.map((f) => f.mesh.name),
    '| emissive materials:', emissiveMaterials.map((m) => m.name), '| cover materials:', coverMaterials.length);
}

/** World-space box of the robot's own meshes (guns, headphones, smoke etc. excluded). */
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

/* ---------------------------------------------------------
   Animation (scroll-driven pages 1–2, loop on page 3)
   --------------------------------------------------------- */
function updateAnimationState(dt) {
  const { loop } = CONFIG.frames;
  const progress = scrollProgress();

  // Pages 1–2: smoothly follow the scroll position
  state.scrollFrame = lerp(state.scrollFrame, scrollFrameFor(progress), dampFactor(CONFIG.scrollSmoothing, dt));

  // Page 3: auto-play 200 → 920 and wrap back to 200 (seamless)
  state.inLoop = progress >= CONFIG.loopEnterAt;
  if (reducedMotionQuery.matches) {
    state.loopFrame = loop.start; // hold the first loop frame
  } else if (state.inLoop || state.loopWeight > 0.001) {
    state.loopFrame += dt * CONFIG.fps;
    const length = loop.end - loop.start;
    while (state.loopFrame >= loop.end) state.loopFrame -= length;
  }

  // Crossfade between the two. Once fully faded out, reset so the loop restarts at 200 next time.
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
  mixer.update(0); // evaluate at the times we just set
  scene.updateMatrixWorld();
}

/* ---------------------------------------------------------
   Camera: positions from the Blender empties, always looking at the robot
   --------------------------------------------------------- */
function robotCenter(out) {
  return robotNode.localToWorld(out.copy(robotCenterLocal));
}

function emptyPosition(index, out, target) {
  const empty = cameraEmpties[index];
  if (empty) return empty.getWorldPosition(out);
  return out.copy(target).add(FALLBACK_CAMERA_OFFSET); // used if an empty is missing
}

/** Desired camera position + look target for a given scroll progress. */
function computeCameraGoal(progress, outPos, outTarget) {
  robotCenter(outTarget);

  // Blend between the two neighbouring page positions
  const i = Math.min(Math.floor(progress), PAGE_COUNT - 2);
  const t = smoothstep(clamp01(progress - i));
  emptyPosition(i, tmpA, outTarget);
  emptyPosition(i + 1, tmpB, outTarget);
  outPos.lerpVectors(tmpA, tmpB, t);

  fitPortrait(outPos, outTarget);
}

/**
 * Portrait phones: make the robot + docked gun fit the screen width.
 * First widen the field of view; if that hits phoneMaxFov, also move the camera back.
 */
function fitPortrait(pos, target) {
  const cfg = CONFIG.camera;
  let fov = cfg.fov;
  if (camera.aspect < 1) {
    const halfWidth = cfg.phoneFitWidth * 0.5 * cfg.phoneFitMargin;
    const offset = tmpA.subVectors(pos, target);
    const dist = offset.length();
    // Vertical FOV whose horizontal FOV exactly fits halfWidth at this distance
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

/* ---------------------------------------------------------
   Effects: mood colour, muzzle flashes, cover fade
   --------------------------------------------------------- */
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

  // Normalise brightness so every colour glows about the same through the bloom
  const lum = Math.max(0.05, 0.2126 * moodColor.r + 0.7152 * moodColor.g + 0.0722 * moodColor.b);
  let intensity = cfg.glow / lum;

  // Beat pulse every N frames while grooving (sharp attack, quick decay)
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
    c.material.depthWrite = fade > 0.99; // solid once fully faded in
    c.material.visible = fade > 0.001;
  }
}

const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1); // avoid big jumps after stalls
  updateAnimationState(dt);
  updateCamera(dt);
  updateEmissive(dt);
  updateFlashes(dt);
  updateCover();
  composer.render(dt);
}

function startLoop() {
  if (!state.ready || document.hidden) return;
  clock.getDelta(); // discard the time spent hidden
  renderer.setAnimationLoop(tick);
}

function stopLoop() {
  renderer.setAnimationLoop(null);
}

document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));

// Handy for tweaking in the browser console: ORED.CONFIG.bloom.strength = 0.5 etc.
window.ORED = { CONFIG, state, scene, camera, bloomPass };
