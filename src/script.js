import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // ✅ استيراد GLTFLoader

// إعداد المشهد
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// الأرض
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x228B22 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ✅ تحميل نموذج الصاروخ
const loader = new GLTFLoader();
loader.load('Saturn V.glb', (gltf) => {
  const rocket = gltf.scene;

  rocket.scale.set(1, 1, 1); // تصغير الحجم حسب النموذج
  rocket.position.set(0, 0, 0); // وضعه على الأرض

  scene.add(rocket);
}, undefined, (error) => {
  console.error('فشل تحميل الصاروخ:', error);
});

// الإضاءة
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// التحكم
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const button = document.getElementById('startBtn');
button.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => button.style.display = 'none');
controls.addEventListener('unlock', () => button.style.display = '');

// حركة
const move = { forward: false, backward: false, left: false, right: false };
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
const moveSpeed = 0.1;

// متغيرات الطيران
const flySpeed = 0.1;
let moveUp = false;
let moveDown = false;
const groundLevel = 1.6;

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward = true; break;
    case 'KeyA': move.left = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyD': move.right = true; break;
    case 'Space': moveUp = true; break;
    case 'ShiftLeft':
    case 'ShiftRight': moveDown = true; break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward = false; break;
    case 'KeyA': move.left = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyD': move.right = false; break;
    case 'Space': moveUp = false; break;
    case 'ShiftLeft':
    case 'ShiftRight': moveDown = false; break;
  }
});

function updateMovement() {
  if (!controls.isLocked) return;

  direction.z = Number(move.forward) - Number(move.backward);
  direction.x = Number(move.right) - Number(move.left);
  direction.normalize();

  velocity.x = direction.x * moveSpeed;
  velocity.z = direction.z * moveSpeed;

  controls.moveRight(velocity.x);
  controls.moveForward(velocity.z);

  // حركة الطيران العمودية
  let camObj = controls.getObject();
  if (moveUp) camObj.position.y += flySpeed;
  if (moveDown && camObj.position.y > groundLevel) camObj.position.y -= flySpeed;
  if (camObj.position.y < groundLevel) camObj.position.y = groundLevel;
}

function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  renderer.render(scene, camera);
}
animate();
