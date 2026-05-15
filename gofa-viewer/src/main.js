import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.querySelector('#stage-canvas');
const sceneHost = document.querySelector('#scene');
const commandForm = document.querySelector('#command-form');
const commandInput = document.querySelector('#command-input');
const commandHelp = document.querySelector('#command-help');
const commandLog = document.querySelector('#command-log');
const axisList = document.querySelector('#axis-list');
const ui = {
  state: document.querySelector('#state-label'),
  lastCommand: document.querySelector('#last-command'),
  motionBar: document.querySelector('#motion-bar'),
  speed: document.querySelector('#speed-label'),
  gripper: document.querySelector('#gripper-label'),
};

const axisNames = ['J1 Base', 'J2 Shoulder', 'J3 Elbow', 'J4 Wrist Roll', 'J5 Wrist Pitch', 'J6 Tool Roll'];
const axisRows = axisNames.map((name, index) => {
  const row = document.createElement('div');
  row.className = 'axis-row';
  row.innerHTML = `
    <div>
      <b>${name}</b>
      <span id="axis-current-${index}">0.0 deg</span>
    </div>
    <meter id="axis-meter-${index}" min="-180" max="180" value="0"></meter>
    <strong id="axis-target-${index}">0.0</strong>
  `;
  axisList.append(row);
  return {
    current: row.querySelector(`#axis-current-${index}`),
    meter: row.querySelector(`#axis-meter-${index}`),
    target: row.querySelector(`#axis-target-${index}`),
  };
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f6);
scene.fog = new THREE.Fog(0xf2f4f6, 6, 13);

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
camera.position.set(4.2, 2.8, 5.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0.35, 1.05, 0);
controls.maxPolarAngle = Math.PI / 2.05;

scene.add(new THREE.HemisphereLight(0xffffff, 0x9ca8b5, 2.0));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(4.8, 6.5, 4.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xdceeff, 1.1);
rimLight.position.set(-4, 3, -3);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(9, 9),
  new THREE.MeshStandardMaterial({ color: 0xf8f9f9, roughness: 0.72, metalness: 0.02 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(9, 30, 0xd8c65b, 0xdce2e8);
grid.material.transparent = true;
grid.material.opacity = 0.52;
grid.position.y = 0.01;
scene.add(grid);

const workRing = new THREE.Mesh(
  new THREE.RingGeometry(1.75, 1.77, 128),
  new THREE.MeshBasicMaterial({ color: 0xff0010, transparent: true, opacity: 0.18 }),
);
workRing.rotation.x = -Math.PI / 2;
workRing.position.y = 0.018;
scene.add(workRing);

const loader = new GLTFLoader();
// Pivots are in the original ABB CAD coordinate system. The root rotates CAD Z-up
// into Three.js Y-up, while each link mesh keeps its real downloaded GoFa geometry.
const pivots = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 0.214),
  new THREE.Vector3(0, 0, 0.365),
  new THREE.Vector3(0, -0.145, 1.02),
  new THREE.Vector3(0.097, 0.04, 1.155),
  new THREE.Vector3(0.504, -0.01, 1.194),
  new THREE.Vector3(0.619, 0, 1.235),
];

const robot = createGoFaCadRig();
scene.add(robot.root);
loadGoFaLinks(robot).catch((error) => {
  console.error('Failed to load real GoFa CAD links:', error);
});

const appState = {
  current: [0, -28, 62, 0, 36, 0],
  target: [0, -28, 62, 0, 36, 0],
  limits: [
    [-180, 180],
    [-120, 120],
    [-160, 160],
    [-180, 180],
    [-120, 120],
    [-360, 360],
  ],
  speed: 90,
  gripper: 'closed',
  mode: 'idle',
  lastCommand: 'home',
  log: [],
};

function createGoFaCadRig() {
  const root = new THREE.Group();
  root.name = 'GoFa_CRB15000_CAD_Rig';
  root.position.set(-0.62, 0.02, 0.05);
  root.rotation.x = -Math.PI / 2;
  root.scale.setScalar(1.62);

  const j1 = new THREE.Group();
  j1.name = 'J1';
  root.add(j1);

  const j2 = makeJointGroup(j1, 'J2', pivots[2], pivots[0]);
  const j3 = makeJointGroup(j2, 'J3', pivots[3], pivots[2]);
  const j4 = makeJointGroup(j3, 'J4', pivots[4], pivots[3]);
  const j5 = makeJointGroup(j4, 'J5', pivots[5], pivots[4]);
  const j6 = makeJointGroup(j5, 'J6', pivots[6], pivots[5]);

  const toolFrame = new THREE.AxesHelper(0.16);
  toolFrame.position.set(0.08, 0, 0);
  j6.add(toolFrame);

  const tcp = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff0010 }),
  );
  tcp.position.set(0.1, 0, 0);
  j6.add(tcp);

  return { root, j1, j2, j3, j4, j5, j6 };
}

function makeJointGroup(parent, name, absolutePivot, parentPivot) {
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(absolutePivot).sub(parentPivot);
  parent.add(group);
  return group;
}

async function loadGoFaLinks(rig) {
  const linkTargets = [
    { index: 0, group: rig.j1, pivot: pivots[0] },
    { index: 1, group: rig.j1, pivot: pivots[0] },
    { index: 2, group: rig.j2, pivot: pivots[2] },
    { index: 3, group: rig.j3, pivot: pivots[3] },
    { index: 4, group: rig.j4, pivot: pivots[4] },
    { index: 5, group: rig.j5, pivot: pivots[5] },
    { index: 6, group: rig.j6, pivot: pivots[6] },
  ];

  await Promise.all(linkTargets.map(async ({ index, group, pivot }) => {
    const gltf = await loader.loadAsync(`/models/gofa-links/link0${index}.glb`);
    const link = gltf.scene;
    link.name = `ABB_GoFa_LINK0${index}`;
    link.position.copy(pivot).multiplyScalar(-1);
    link.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    group.add(link);
  }));

  document.body.classList.add('model-ready');
}

function applyJointAngles(angles) {
  const rad = angles.map(THREE.MathUtils.degToRad);
  robot.j1.rotation.z = rad[0];
  robot.j2.rotation.x = rad[1];
  robot.j3.rotation.x = rad[2];
  robot.j4.rotation.x = rad[3];
  robot.j5.rotation.y = rad[4];
  robot.j6.rotation.x = rad[5];
}

function updateUi() {
  ui.state.textContent = appState.mode;
  ui.lastCommand.textContent = appState.lastCommand;
  ui.speed.textContent = `${Math.round(appState.speed)} deg/s`;
  ui.gripper.textContent = appState.gripper;

  const error = appState.current.reduce((sum, value, index) => sum + Math.abs(appState.target[index] - value), 0);
  ui.motionBar.style.transform = `scaleX(${Math.min(error / 180, 1)})`;

  appState.current.forEach((value, index) => {
    axisRows[index].current.textContent = `${value.toFixed(1)} deg`;
    axisRows[index].target.textContent = appState.target[index].toFixed(1);
    axisRows[index].meter.min = appState.limits[index][0];
    axisRows[index].meter.max = appState.limits[index][1];
    axisRows[index].meter.value = value;
  });

  commandLog.innerHTML = appState.log
    .map((entry) => `<li class="${entry.type}"><time>${entry.time}</time><span>${entry.text}</span></li>`)
    .join('');
}

async function sendCommand(command) {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  const payload = await response.json();
  if (!payload.ok) {
    commandHelp.textContent = payload.error;
    commandHelp.classList.add('error');
  } else {
    commandHelp.textContent = payload.message;
    commandHelp.classList.remove('error');
  }
  if (payload.state) mergeState(payload.state);
}

function mergeState(nextState) {
  appState.target = [...nextState.target];
  appState.limits = [...nextState.limits];
  appState.speed = nextState.speed;
  appState.gripper = nextState.gripper;
  appState.mode = nextState.mode;
  appState.lastCommand = nextState.lastCommand;
  appState.log = nextState.log;
  updateUi();
}

function connectEvents() {
  const events = new EventSource('/api/events');
  events.onmessage = (event) => mergeState(JSON.parse(event.data));
  events.onerror = () => {
    commandHelp.textContent = '后台事件流断开，刷新页面或重启 pnpm dev。';
    commandHelp.classList.add('error');
  };
}

commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = commandInput.value.trim();
  if (command) sendCommand(command);
});

document.querySelectorAll('[data-command]').forEach((button) => {
  button.addEventListener('click', () => {
    commandInput.value = button.dataset.command;
    sendCommand(button.dataset.command);
  });
});

function resize() {
  const { width, height } = sceneHost.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const maxStep = appState.speed * delta;

  appState.current = appState.current.map((value, index) => {
    const target = appState.target[index];
    const diff = target - value;
    if (Math.abs(diff) <= maxStep) return target;
    return value + Math.sign(diff) * maxStep;
  });

  applyJointAngles(appState.current);
  updateUi();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

const clock = new THREE.Clock();
window.addEventListener('resize', resize);
resize();
connectEvents();
applyJointAngles(appState.current);
updateUi();
animate();
