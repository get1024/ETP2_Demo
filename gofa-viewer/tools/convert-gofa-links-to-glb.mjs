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
const inputDir = path.join(root, 'tmp_step_links');
const outputDir = path.join(root, 'public', 'models', 'gofa-links');
const occt = await initOcct();
const exporter = new GLTFExporter();
const metadata = [];

await fs.mkdir(outputDir, { recursive: true });

for (let index = 0; index <= 6; index += 1) {
  const files = await fs.readdir(inputDir);
  const stepFile = files.find((file) => file.toLowerCase().includes(`link0${index}`) && file.toLowerCase().endsWith('step'));
  if (!stepFile) throw new Error(`Missing STEP file for LINK0${index}`);

  const fileBuffer = await fs.readFile(path.join(inputDir, stepFile));
  const result = occt.ReadStepFile(new Uint8Array(fileBuffer), {
    linearUnit: 'meter',
    linearDeflectionType: 'bounding_box_ratio',
    linearDeflection: 0.0008,
    angularDeflection: 0.35,
  });

  if (!result?.success) {
    throw new Error(result?.error || `STEP conversion failed for ${stepFile}`);
  }

  const group = new THREE.Group();
  group.name = `GoFa_LINK0${index}`;
  const material = new THREE.MeshStandardMaterial({
    color: index === 0 ? 0x11161d : 0xf8f8f7,
    roughness: 0.34,
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

    const indexArray = mesh.index?.array;
    if (indexArray?.length) geometry.setIndex(Array.from(indexArray));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const part = new THREE.Mesh(geometry, material);
    part.name = mesh.name || `LINK0${index}_part`;
    group.add(part);
  }

  const outputPath = path.join(outputDir, `link0${index}.glb`);
  const glb = await exporter.parseAsync(group, { binary: true });
  await fs.writeFile(outputPath, Buffer.from(glb));

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  metadata.push({
    file: `link0${index}.glb`,
    source: stepFile,
    bounds: {
      min: box.min.toArray(),
      max: box.max.toArray(),
      center: center.toArray(),
      size: size.toArray(),
    },
  });
  console.log(`Converted ${stepFile} -> ${outputPath}`);
}

await fs.writeFile(path.join(outputDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
