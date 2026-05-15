import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import initOcct from 'occt-import-js';

globalThis.FileReader ??= class NodeFileReader {
  result = null;
  onloadend = null;

  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }

  async readAsDataURL(blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
    this.onloadend?.();
  }
};

const root = path.resolve(import.meta.dirname, '..');
const stepPath = path.join(root, 'tmp_step', 'CRB15000_12kg-127_Omnicore_rev00_ASM_CAD.STEP');
const outputPath = path.join(root, 'public', 'models', 'gofa-crb15000.glb');

const fileBuffer = await fs.readFile(stepPath);
const occt = await initOcct();
const result = occt.ReadStepFile(new Uint8Array(fileBuffer), {
  linearUnit: 'meter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.0008,
  angularDeflection: 0.35,
});

if (!result?.success) {
  throw new Error(result?.error || 'STEP conversion failed.');
}

const rootGroup = new THREE.Group();
rootGroup.name = 'GoFa_CRB_15000';

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xf7f8f8,
  roughness: 0.38,
  metalness: 0.08,
});

for (const mesh of result.meshes ?? []) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));

  if (mesh.attributes.normal?.array?.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
  } else {
    geometry.computeVertexNormals();
  }

  const index = mesh.index?.array;
  if (index?.length) {
    geometry.setIndex(Array.from(index));
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const part = new THREE.Mesh(geometry, bodyMaterial);
  part.name = mesh.name || 'GoFa_Part';
  rootGroup.add(part);
}

if (rootGroup.children.length === 0) {
  throw new Error('No mesh data was produced from the STEP file.');
}

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(rootGroup, { binary: true });
await fs.writeFile(outputPath, Buffer.from(glb));

const stats = await fs.stat(outputPath);
console.log(`Converted ${rootGroup.children.length} mesh parts to ${outputPath}`);
console.log(`GLB size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
