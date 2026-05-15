import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.querySelector('#stage-canvas');
const sceneHost = document.querySelector('#scene');
const axisList = document.querySelector('#axis-list');
const ui = {
  taskState: document.querySelector('#task-state'),
  taskDetail: document.querySelector('#task-detail'),
  taskProgress: document.querySelector('#task-progress'),
  riskState: document.querySelector('#risk-state'),
  riskDetail: document.querySelector('#risk-detail'),
  mode: document.querySelector('#mode-label'),
  proximity: document.querySelector('#proximity-label'),
  proximityBar: document.querySelector('#proximity-bar'),
  block: document.querySelector('#block-label'),
  strategy: document.querySelector('#strategy-label'),
  speed: document.querySelector('#speed-label'),
};

const axisNames = ['J1 Base', 'J2 Shoulder', 'J3 Elbow', 'J4 Wrist Roll', 'J5 Wrist Pitch', 'J6 Tool Roll'];
const sliderLimits = [
  [-45, 45],
  [-35, 35],
  [-35, 35],
  [-60, 60],
  [-45, 45],
  [-120, 120],
];
const manualOffsets = [0, 0, 0, 0, 0, 0];
const currentAngles = [0, -28, 62, 0, 36, 0];
const targetAngles = [...currentAngles];

const axisRows = axisNames.map((name, index) => {
  const row = document.createElement('div');
  row.className = 'axis-row';
  const [min, max] = sliderLimits[index];
  row.innerHTML = `
    <div>
      <b>${name}</b>
      <span id="axis-current-${index}">0.0 deg</span>
    </div>
    <input id="axis-slider-${index}" type="range" min="${min}" max="${max}" step="1" value="0" />
    <strong id="axis-offset-${index}">+0</strong>
  `;
  axisList.append(row);
  const slider = row.querySelector(`#axis-slider-${index}`);
  slider.addEventListener('input', () => {
    manualOffsets[index] = Number(slider.value);
  });
  return {
    current: row.querySelector(`#axis-current-${index}`),
    offset: row.querySelector(`#axis-offset-${index}`),
    slider,
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
camera.position.set(4.35, 3.05, 5.25);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0.1, 0.9, 0);
controls.maxPolarAngle = Math.PI / 2.04;

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
  floor: new THREE.MeshStandardMaterial({ color: 0xf8f9f9, roughness: 0.72, metalness: 0.02 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff0010, transparent: true, opacity: 0.22 }),
  green: new THREE.MeshBasicMaterial({ color: 0x2e8b57, transparent: true, opacity: 0.18 }),
  path: new THREE.LineBasicMaterial({ color: 0xff0010, transparent: true, opacity: 0.55 }),
  hand: new THREE.MeshStandardMaterial({ color: 0x2d7dd2, roughness: 0.42, metalness: 0.04 }),
  handHalo: new THREE.MeshBasicMaterial({ color: 0x2d7dd2, transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb87942, roughness: 0.58, metalness: 0.02 }),
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

const workRing = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.57, 128), materials.red);
workRing.rotation.x = -Math.PI / 2;
workRing.position.y = 0.018;
scene.add(workRing);

const frontTarget = makeTargetPad(0x2e8b57, 'front');
frontTarget.position.set(0.62, 0.012, 0.95);
scene.add(frontTarget);

const rearTarget = makeTargetPad(0xff0010, 'rear');
rearTarget.position.set(-0.72, 0.012, -0.95);
scene.add(rearTarget);

const pathLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.62, 0.035, 0.95),
    new THREE.Vector3(0.1, 0.035, 0),
    new THREE.Vector3(-0.72, 0.035, -0.95),
  ]),
  materials.path,
);
scene.add(pathLine);

const block = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), materials.wood);
block.castShadow = true;
block.receiveShadow = true;
scene.add(block);

const hand = createHand();
const handHalo = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.29, 64), materials.handHalo);
scene.add(hand, handHalo);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.82);
const handTarget = new THREE.Vector3(1.5, 0.82, 0.6);
const handPos = handTarget.clone();
let dragging = false;

const loader = new GLTFLoader();
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
loadGoFaLinks(robot).catch((error) => console.error('Failed to load real GoFa CAD links:', error));

function makeTargetPad(color) {
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 }),
  );
  pad.rotation.x = -Math.PI / 2;
  return pad;
}

function createHand() {
  const group = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 28, 18), materials.hand);
  palm.scale.set(1.0, 0.58, 0.78);
  palm.castShadow = true;
  group.add(palm);

  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.15, 6, 12), materials.hand);
    finger.rotation.z = Math.PI / 2;
    finger.position.set(0.11, 0.012, -0.065 + i * 0.045);
    finger.castShadow = true;
    group.add(finger);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 6, 12), materials.hand);
  thumb.rotation.set(0.2, 0.2, -0.65);
  thumb.position.set(0.032, -0.01, 0.11);
  thumb.castShadow = true;
  group.add(thumb);
  return group;
}

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

  const tcp = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff0010 }));
  tcp.position.set(0.1, 0, 0);
  j6.add(tcp);
  return { root, j1, j2, j3, j4, j5, j6, tcp };
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

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(dragPlane, hit)) {
    handTarget.copy(hit);
    handTarget.x = THREE.MathUtils.clamp(handTarget.x, -1.65, 1.75);
    handTarget.y = 0.82;
    handTarget.z = THREE.MathUtils.clamp(handTarget.z, -1.55, 1.55);
  }
}

function taskBaseAngles(phase) {
  const wave = Math.sin(phase * Math.PI * 2);
  const carry = Math.sin(phase * Math.PI);
  return [
    THREE.MathUtils.lerp(34, -138, phase),
    -32 - carry * 22,
    76 + carry * 28,
    wave * 18,
    28 - carry * 38,
    wave * 55,
  ];
}

function distanceToSegment(point, start, end) {
  const segment = end.clone().sub(start);
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / segment.lengthSq(), 0, 1);
  return point.distanceTo(start.clone().add(segment.multiplyScalar(t)));
}

function updateTask(elapsed) {
  const phase = (elapsed * 0.085) % 1;
  const front = new THREE.Vector3(0.62, 0.82, 0.95);
  const back = new THREE.Vector3(-0.72, 0.82, -0.95);
  const pathDistance = distanceToSegment(handPos, front, back);
  const centerDistance = Math.hypot(handPos.x, handPos.z);
  const zone = 1 - THREE.MathUtils.smoothstep(pathDistance, 0.22, 0.72);
  const insideWorkspace = centerDistance < 1.58;
  const avoid = insideWorkspace ? zone : 0;
  const base = taskBaseAngles(phase);
  const side = handPos.x > 0 ? -1 : 1;
  const finalTarget = [
    base[0] + side * avoid * 34,
    base[1] - avoid * 18,
    base[2] + avoid * 22,
    base[3] + side * avoid * 46,
    base[4] - avoid * 24,
    base[5] + side * avoid * 80,
  ];

  finalTarget.forEach((value, index) => {
    targetAngles[index] = value + manualOffsets[index];
  });

  const blockPhase = THREE.MathUtils.smoothstep(phase, 0.08, 0.92);
  block.position.lerpVectors(front, back, blockPhase);
  block.position.y = 0.13 + Math.sin(phase * Math.PI) * 0.28;
  block.rotation.y = phase * Math.PI * 2;

  handPos.lerp(handTarget, 0.18);
  hand.position.copy(handPos);
  hand.rotation.set(0.08, -0.55, -0.18);
  handHalo.position.copy(handPos);
  handHalo.rotation.copy(camera.rotation);
  handHalo.scale.setScalar(1 + avoid * 0.85);

  ui.taskProgress.style.transform = `scaleX(${phase})`;
  ui.proximity.textContent = `${Math.round(avoid * 100)}%`;
  ui.proximityBar.style.transform = `scaleX(${avoid})`;
  ui.block.textContent = blockPhase < 0.5 ? 'front -> rear' : 'rear side';
  ui.speed.textContent = `${Math.round((1 - avoid * 0.45) * 100)}%`;

  if (avoid > 0.64) {
    ui.mode.textContent = 'flex avoid';
    ui.taskState.textContent = '动态避让中';
    ui.taskDetail.textContent = '人的手进入搬运路径，GoFa 抬腕并侧让，任务没有急停。';
    ui.riskState.textContent = 'Human in workspace';
    ui.riskDetail.textContent = 'GoFa 正在用 J1/J4/J6 的侧向偏移和 J2/J3/J5 的抬升维持安全距离。';
    ui.strategy.textContent = 'avoid';
  } else if (insideWorkspace) {
    ui.mode.textContent = 'soft monitor';
    ui.taskState.textContent = '柔顺监测中';
    ui.taskDetail.textContent = '人的手在工作区边缘，GoFa 继续搬运并保留避让余量。';
    ui.riskState.textContent = 'Near workspace';
    ui.riskDetail.textContent = '系统没有停机，只降低节奏并准备改道。';
    ui.strategy.textContent = 'soft';
  } else {
    ui.mode.textContent = 'auto task';
    ui.taskState.textContent = '自动搬运中';
    ui.taskDetail.textContent = 'GoFa 将木块从面前搬到身后。拖动蓝色手掌可干预任务。';
    ui.riskState.textContent = 'Clear';
    ui.riskDetail.textContent = '蓝色手掌未进入 GoFa 的主动避让区域。';
    ui.strategy.textContent = 'normal';
  }
}

function updateAngles(delta) {
  const maxStep = 95 * delta;
  currentAngles.forEach((value, index) => {
    const diff = targetAngles[index] - value;
    currentAngles[index] = Math.abs(diff) <= maxStep ? targetAngles[index] : value + Math.sign(diff) * maxStep;
  });
  applyJointAngles(currentAngles);
}

function updateUi() {
  currentAngles.forEach((value, index) => {
    axisRows[index].current.textContent = `${value.toFixed(1)} deg`;
    axisRows[index].offset.textContent = `${manualOffsets[index] >= 0 ? '+' : ''}${manualOffsets[index].toFixed(0)}`;
  });
}

function resize() {
  const { width, height } = sceneHost.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateTask(elapsed);
  updateAngles(delta);
  updateUi();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

sceneHost.addEventListener('pointerdown', (event) => {
  dragging = true;
  controls.enabled = false;
  sceneHost.setPointerCapture(event.pointerId);
  updatePointer(event);
});
sceneHost.addEventListener('pointermove', (event) => {
  if (dragging) updatePointer(event);
});
sceneHost.addEventListener('pointerup', (event) => {
  dragging = false;
  controls.enabled = true;
  if (sceneHost.hasPointerCapture(event.pointerId)) sceneHost.releasePointerCapture(event.pointerId);
});
sceneHost.addEventListener('pointercancel', (event) => {
  dragging = false;
  controls.enabled = true;
  if (sceneHost.hasPointerCapture(event.pointerId)) sceneHost.releasePointerCapture(event.pointerId);
});
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
resize();
applyJointAngles(currentAngles);
animate();
