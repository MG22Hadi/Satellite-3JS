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

// متغيرات للتحكم في دوران الكماشة
let clampRotationAngle = 0;
const clampRotationSpeed = 0.005; // سرعة الدوران (بطيئة)
const clampPivotPoint = new THREE.Vector3(4, 11, 0); // نقطة التقاء الكماشة مع العمود الجانبي
let isRotating = false; // حالة الدوران
let targetRotationAngle = 0; // زاوية الدوران المستهدفة
let hasRotated = false; // هل تم الدوران من قبل

// متغيرات إطلاق الصاروخ
let isLaunching = false;
let rocketLaunchSpeed = 0.5;
let rocketLaunchHeight = 0;
let rocketOriginalY = 4.5;
let launchParticles = [];
let smokeParticles = [];
let rocketObject = null; // متغير لتخزين مرجع الصاروخ
let clampObject = null; // مرجع الكماشة

// تحميل نموذج Saturn V وتجزئة المراحل
const loader = new GLTFLoader();
loader.load('SaturnV.glb', (gltf) => {

  const rocket = gltf.scene;
  rocket.scale.set(1, 1, 1);
  rocket.position.set(0, 4.5, -0.7);
  
  // تخزين مرجع للصاروخ
  rocketObject = rocket;

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

// إضافة علم سوريا في قمة العمود
const flagPoleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4, 8); // تكبير ارتفاع العصا من 2 إلى 4
const flagPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // لون خشبي
const flagPole = new THREE.Mesh(flagPoleGeometry, flagPoleMaterial);
flagPole.position.set(rocketRadius + 2, rocketHeight + 2, 0); // رفع موضع العصا من +1 إلى +2
scene.add(flagPole);

// إنشاء علم سوريا (الألوان الصحيحة: أخضر، أبيض، أسود مع ثلاث نجوم حمراء)
const flagWidth = 3; // تكبير عرض العلم
const flagHeight = 2; // تكبير ارتفاع العلم
const stripeHeight = flagHeight / 3; // كل شريط ثلث العلم

// الشريط الأخضر (الأعلى)
const greenStripeGeometry = new THREE.PlaneGeometry(flagWidth, stripeHeight);
const greenMaterial = new THREE.MeshStandardMaterial({ color: 0x007A3D, side: THREE.DoubleSide });
const greenStripe = new THREE.Mesh(greenStripeGeometry, greenMaterial);
greenStripe.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2 + stripeHeight, 0);

// الشريط الأبيض (الوسط)
const whiteStripeGeometry = new THREE.PlaneGeometry(flagWidth, stripeHeight);
const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
const whiteStripe = new THREE.Mesh(whiteStripeGeometry, whiteMaterial);
whiteStripe.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2, 0);

// الشريط الأسود (الأسفل)
const blackStripeGeometry = new THREE.PlaneGeometry(flagWidth, stripeHeight);
const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.DoubleSide });
const blackStripe = new THREE.Mesh(blackStripeGeometry, blackMaterial);
blackStripe.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2 - stripeHeight, 0);

// إضافة ثلاث نجوم حمراء في الوسط (مكبرة)
const starGeometry = new THREE.PlaneGeometry(0.3, 0.3); // تكبير حجم النجوم
const starMaterial = new THREE.MeshStandardMaterial({ color: 0xCE1126, side: THREE.DoubleSide });

// النجمة الأولى (اليسار)
const star1 = new THREE.Mesh(starGeometry, starMaterial);
star1.position.set(rocketRadius + 2 + flagWidth/2 - 0.8, rocketHeight + 2, 0.01);

// النجمة الثانية (الوسط)
const star2 = new THREE.Mesh(starGeometry, starMaterial);
star2.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2, 0.01);

// النجمة الثالثة (اليمين)
const star3 = new THREE.Mesh(starGeometry, starMaterial);
star3.position.set(rocketRadius + 2 + flagWidth/2 + 0.8, rocketHeight + 2, 0.01);

// إضافة جميع أجزاء العلم للمشهد
scene.add(greenStripe);
scene.add(whiteStripe);
scene.add(blackStripe);
scene.add(star1);
scene.add(star2);
scene.add(star3);

// 3. الربط بين الصاروخ والعمود (أسطوانة أفقية صغيرة)
const linkGeometry = new THREE.CylinderGeometry(0.3, 0.3, rocketRadius + 2, 8);
const linkMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const link = new THREE.Mesh(linkGeometry, linkMaterial);
// ضع الربط عند قاعدة الصاروخ، ودوّره ليكون أفقيًا
link.position.set((rocketRadius + 2) / 2, 4 + 1, 0);
link.rotation.z = Math.PI / 2;
scene.add(link);

// 4. الربط العلوي بين الصاروخ والعمود (أسطوانة أفقية صغيرة في أعلى الصاروخ)
const topLinkGeometry = new THREE.CylinderGeometry(0.3, 0.3, rocketRadius +0.5, 8);
const topLinkMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const topLink = new THREE.Mesh(topLinkGeometry, topLinkMaterial);
// ضع الربط في أعلى الصاروخ، ودوّره ليكون أفقيًا
topLink.position.set(2.4, 14 , 0);
topLink.rotation.z = Math.PI / 2;

// 4.5. نصف دائرة تحيط برأس الصاروخ (في الأعلى) - صلبة
const ringMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x444444,
  side: THREE.DoubleSide // عرض الوجهين لمنع الشفافية
});

// إنشاء نصف دائرة صلبة باستخدام TorusGeometry مع إعدادات محسنة
const topRingGeometry = new THREE.TorusGeometry(1, 0.3, 16, 32, Math.PI);
const topRing = new THREE.Mesh(topRingGeometry, ringMaterial);
topRing.position.set(0, 14, 0);
topRing.rotation.x = Math.PI / 2;
topRing.rotation.z = -Math.PI / 2;

// إنشاء الكماشة كمجموعة واحدة
const clampGroup = new THREE.Group();
clampGroup.add(topLink);
clampGroup.add(topRing);
clampGroup.position.set(0,-3, 0); // موضع الكماشة
scene.add(clampGroup);
clampObject = clampGroup;

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
    case 'KeyX': 
      if (!isRotating && !hasRotated) {
        targetRotationAngle += Math.PI / 2; // 90 درجة عكس عقارب الساعة
        isRotating = true;
        hasRotated = true; // تم الدوران
      }
      break;
    case 'KeyL': // مفتاح إطلاق الصاروخ
      if (!isLaunching && hasRotated) {
        startRocketLaunch();
      }
      break;
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

function updateClampRotation() {
  if (clampObject) {
    // أعد الكماشة دائمًا إلى موضعها الأصلي قبل التدوير
    clampObject.position.set(0, -3, 0);
    // تدوير الكماشة إذا كان هناك دوران
    if (isRotating) {
      const diff = targetRotationAngle - clampRotationAngle;
      if (Math.abs(diff) > 0.01) {
        if (diff > 0) {
          clampRotationAngle += clampRotationSpeed;
        } else {
          clampRotationAngle -= clampRotationSpeed;
        }
      } else {
        clampRotationAngle = targetRotationAngle;
        isRotating = false;
      }
    }
    // تطبيق الدوران حول نقطة التقاء مع العمود الجانبي
    clampObject.rotation.z = clampRotationAngle;
    const currentPos = new THREE.Vector3(0, -3, 0);
    const pivotPoint = new THREE.Vector3(4, 11, 0);
    const rotatedPos = currentPos.clone().sub(pivotPoint);
    rotatedPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), clampRotationAngle);
    rotatedPos.add(pivotPoint);
    clampObject.position.copy(rotatedPos);
  }
}

// دالة بدء إطلاق الصاروخ
function startRocketLaunch() {
  if (!rocketObject) {
    console.log('⚠️ الصاروخ غير محمل بعد');
    return;
  }
  
  isLaunching = true;
  rocketLaunchHeight = 0;
  console.log('🚀 بدء إطلاق الصاروخ!');
  console.log('موقع الصاروخ الحالي:', rocketObject.position);
  
  // إخفاء الكماشة عند الإطلاق (باستخدام نفس منطق الاكتشاف)
  let clampHidden = false;
  scene.children.forEach(child => {
    if (child.type === 'Group' && child.children.length > 0) {
      const hasTopLink = child.children.some(grandChild => 
        grandChild.geometry && 
        grandChild.geometry.type === 'CylinderGeometry' &&
        grandChild.material && 
        grandChild.material.color && 
        grandChild.material.color.getHex() === 0xff0000 // اللون الأحمر
      );
      const hasTopRing = child.children.some(grandChild => 
        grandChild.geometry && 
        grandChild.geometry.type === 'TorusGeometry'
      );
      
      if (hasTopLink && hasTopRing) {
        child.visible = false;
        clampHidden = true;
        console.log('🔧 تم إخفاء الكماشة');
      }
    }
  });
  
  if (!clampHidden) {
    console.log('⚠️ لم يتم العثور على الكماشة لإخفائها');
  }
}

// دالة تحديث حركة الصاروخ
function updateRocketLaunch() {
  if (!isLaunching || !rocketObject) return;
  
  // تحريك الصاروخ للأعلى
  rocketObject.position.y += rocketLaunchSpeed;
  rocketLaunchHeight += rocketLaunchSpeed;
  
  // إنشاء جزيئات الدخان
  createSmokeParticle(rocketObject.position.x, rocketObject.position.y - 2, rocketObject.position.z);
  
  // إنشاء جزيئات النار
  createFireParticle(rocketObject.position.x, rocketObject.position.y - 3, rocketObject.position.z);
  
  // إيقاف الإطلاق عند ارتفاع معين
  if (rocketLaunchHeight > 50) {
    isLaunching = false;
    console.log('🚀 تم إطلاق الصاروخ بنجاح!');
  }
}

// دالة إنشاء جزيئات الدخان
function createSmokeParticle(x, y, z) {
  const smokeGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const smokeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x666666,
    transparent: true,
    opacity: 0.8
  });
  
  const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
  smoke.position.set(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3);
  
  smokeParticles.push({
    mesh: smoke,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      Math.random() * 0.3 + 0.2,
      (Math.random() - 0.5) * 0.2
    ),
    life: 1.0
  });
  
  scene.add(smoke);
}

// دالة إنشاء جزيئات النار
function createFireParticle(x, y, z) {
  const fireGeometry = new THREE.SphereGeometry(0.2, 6, 6);
  const fireMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff4400,
    emissive: 0xff2200,
    transparent: true,
    opacity: 0.9
  });
  
  const fire = new THREE.Mesh(fireGeometry, fireMaterial);
  fire.position.set(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2);
  
  launchParticles.push({
    mesh: fire,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.4 + 0.3,
      (Math.random() - 0.5) * 0.3
    ),
    life: 1.0
  });
  
  scene.add(fire);
}

// دالة تحديث الجزيئات
function updateParticles() {
  // تحديث جزيئات الدخان
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const particle = smokeParticles[i];
    particle.mesh.position.add(particle.velocity);
    particle.life -= 0.01; // إبطاء تلاشي الدخان
    particle.mesh.material.opacity = particle.life;
    particle.mesh.scale.setScalar(1 + (1 - particle.life) * 2);
    
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      smokeParticles.splice(i, 1);
    }
  }
  
  // تحديث جزيئات النار
  for (let i = launchParticles.length - 1; i >= 0; i--) {
    const particle = launchParticles[i];
    particle.mesh.position.add(particle.velocity);
    particle.life -= 0.015; // إبطاء تلاشي النار
    particle.mesh.material.opacity = particle.life;
    particle.mesh.scale.setScalar(1 + (1 - particle.life) * 1.5);
    
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      launchParticles.splice(i, 1);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  updateClampRotation();
  updateRocketLaunch();
  updateParticles();
  renderer.render(scene, camera);

  // تحديث إحداثيات الكاميرا
  const camPos = camera.position;
  document.getElementById('cameraCoords').textContent =
    `Camera: x=${camPos.x.toFixed(2)}, y=${camPos.y.toFixed(2)}, z=${camPos.z.toFixed(2)}`;
  
  // تحديث زاوية دوران الكماشة
  const clampRotationElement = document.getElementById('clampRotationStatus');
  if (clampRotationElement) {
    const angleInDegrees = (clampRotationAngle * 180 / Math.PI).toFixed(1);
    clampRotationElement.textContent = `زاوية الدوران: ${angleInDegrees}°`;
  }
  
  // تحديث حالة الإطلاق
  const launchStatusElement = document.getElementById('launchStatus');
  if (launchStatusElement) {
    if (isLaunching) {
      launchStatusElement.textContent = `حالة الإطلاق: 🚀 إطلاق في التقدم...`;
    } else if (hasRotated) {
      launchStatusElement.textContent = `حالة الإطلاق: تم الإطلاق`;
    } else {
      launchStatusElement.textContent = `حالة الإطلاق: اضغط X لبدء الإطلاق`;
    }
  }
}
animate();