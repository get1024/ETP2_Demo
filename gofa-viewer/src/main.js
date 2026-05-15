import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const sceneHost = document.querySelector('#scene');
const canvas = document.createElement('canvas');
sceneHost.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9edf1);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
camera.position.set(3.8, 2.7, 4.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.75, 0);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x9aa4ad, 2.1);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(5, 7, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xdcefff, 0.9);
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 12),
  new THREE.ShadowMaterial({ color: 0x65717c, opacity: 0.18 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(12, 32, 0xc5ccd3, 0xd9dee4);
grid.material.opacity = 0.75;
grid.material.transparent = true;
scene.add(grid);

const reach = new THREE.Mesh(
  new THREE.RingGeometry(2.7, 2.72, 128),
  new THREE.MeshBasicMaterial({ color: 0xe6c83f, transparent: true, opacity: 0.45 }),
);
reach.rotation.x = -Math.PI / 2;
reach.position.y = 0.01;
scene.add(reach);

let robot = null;
let modelBounds = null;

const loader = new GLTFLoader();
loader.load(
  '/models/gofa-crb15000.glb',
  (gltf) => {
    robot = gltf.scene;
    robot.rotation.x = -Math.PI / 2;
    robot.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.material = new THREE.MeshStandardMaterial({
          color: 0xf7f8f8,
          roughness: 0.38,
          metalness: 0.08,
          envMapIntensity: 0.75,
        });
      }
    });
    scene.add(robot);
    fitObject(robot, 1.18);
    document.body.classList.add('model-ready');
  },
  undefined,
  (error) => {
    sceneHost.classList.add('load-error');
    console.error('Failed to load GoFa GLB:', error);
  },
);

function fitObject(object, distanceFactor = 1.8) {
  modelBounds = new THREE.Box3().setFromObject(object);
  const center = modelBounds.getCenter(new THREE.Vector3());
  const size = modelBounds.getSize(new THREE.Vector3());
  object.position.sub(center);
  object.position.y += size.y / 2;

  modelBounds = new THREE.Box3().setFromObject(object);
  const adjustedCenter = modelBounds.getCenter(new THREE.Vector3());
  const adjustedSize = modelBounds.getSize(new THREE.Vector3());
  const maxDim = Math.max(adjustedSize.x, adjustedSize.y, adjustedSize.z);
  const distance = maxDim * distanceFactor;

  controls.target.copy(adjustedCenter);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.position.copy(adjustedCenter).add(new THREE.Vector3(distance * 0.95, distance * 0.58, distance * 1.05));
  camera.updateProjectionMatrix();
  controls.update();
}

function resize() {
  const { width, height } = sceneHost.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

document.querySelector('#fit-view').addEventListener('click', () => {
  if (robot) fitObject(robot, 1.75);
});

document.querySelector('#focus-model').addEventListener('click', () => {
  if (robot) fitObject(robot, 1.25);
});

document.querySelector('#toggle-grid').addEventListener('click', (event) => {
  grid.visible = !grid.visible;
  event.currentTarget.textContent = grid.visible ? '▦ 隐藏网格' : '▦ 显示网格';
});

document.querySelector('#reset-view').addEventListener('click', () => {
  if (robot) fitObject(robot, 1.55);
});

window.addEventListener('resize', resize);
resize();
animate();
