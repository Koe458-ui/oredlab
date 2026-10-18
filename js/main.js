import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ================= settings ================= */
const MODEL_URL   = 'models/robot.glb';
const LIGHT_SCALE = 1.0;   // lower if the GLB lights look too bright
const BLOOM       = { strength: 0.55, radius: 0.4, threshold: 0.85 };
const LOOK_YAW    = 0.35;  // how far the robot turns toward the mouse (radians)
const LOOK_PITCH  = 0.18;
const AUTO_FACE_SECONDS = 5;

/* Same camera as Studio_Camera in Blender (converted Z-up -> Y-up) */
const CAM_POS    = new THREE.Vector3(-3.529, -0.45, 11.991);
const CAM_TARGET = new THREE.Vector3(0, -0.05, 0);
const H_FOV      = 2 * Math.atan(18 / 55);   // 55mm lens, 36mm sensor

/* ================= Buttons================= */
document.querySelectorAll('.nav-btn, .icon-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    console.log(`${btn.textContent.trim() || btn.getAttribute('aria-label')} clicked`);
  });
});

/* ================= Renderer ================= */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08080a);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

/* ================= Camera ================= */
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.copy(CAM_POS);
camera.lookAt(CAM_TARGET);

function updateFov() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(H_FOV / 2) / aspect));
  camera.updateProjectionMatrix();
}
updateFov();

/* Soft fill so the shell reads well even before tuning GLB lights */
scene.add(new THREE.HemisphereLight(0xffffff, 0x222228, 0.35));

/* ================= Post-processing ================= */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM.strength, BLOOM.radius, BLOOM.threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ================= Load robot ================= */
const loaderEl = document.getElementById('loader');
const pctEl = document.getElementById('loader-pct');

const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

const clock = new THREE.Clock();

let drone = null;
let droneBase = null;   
const droneMeshes = [];
const expressions = [];    
let currentExpr = 0;

// faces it cycles through on its own while idle
const IDLE_FACES = [0, 1, 6, 3, 11]; // Happy, Wink, Cool, Laugh, Mischief faces load
let idleStep = 0;
let lastFaceChange = 0;

gltfLoader.load(
  MODEL_URL,
  (gltf) => {
    const root = gltf.scene;

    root.traverse((obj) => {
      if (obj.isLight) obj.intensity *= LIGHT_SCALE;

      const match = obj.name.match(/^Face_Expr_(\d{2})_[A-Za-z]+$/);
      if (match) expressions[Number(match[1]) - 1] = obj;
    });

    scene.add(root);

    drone = root.getObjectByName('Drone_Root');
    if (drone) {
      droneBase = {
        position: drone.position.clone(),
        rotation: drone.rotation.clone(),
      };
      drone.traverse((o) => { if (o.isMesh) droneMeshes.push(o); });
    }

    setExpression(0); // Happy
    loaderEl.classList.add('hidden');
  },
  (event) => {
    if (event.total) pctEl.textContent = `${Math.round((event.loaded / event.total) * 100)}%`;
  },
  (error) => {
    console.error(error);
    pctEl.textContent = '- could not load models/robot.glb';
  }
);

/* ================= Face expressions ================= */
function setExpression(index) {
  if (!expressions.length) return;
  currentExpr = (index + expressions.length) % expressions.length;
  expressions.forEach((node, i) => { if (node) node.visible = i === currentExpr; });
  lastFaceChange = clock.getElapsedTime();
}

const pointer = new THREE.Vector2(0, 0);
const look = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();

function hitsDrone() {
  if (!droneMeshes.length) return false;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(droneMeshes, false).length > 0;
}

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  canvas.style.cursor = hitsDrone() ? 'pointer' : 'default';
});

canvas.addEventListener('click', () => {
  if (hitsDrone()) setExpression(currentExpr + 1); // click robot = next face
});

/* ================= Animation loop ================= */
function animate() {
  const t = clock.getElapsedTime();

  if (drone && droneBase) {
    look.x += (pointer.x - look.x) * 0.04;
    look.y += (pointer.y - look.y) * 0.04;

    drone.rotation.y = droneBase.rotation.y + look.x * LOOK_YAW;
    drone.rotation.x = droneBase.rotation.x - look.y * LOOK_PITCH;

    // slow hover
    drone.position.y = droneBase.position.y + Math.sin(t * 1.1) * 0.05;
  }

  // changing face
  if (expressions.length && t - lastFaceChange > AUTO_FACE_SECONDS) {
    idleStep = (idleStep + 1) % IDLE_FACES.length;
    setExpression(IDLE_FACES[idleStep]);
  }

  composer.render();
  requestAnimationFrame(animate);
}
animate();

/* ================= Resize ================= */
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
  updateFov();
});