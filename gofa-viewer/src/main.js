import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
scene.fog = new THREE.Fog(0xf2f4f6, 7, 14);

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
camera.position.set(5.2, 3.2, 6.2);

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

const materials = {
  white: new THREE.MeshStandardMaterial({ color: 0xf8f8f7, roughness: 0.34, metalness: 0.08 }),
  black: new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.35, metalness: 0.32 }),
  red: new THREE.MeshStandardMaterial({ color: 0xff0010, roughness: 0.4, metalness: 0.04 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xf8f9f9, roughness: 0.72, metalness: 0.02 }),
  cone: new THREE.MeshStandardMaterial({ color: 0xc98543, roughness: 0.55, metalness: 0.02 }),
  vanilla: new THREE.MeshStandardMaterial({ color: 0xfff5d5, roughness: 0.3, metalness: 0.02 }),
  berry: new THREE.MeshStandardMaterial({ color: 0xff9ab5, roughness: 0.34, metalness: 0.01 }),
  label: new THREE.MeshBasicMaterial({ color: 0xff0010, transparent: true, opacity: 0.72 }),
};

const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), materials.floor);
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

const robot = createGoFaRig();
scene.add(robot.root);

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

function createGoFaRig() {
  const root = new THREE.Group();
  root.position.set(-0.35, 0, -0.05);

  const j1 = new THREE.Group();
  root.add(j1);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.34, 48), materials.black);
  base.position.y = 0.17;
  base.castShadow = true;
  base.receiveShadow = true;
  j1.add(base);

  const j2 = new THREE.Group();
  j2.position.set(0, 0.45, 0);
  j1.add(j2);
  j2.add(jointSphere(0.23, materials.white));

  const upperLink = linkCapsule(0.13, 0.82, materials.white);
  upperLink.position.y = 0.45;
  j2.add(upperLink);

  const j3 = new THREE.Group();
  j3.position.set(0, 0.94, 0);
  j2.add(j3);
  j3.add(jointSphere(0.2, materials.black));

  const forearm = linkCapsule(0.1, 0.8, materials.white);
  forearm.rotation.z = Math.PI / 2;
  forearm.position.x = 0.43;
  j3.add(forearm);

  const j4 = new THREE.Group();
  j4.position.set(0.88, 0, 0);
  j3.add(j4);
  j4.add(jointSphere(0.16, materials.black));

  const wristLink = linkCapsule(0.07, 0.36, materials.white);
  wristLink.rotation.z = Math.PI / 2;
  wristLink.position.x = 0.22;
  j4.add(wristLink);

  const j5 = new THREE.Group();
  j5.position.set(0.46, 0, 0);
  j4.add(j5);
  j5.add(jointSphere(0.13, materials.black));

  const j6 = new THREE.Group();
  j6.position.set(0.2, 0, 0);
  j5.add(j6);

  const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 24), materials.black);
  tool.rotation.z = Math.PI / 2;
  tool.castShadow = true;
  j6.add(tool);

  const gripper = createGripper();
  gripper.position.x = 0.19;
  j6.add(gripper);

  const iceCream = createIceCream();
  iceCream.position.set(0.38, 0, 0);
  iceCream.rotation.z = -Math.PI / 2;
  j6.add(iceCream);

  const labelRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.008, 8, 96), materials.label);
  labelRing.rotation.x = Math.PI / 2;
  labelRing.position.y = 0.03;
  root.add(labelRing);

  return { root, j1, j2, j3, j4, j5, j6, gripper, iceCream };
}

function jointSphere(radius, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 24), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function linkCapsule(radius, length, material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 20, 32), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createGripper() {
  const group = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.22), materials.black);
  palm.position.x = 0.08;
  palm.castShadow = true;
  group.add(palm);

  const fingerGeometry = new THREE.BoxGeometry(0.035, 0.23, 0.04);
  const upper = new THREE.Mesh(fingerGeometry, materials.black);
  upper.position.set(0.2, 0.07, 0.06);
  upper.rotation.z = -0.18;
  upper.castShadow = true;
  group.add(upper);

  const lower = upper.clone();
  lower.position.y = -0.07;
  lower.rotation.z = 0.18;
  group.add(lower);
  group.userData.upper = upper;
  group.userData.lower = lower;
  return group;
}

function createIceCream() {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.34, 32), materials.cone);
  cone.rotation.x = Math.PI;
  cone.position.y = -0.17;
  cone.castShadow = true;
  group.add(cone);

  const scoopA = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), materials.vanilla);
  scoopA.position.y = 0.03;
  scoopA.castShadow = true;
  group.add(scoopA);

  const scoopB = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 20), materials.berry);
  scoopB.position.set(0.02, 0.15, 0.02);
  scoopB.castShadow = true;
  group.add(scoopB);
  return group;
}

function applyJointAngles(angles) {
  const rad = angles.map(THREE.MathUtils.degToRad);
  robot.j1.rotation.y = rad[0];
  robot.j2.rotation.z = rad[1];
  robot.j3.rotation.z = rad[2];
  robot.j4.rotation.x = rad[3];
  robot.j5.rotation.z = rad[4];
  robot.j6.rotation.x = rad[5];

  const openAmount = appState.gripper === 'open' ? 0.055 : 0.018;
  robot.gripper.userData.upper.position.y = 0.06 + openAmount;
  robot.gripper.userData.lower.position.y = -0.06 - openAmount;
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
  appState.joints = [...nextState.joints];
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
