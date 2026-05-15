import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const sceneHost = document.querySelector('#scene');
const promptTitle = document.querySelector('#prompt-title');
const promptDetail = document.querySelector('#prompt-detail');
const resetButton = document.querySelector('#reset-demo');
const fitButton = document.querySelector('#fit-view');
const canvas = document.querySelector('#stage-canvas');
const ui = {
  state: document.querySelector('#state-label'),
  distance: document.querySelector('#distance-label'),
  distanceBar: document.querySelector('#distance-bar'),
  attempts: document.querySelector('#attempt-label'),
  compliance: document.querySelector('#compliance-label'),
  tempo: document.querySelector('#tempo-label'),
  intents: {
    offer: document.querySelector('#intent-offer'),
    tease: document.querySelector('#intent-tease'),
    lift: document.querySelector('#intent-lift'),
    handoff: document.querySelector('#intent-handoff'),
  },
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f6);
scene.fog = new THREE.Fog(0xf2f4f6, 5.8, 12.5);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(3.6, 2.55, 4.55);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(0.42, 0.92, 0.12);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9da8b4, 2.15));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.75);
keyLight.position.set(4.8, 6.3, 3.7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xd7eeff, 1.15);
rimLight.position.set(-4.2, 3.2, -3.8);
scene.add(rimLight);

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: 0xf8f9f9, roughness: 0.72, metalness: 0.02 }),
  counter: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.04 }),
  counterEdge: new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.42, metalness: 0.03 }),
  shadow: new THREE.ShadowMaterial({ color: 0x65717c, opacity: 0.18 }),
  hand: new THREE.MeshStandardMaterial({ color: 0x2d7dd2, roughness: 0.44, metalness: 0.04 }),
  handGlow: new THREE.MeshBasicMaterial({ color: 0x2d7dd2, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
  cone: new THREE.MeshStandardMaterial({ color: 0xc98543, roughness: 0.55, metalness: 0.02 }),
  waffle: new THREE.MeshBasicMaterial({ color: 0x87542c, transparent: true, opacity: 0.42 }),
  vanilla: new THREE.MeshStandardMaterial({ color: 0xfff5d5, roughness: 0.3, metalness: 0.02 }),
  berry: new THREE.MeshStandardMaterial({ color: 0xff9ab5, roughness: 0.34, metalness: 0.01 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x191e25, roughness: 0.32, metalness: 0.36 }),
  softLine: new THREE.LineBasicMaterial({ color: 0x2c9b63, transparent: true, opacity: 0.74 }),
  teaseLine: new THREE.LineBasicMaterial({ color: 0xd8322a, transparent: true, opacity: 0.86 }),
  trail: new THREE.LineBasicMaterial({ color: 0xd8322a, transparent: true, opacity: 0.42 }),
};

const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), materials.floor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), materials.shadow);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = 0.004;
contactShadow.receiveShadow = true;
scene.add(contactShadow);

const grid = new THREE.GridHelper(9, 30, 0xd9c35a, 0xdbe2e8);
grid.material.transparent = true;
grid.material.opacity = 0.48;
grid.position.y = 0.012;
scene.add(grid);

const stage = new THREE.Group();
scene.add(stage);
buildIceCreamStand(stage);

const robotRoot = new THREE.Group();
scene.add(robotRoot);

const loader = new GLTFLoader();
loader.load(
  '/models/gofa-crb15000.glb',
  (gltf) => {
    const robotModel = gltf.scene;
    robotModel.rotation.x = -Math.PI / 2;
    robotModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.material = new THREE.MeshStandardMaterial({
          color: 0xf8f8f7,
          roughness: 0.34,
          metalness: 0.08,
          envMapIntensity: 0.9,
        });
      }
    });
    robotRoot.add(robotModel);
    fitRobot(robotRoot);
    document.body.classList.add('model-ready');
  },
  undefined,
  (error) => {
    sceneHost.classList.add('load-error');
    console.error('Failed to load GoFa GLB:', error);
  },
);

const hand = createHand();
const handHalo = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.3, 64), materials.handGlow);
scene.add(hand, handHalo);

const cone = createIceCream();
scene.add(cone);

const scoopRod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 18), materials.steel);
scoopRod.castShadow = true;
scene.add(scoopRod);

const scoopHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 18), materials.steel);
scoopHead.castShadow = true;
scene.add(scoopHead);

const serveLineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const serveLine = new THREE.Line(serveLineGeometry, materials.softLine);
scene.add(serveLine);

const trailPoints = Array.from({ length: 54 }, () => new THREE.Vector3());
const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
const trail = new THREE.Line(trailGeometry, materials.trail);
scene.add(trail);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const planePoint = new THREE.Vector3(1.22, 1.18, 0.44);
const cameraForward = new THREE.Vector3();

const handTarget = new THREE.Vector3(1.82, 1.05, 0.9);
const handPos = handTarget.clone();
const lastHandPos = handTarget.clone();
const handVelocity = new THREE.Vector3();

const coneHome = new THREE.Vector3(0.62, 1.18, 0.03);
const coneOffer = new THREE.Vector3(1.12, 1.18, 0.32);
const conePos = coneHome.clone();
const coneTarget = coneHome.clone();
const coneVelocity = new THREE.Vector3();
const dodgeVector = new THREE.Vector3(1, 0, 0);
const rodAnchor = new THREE.Vector3(0.03, 1.22, -0.18);

let dragging = false;
let attempts = 0;
let lastDodgeAt = 0;
let handoff = false;
let playfulEnergy = 0;

const clock = new THREE.Clock();

function buildIceCreamStand(group) {
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.58, 0.62), materials.counter);
  counter.position.set(-0.18, 0.29, -1.02);
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 0.66), materials.counterEdge);
  stripe.position.set(-0.18, 0.64, -1.02);
  stripe.castShadow = true;
  group.add(stripe);

  const poleLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 12), materials.steel);
  poleLeft.position.set(-0.92, 1.18, -1.23);
  const poleRight = poleLeft.clone();
  poleRight.position.x = 0.56;
  group.add(poleLeft, poleRight);

  for (let i = 0; i < 5; i += 1) {
    const awningMaterial = i % 2 === 0 ? materials.counterEdge : materials.counter;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.08, 0.72), awningMaterial);
    awning.position.set(-0.78 + i * 0.31, 1.78, -1.23);
    awning.castShadow = true;
    group.add(awning);
  }

  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.045, 48), materials.counter);
  tray.position.set(1.55, 0.04, 0.48);
  tray.castShadow = true;
  tray.receiveShadow = true;
  group.add(tray);
}

function createHand() {
  const group = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 18), materials.hand);
  palm.scale.set(1.0, 0.58, 0.78);
  palm.castShadow = true;
  group.add(palm);

  for (let i = 0; i < 4; i += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.16, 6, 12), materials.hand);
    finger.rotation.z = Math.PI / 2;
    finger.position.set(0.12, 0.012, -0.075 + i * 0.05);
    finger.castShadow = true;
    group.add(finger);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.027, 0.13, 6, 12), materials.hand);
  thumb.rotation.set(0.2, 0.2, -0.65);
  thumb.position.set(0.036, -0.012, 0.12);
  thumb.castShadow = true;
  group.add(thumb);
  return group;
}

function createIceCream() {
  const group = new THREE.Group();
  const coneMesh = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.32, 32), materials.cone);
  coneMesh.rotation.x = Math.PI;
  coneMesh.position.y = -0.16;
  coneMesh.castShadow = true;
  group.add(coneMesh);

  for (let i = -2; i <= 2; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.073 + Math.abs(i) * 0.006, 0.004, 8, 32), materials.waffle);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.17 + i * 0.045;
    group.add(ring);
  }

  const scoopA = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), materials.vanilla);
  scoopA.position.y = 0.02;
  scoopA.castShadow = true;
  group.add(scoopA);

  const scoopB = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 20), materials.berry);
  scoopB.position.set(0.015, 0.13, 0.015);
  scoopB.castShadow = true;
  group.add(scoopB);
  return group;
}

function fitRobot(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
  object.position.y += size.y / 2;
  object.position.x -= 0.43;
  object.position.z -= 0.24;
  object.scale.setScalar(1.04);
  frameCamera();
}

function frameCamera() {
  controls.target.set(0.45, 0.94, 0.12);
  camera.position.set(3.55, 2.45, 4.35);
  camera.near = 0.01;
  camera.far = 80;
  camera.updateProjectionMatrix();
  controls.update();
}

function refreshDragPlane() {
  camera.getWorldDirection(cameraForward);
  dragPlane.setFromNormalAndCoplanarPoint(cameraForward.clone().negate(), planePoint);
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(dragPlane, hit)) {
    handTarget.copy(hit);
    handTarget.x = THREE.MathUtils.clamp(handTarget.x, 0.46, 2.18);
    handTarget.y = THREE.MathUtils.clamp(handTarget.y, 0.7, 1.72);
    handTarget.z = THREE.MathUtils.clamp(handTarget.z, -0.52, 1.28);
  }
}

function onPointerDown(event) {
  dragging = true;
  controls.enabled = false;
  sceneHost.setPointerCapture(event.pointerId);
  refreshDragPlane();
  updatePointer(event);
}

function onPointerMove(event) {
  if (dragging) updatePointer(event);
}

function onPointerUp(event) {
  dragging = false;
  controls.enabled = true;
  if (sceneHost.hasPointerCapture(event.pointerId)) sceneHost.releasePointerCapture(event.pointerId);
}

function resetDemo() {
  handTarget.set(1.82, 1.05, 0.9);
  handPos.copy(handTarget);
  lastHandPos.copy(handTarget);
  conePos.copy(coneHome);
  coneTarget.copy(coneHome);
  coneVelocity.set(0, 0, 0);
  attempts = 0;
  lastDodgeAt = 0;
  handoff = false;
  playfulEnergy = 0;
  trailPoints.forEach((point) => point.copy(conePos));
  frameCamera();
  updatePrompt('按住并拖动', '让手靠近冰淇淋，观察机械臂如何不断线地柔顺避让。', 'idle');
  updateTelemetry(1.2, '等待接近', 'idle');
}

function updatePrompt(title, detail, moment) {
  promptTitle.textContent = title;
  promptDetail.textContent = detail;
  document.body.dataset.moment = moment;
}

function updateTelemetry(distance, state, tempo) {
  ui.state.textContent = state;
  ui.distance.textContent = `${distance.toFixed(2)} m`;
  ui.distanceBar.style.transform = `scaleX(${THREE.MathUtils.clamp(1 - distance / 1.35, 0, 1)})`;
  ui.attempts.textContent = String(attempts);
  ui.compliance.textContent = `${Math.round(playfulEnergy * 100)}%`;
  ui.tempo.textContent = tempo;

  for (const item of Object.values(ui.intents)) item.classList.remove('active');
  if (handoff) ui.intents.handoff.classList.add('active');
  else if (playfulEnergy > 0.74) ui.intents.lift.classList.add('active');
  else if (playfulEnergy > 0.46) ui.intents.tease.classList.add('active');
  else ui.intents.offer.classList.add('active');
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function updateInteraction(delta, elapsed) {
  lastHandPos.copy(handPos);
  handPos.lerp(handTarget, 1 - Math.pow(0.001, delta));
  handVelocity.copy(handPos).sub(lastHandPos).divideScalar(Math.max(delta, 0.001));

  const distance = handPos.distanceTo(conePos);
  const closeness = 1 - smoothstep(0.22, 0.88, distance);
  const speed = Math.min(handVelocity.length() / 2.8, 1);
  playfulEnergy += ((closeness * 0.78 + speed * closeness * 0.24) - playfulEnergy) * 0.08;

  if (!handoff && dragging && distance < 0.28 && elapsed - lastDodgeAt > 0.42) {
    attempts += 1;
    lastDodgeAt = elapsed;
  }

  if (!handoff && attempts >= 7 && distance < 0.32) {
    handoff = true;
  }

  dodgeVector.copy(conePos).sub(handPos);
  if (dodgeVector.lengthSq() < 0.0001) dodgeVector.set(1, 0, 0);
  dodgeVector.normalize();

  const slip = new THREE.Vector3(-dodgeVector.z, 0, dodgeVector.x);
  const tease = handoff ? 0 : smoothstep(0.94, 0.18, distance);
  const wave = Math.sin(elapsed * 5.7 + attempts * 0.92);
  const fakePass = Math.sin(elapsed * 2.35 + attempts) * 0.08;

  if (handoff) {
    coneTarget.copy(handPos).add(new THREE.Vector3(-0.035, 0.08, 0));
    updatePrompt('拿到了', '机械臂没有急停，也没有硬碰撞，而是在多次试探后完成柔顺交接。', 'handoff');
    updateTelemetry(distance, '柔顺交接', 'handoff');
  } else if (!dragging && attempts === 0) {
    coneTarget.lerp(coneOffer, 0.028);
    updatePrompt('按住并拖动', '让手靠近冰淇淋，机械臂会把“躲开”变成一种可玩的交流。', 'idle');
    updateTelemetry(distance, '等待接近', 'idle');
  } else {
    coneTarget.copy(coneOffer);
    coneTarget.add(dodgeVector.clone().multiplyScalar(tease * (0.34 + attempts * 0.018)));
    coneTarget.add(slip.multiplyScalar(tease * (0.18 + wave * 0.08)));
    coneTarget.y += tease * (0.18 + Math.max(wave, 0) * 0.13) + fakePass;
    if (closeness > 0.58) {
      updatePrompt('差一点', '它不是停下来拒绝你，而是继续保持节奏，用小幅退让、侧滑和抬高手腕回应你的动作。', 'tease');
      updateTelemetry(distance, wave > 0.4 ? '抬高手腕' : '贴近后撤', wave > 0.4 ? 'lift' : 'slip');
    } else {
      updatePrompt('靠近试试看', '冰淇淋会主动迎上来，但真正抓住它需要几次来回试探。', 'idle');
      updateTelemetry(distance, '主动递近', 'offer');
    }
  }

  coneTarget.x = THREE.MathUtils.clamp(coneTarget.x, 0.48, 1.68);
  coneTarget.y = THREE.MathUtils.clamp(coneTarget.y, 0.88, 1.76);
  coneTarget.z = THREE.MathUtils.clamp(coneTarget.z, -0.44, 0.92);

  coneVelocity.add(coneTarget.clone().sub(conePos).multiplyScalar(15 * delta));
  coneVelocity.multiplyScalar(0.76);
  conePos.add(coneVelocity.clone().multiplyScalar(delta * 5.2));

  const yawTarget = THREE.MathUtils.clamp((conePos.x - 0.78) * 0.13 + conePos.z * 0.06, -0.14, 0.14);
  robotRoot.rotation.y += (yawTarget - robotRoot.rotation.y) * 0.045;
  robotRoot.rotation.z = Math.sin(elapsed * 3.3) * playfulEnergy * 0.012;
}

function updateSceneObjects(elapsed) {
  hand.position.copy(handPos);
  hand.rotation.set(0.08, -0.55 + Math.sin(elapsed * 2.8) * 0.05, -0.18);

  handHalo.position.copy(handPos);
  handHalo.rotation.copy(camera.rotation);
  handHalo.scale.setScalar(1 + playfulEnergy * 0.6);

  cone.position.copy(conePos);
  cone.rotation.set(0.16 + Math.sin(elapsed * 6.8) * 0.04, elapsed * 0.55, -0.23 + playfulEnergy * 0.2);

  scoopHead.position.copy(conePos).add(new THREE.Vector3(-0.06, -0.02, -0.04));
  updateCylinderBetween(scoopRod, rodAnchor, scoopHead.position);

  serveLine.geometry.setFromPoints([handPos, conePos]);
  serveLine.material = playfulEnergy > 0.58 ? materials.teaseLine : materials.softLine;

  trailPoints.pop();
  trailPoints.unshift(conePos.clone());
  trailGeometry.setFromPoints(trailPoints);
}

function updateCylinderBetween(mesh, start, end) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  mesh.position.copy(midpoint);
  mesh.scale.set(1, Math.max(length, 0.001), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
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
  updateInteraction(delta, elapsed);
  updateSceneObjects(elapsed);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

sceneHost.addEventListener('pointerdown', onPointerDown);
sceneHost.addEventListener('pointermove', onPointerMove);
sceneHost.addEventListener('pointerup', onPointerUp);
sceneHost.addEventListener('pointercancel', onPointerUp);
resetButton.addEventListener('click', resetDemo);
fitButton.addEventListener('click', frameCamera);
window.addEventListener('resize', resize);

resize();
resetDemo();
animate();
