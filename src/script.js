import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// المشهد
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

// الكاميرا
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 5, 25);
camera.lookAt(
  camera.position.x ,         // لليمين
  camera.position.y ,         // للأسفل قليلاً (غيّر الرقم حسب الحاجة)
  camera.position.z
);

// الراسم
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// الأرض
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: 0x228B22 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// إضاءة
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// التحكم
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.object);

const button = document.getElementById('startBtn');
button.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => button.style.display = 'none');
controls.addEventListener('unlock', () => button.style.display = '');

// تحميل نموذج Saturn V وتجزئة المراحل
const loader = new GLTFLoader();
loader.load('SaturnV.glb', (gltf) => {

  const rocket = gltf.scene;
  rocket.scale.set(1, 1, 1);
  rocket.position.set(0, 4.5, -0.7);

  scene.add(rocket);
  // قاعدة إطلاق إسمنتية كبيرة
const launchBase = new THREE.Mesh(
  new THREE.BoxGeometry(40, 4, 40),
  new THREE.MeshStandardMaterial({ color: 0x777777 })
);
launchBase.position.set(0, 0.5, 0); // ترفع الصاروخ للأعلى قليلاً
scene.add(launchBase);

// أرجل أو أعمدة دعم على الزوايا
const legMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
const legGeometry = new THREE.CylinderGeometry(1, 1, 20, 16); // سميكة وطويلة

const legPositions = [
  [15, 0, 15],
  [-15,0, 15],
  [-15, 0, -15],
  [15, 0, -15]
];

legPositions.forEach(([x, y, z]) => {
  const leg = new THREE.Mesh(legGeometry, legMaterial);
  leg.position.set(x, y, z);
  scene.add(leg);
});

// 1. القاعدة الممخروطية
const coneRadius = 6; // عدل حسب حجم الصاروخ
const coneHeight = 8;
const topRadius = 2.2; // نصف قطر دائرة التماس مع الصاروخ (قيمة تقريبية)
const coneGeometry = new THREE.CylinderGeometry(topRadius, coneRadius, coneHeight, 32);
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
const coneBase = new THREE.Mesh(coneGeometry, coneMaterial);
coneBase.position.set(0, 0.5, 0); // فوق قاعدة الإطلاق وتحت الصاروخ
scene.add(coneBase);

// 2. العمود الجانبي
const rocketRadius = 2; // عدل حسب حجم الصاروخ الفعلي
const rocketHeight = 20; // عدل حسب ارتفاع الصاروخ الفعلي
const columnGeometry = new THREE.CylinderGeometry(0.5, 0.5, rocketHeight, 16);
const columnMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const column = new THREE.Mesh(columnGeometry, columnMaterial);
// ضع العمود بجانب الصاروخ أقرب وأبدأ من الأرضية
column.position.set(rocketRadius + 2, rocketHeight / 2, 0);
scene.add(column);

// 3. الربط بين الصاروخ والعمود (أسطوانة أفقية صغيرة)
const linkGeometry = new THREE.CylinderGeometry(0.3, 0.3, rocketRadius + 2, 8);
const linkMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const link = new THREE.Mesh(linkGeometry, linkMaterial);
// ضع الربط عند قاعدة الصاروخ، ودوّره ليكون أفقيًا
link.position.set((rocketRadius + 2) / 2, 4 + 1, 0);
link.rotation.z = Math.PI / 2;
scene.add(link);

}, undefined, (error) => {
  console.error('⚠️ فشل تحميل النموذج:', error);
});


// الحركة
const move = { forward: false, backward: false, left: false, right: false };
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
const moveSpeed = 0.1;
let moveUp = false;
let moveDown = false;
const flySpeed = 0.1;
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

  const camObj = controls.object;
  if (moveUp) camObj.position.y += flySpeed;
  if (moveDown && camObj.position.y > groundLevel) camObj.position.y -= flySpeed;
  if (camObj.position.y < groundLevel) camObj.position.y = groundLevel;
}

function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  renderer.render(scene, camera);

  // تحديث إحداثيات الكاميرا
  const camPos = camera.position;
  document.getElementById('cameraCoords').textContent =
    `Camera: x=${camPos.x.toFixed(2)}, y=${camPos.y.toFixed(2)}, z=${camPos.z.toFixed(2)}`;
}
animate();
