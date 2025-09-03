import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// المشهد
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10000, 20000);

// الكاميرا
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 25, 25);
camera.lookAt(0, 0, 0);

// الراسم
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ساعة لحساب الزمن بين الإطارات
const clock = new THREE.Clock();

// الأرض
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 3000),
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
const clampRotationSpeed = 0.005;
const clampPivotPoint = new THREE.Vector3(4, 11, 0);
let isRotating = false;
let targetRotationAngle = 0;
let hasRotated = false;

// متغيرات إطلاق الصاروخ
let isLaunching = false;
let rocketLaunchSpeed = 0.5;
let rocketLaunchHeight = 0;
let rocketOriginalY = 4.5;
let launchParticles = [];
let smokeParticles = [];
let rocketObject = null;
let clampObject = null;
let isInOrbit = false;
let orbitAngle = 0;
const ORBIT_PERIOD_SECONDS = 90;
const ORBIT_ECCENTRICITY = 0.1;
const ORBIT_SEMI_MAJOR_AXIS = 25;

// متغيرات المكعب الأخضر
let greenCube = null;
let cubeOrbitAngle = 0;
const CUBE_ORBIT_RADIUS = 80; // نفس نصف قطر المدار الأحمر
const CUBE_ORBIT_SPEED = 0.02;

// مراحل ما بعد الغيوم
const FOG_START_Y = 200;
const FOG_END_Y = 330;
let rocketSpeedGround = rocketLaunchSpeed;
let rocketSpeedSpace = 0.2;
const desiredCloudsToOrbitTimeRatio = 3;
const rocketScaleGround = 1;
const rocketScaleSpaceEnd = 0.1;

// متغيرات إحداثيات قاعدة المخروط المبتور
let frustumBaseX = 0;
let frustumBaseY = 0.5;
let frustumBaseZ = -0.;

// قيمة ارتفاع الوصول إلى المدار
const orbitTargetY = 370;

// تعريف المتغيرات العامة للعناصر الأرضية
let launchBase, column, flagPole, greenStripe, whiteStripe, blackStripe, star1, star2, star3;

// دالة إنشاء المدار المرئي
function createOrbitRing() {
  const orbitGeometry = new THREE.TorusGeometry(CUBE_ORBIT_RADIUS, 0.5, 16, 100);
  const orbitMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.6
  });
  const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbitRing.rotation.x = Math.PI / 2;
  scene.add(orbitRing);
  console.log('🔴 تم إنشاء المدار المرئي');
}

// دالة إنشاء المكعب الأخضر
function createGreenCube() {
  const cubeGeometry = new THREE.BoxGeometry(3, 3, 3);
  const cubeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    emissive: 0x004400,
    metalness: 0.8,
    roughness: 0.2
  });
  
  greenCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  greenCube.position.set(CUBE_ORBIT_RADIUS, 0, 0);
  greenCube.rotation.y = Math.PI / 4; // دوران بسيط للمكعب
  
  scene.add(greenCube);
  console.log('🟢 تم إنشاء المكعب الأخضر');
}

// تحميل نموذج Saturn V
const loader = new GLTFLoader();
loader.load('SaturnV.glb', (gltf) => {
  const rocket = gltf.scene;
  rocket.scale.set(1, 1, 1);
  rocket.position.set(0, 4.5, -0.7);
  rocketObject = rocket;
  scene.add(rocket);
  
  // قاعدة مخروطية تحت الصاروخ
  const coneBaseRadius = 6;
  const coneTopRadius = 2;
  const coneHeight = 8;
  const frustumGeometry = new THREE.CylinderGeometry(coneTopRadius, coneBaseRadius, coneHeight, 32);
  const frustumMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const frustumBase = new THREE.Mesh(frustumGeometry, frustumMaterial);
  frustumBase.position.set(frustumBaseX, frustumBaseY, frustumBaseZ);
  scene.add(frustumBase);
  
  // قاعدة إطلاق إسمنتية كبيرة
  launchBase = new THREE.Mesh(
    new THREE.BoxGeometry(40, 4, 40),
    new THREE.MeshStandardMaterial({ color: 0x777777 })
  );
  launchBase.position.set(0, 0.5, 0);
  scene.add(launchBase);
  
  // أرجل أو أعمدة دعم على الزوايا
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const legGeometry = new THREE.CylinderGeometry(1, 1, 20, 16);
  const legPositions = [
    [15, 0, 15],
    [-15, 0, 15],
    [-15, 0, -15],
    [15, 0, -15]
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(x, y, z);
    scene.add(leg);
  });
  
  // العمود الجانبي
  const rocketRadius = 2;
  const rocketHeight = 20;
  const columnGeometry = new THREE.CylinderGeometry(0.5, 0.5, rocketHeight, 16);
  const columnMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  column = new THREE.Mesh(columnGeometry, columnMaterial);
  column.position.set(rocketRadius + 2, rocketHeight / 2, 0);
  scene.add(column);
  
  // إضافة علم سوريا في قمة العمود
  const flagPoleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4, 8);
  const flagPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  flagPole = new THREE.Mesh(flagPoleGeometry, flagPoleMaterial);
  flagPole.position.set(rocketRadius + 2, rocketHeight + 2, 0);
  scene.add(flagPole);
  
  // إنشاء علم سوريا
  const flagWidth = 3;
  const flagHeight = 2;
  const stripeHeight = flagHeight / 3;
  const greenStripeGeometry = new THREE.PlaneGeometry(flagWidth, stripeHeight);
  const greenMaterial = new THREE.MeshStandardMaterial({ color: 0x007A3D, side: THREE.DoubleSide });
  greenStripe = new THREE.Mesh(greenStripeGeometry, greenMaterial);
  greenStripe.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2 + stripeHeight, 0);
  
  const whiteStripeGeometry = new THREE.PlaneGeometry(flagWidth, stripeHeight);
  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
  whiteStripe = new THREE.Mesh(whiteStripeGeometry, whiteMaterial);
  whiteStripe.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2, 0);
  
  const blackStripeGeometry = new THREE.PlaneGeometry(flagWidth, stripeHeight);
  const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.DoubleSide });
  blackStripe = new THREE.Mesh(blackStripeGeometry, blackMaterial);
  blackStripe.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2 - stripeHeight, 0);
  
  // النجوم
  const starGeometry = new THREE.PlaneGeometry(0.3, 0.3);
  const starMaterial = new THREE.MeshStandardMaterial({ color: 0xCE1126, side: THREE.DoubleSide });
  star1 = new THREE.Mesh(starGeometry, starMaterial);
  star1.position.set(rocketRadius + 2 + flagWidth/2 - 0.8, rocketHeight + 2, 0.01);
  star2 = new THREE.Mesh(starGeometry, starMaterial);
  star2.position.set(rocketRadius + 2 + flagWidth/2, rocketHeight + 2, 0.01);
  star3 = new THREE.Mesh(starGeometry, starMaterial);
  star3.position.set(rocketRadius + 2 + flagWidth/2 + 0.8, rocketHeight + 2, 0.01);
  
  scene.add(greenStripe);
  scene.add(whiteStripe);
  scene.add(blackStripe);
  scene.add(star1);
  scene.add(star2);
  scene.add(star3);
  
  // الربط بين الصاروخ والعمود
  const linkGeometry = new THREE.CylinderGeometry(0.3, 0.3, rocketRadius + 2, 8);
  const linkMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const link = new THREE.Mesh(linkGeometry, linkMaterial);
  link.position.set((rocketRadius + 2) / 2, 4 + 1, 0);
  link.rotation.z = Math.PI / 2;
  scene.add(link);
  
  // الربط العلوي
  const topLinkGeometry = new THREE.CylinderGeometry(0.3, 0.3, rocketRadius + 0.5, 8);
  const topLinkMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const topLink = new THREE.Mesh(topLinkGeometry, topLinkMaterial);
  topLink.position.set(2.4, 14, 0);
  topLink.rotation.z = Math.PI / 2;
  
  // نصف دائرة تحيط برأس الصاروخ
  const ringMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444,
    side: THREE.DoubleSide
  });
  const topRingGeometry = new THREE.TorusGeometry(1, 0.3, 16, 32, Math.PI);
  const topRing = new THREE.Mesh(topRingGeometry, ringMaterial);
  topRing.position.set(0, 14, 0);
  topRing.rotation.x = Math.PI / 2;
  topRing.rotation.z = -Math.PI / 2;
  
  // إنشاء الكماشة كمجموعة واحدة
  const clampGroup = new THREE.Group();
  clampGroup.add(topLink);
  clampGroup.add(topRing);
  clampGroup.position.set(0, -3, 0);
  scene.add(clampGroup);
  clampObject = clampGroup;
  
  console.log('✅ تم تحميل نموذج الصاروخ بنجاح');
  
  // إنشاء المكعب الأخضر
  createGreenCube();
  
  // إنشاء مدار مرئي للمكعب الأخضر
  createOrbitRing();
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
        targetRotationAngle += Math.PI / 2;
        isRotating = true;
        hasRotated = true;
        console.log('🔄 بدء دوران الكماشة...');
      }
      break;
    case 'KeyL':
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
    clampObject.position.set(0, -3, 0);
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
        console.log('✅ تم إكمال دوران الكماشة');
      }
    }
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
  rocketSpeedGround = rocketLaunchSpeed;
  const d1 = Math.max(FOG_END_Y - rocketObject.position.y, 1e-6);
  const d2 = Math.max(orbitTargetY - FOG_END_Y, 1e-6);
  rocketSpeedSpace = rocketSpeedGround * d2 / (desiredCloudsToOrbitTimeRatio * d1);
  rocketSpeedSpace = Math.min(Math.max(rocketSpeedSpace, 0.05), rocketSpeedGround);
  
  console.log('🚀 بدء إطلاق الصاروخ!');
  
  // إخفاء الكماشة عند الإطلاق
  let clampHidden = false;
  scene.children.forEach(child => {
    if (child.type === 'Group' && child.children.length > 0) {
      const hasTopLink = child.children.some(grandChild => 
        grandChild.geometry && 
        grandChild.geometry.type === 'CylinderGeometry' &&
        grandChild.material && 
        grandChild.material.color && 
        grandChild.material.color.getHex() === 0xff0000
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
  
  // إظهار شريط التقدم
  if (window.showProgressBar) {
    window.showProgressBar();
  }
}

// دالة تحديث حركة الصاروخ
function updateRocketLaunch() {
  if (!isLaunching || !rocketObject) return;
  
  const currentSpeed = (rocketObject.position.y < FOG_END_Y) ? rocketSpeedGround : rocketSpeedSpace;
  rocketObject.position.y += currentSpeed;
  rocketLaunchHeight += rocketLaunchSpeed;
  
  // مسار منحني: بعد الغيوم قوس سلس لليمين
  if (rocketObject.position.y > FOG_END_Y) {
    const curveStartY = FOG_END_Y;
    const curveEndY = orbitTargetY;
    const t = Math.min(Math.max((rocketObject.position.y - curveStartY) / Math.max(curveEndY - curveStartY, 1e-6), 0), 1);
    const maxHorizontalOffset = 80;
    
    const horizontalOffset = maxHorizontalOffset * (1 - Math.cos(t * Math.PI * 0.5));
    rocketObject.position.x = horizontalOffset;
    rocketObject.position.z = -0.7;
    
    // دوران سلس لرأس الصاروخ
    if (rocketObject.position.y > curveStartY + 1) {
      const prevY = rocketObject.position.y - currentSpeed;
      const prevT = Math.min(Math.max((prevY - curveStartY) / Math.max(curveEndY - curveStartY, 1e-6), 0), 1);
      const prevHorizontalOffset = maxHorizontalOffset * (1 - Math.cos(prevT * Math.PI * 0.5));
      
      const deltaX = horizontalOffset - prevHorizontalOffset;
      const deltaY = currentSpeed;
      const movementAngle = Math.atan2(deltaX, deltaY);
      
      rocketObject.rotation.z = -movementAngle;
      
      if (t > 0.8) {
        const finalRotationT = (t - 0.8) / 0.2;
        const targetRotationZ = -Math.PI / 2;
        const currentRotationZ = rocketObject.rotation.z;
        rocketObject.rotation.z = THREE.MathUtils.lerp(currentRotationZ, targetRotationZ, finalRotationT * 0.1);
      }
      
      if (isInOrbit) {
        rocketObject.rotation.z = -Math.PI / 2;
        rocketObject.scale.setScalar(1);
      }
    }
  }
  
  // إنشاء جزيئات الدخان والنار
  createSmokeParticle(rocketObject.position.x, rocketObject.position.y - 2, rocketObject.position.z);
  createFireParticle(rocketObject.position.x, rocketObject.position.y - 3, rocketObject.position.z);
  
  // ضبط مقياس الصاروخ
  if (rocketObject.position.y < FOG_END_Y) {
    rocketObject.scale.setScalar(rocketScaleGround);
  } else {
    const tScale = Math.min(Math.max((rocketObject.position.y - FOG_END_Y) / Math.max((orbitTargetY - FOG_END_Y), 1e-6), 0), 1);
    const scaleVal = THREE.MathUtils.lerp(rocketScaleGround, rocketScaleSpaceEnd, tScale);
    rocketObject.scale.setScalar(scaleVal);
  }

  // تحديث شريط التقدم
  if (window.updateProgress) {
    const progress = Math.min((rocketObject.position.y / orbitTargetY) * 100, 100);
    window.updateProgress(Math.round(progress));
  }

  // التوقف عند ارتفاع المدار
  if (rocketObject.position.y >= orbitTargetY) {
    isLaunching = false;
    isInOrbit = true;
    orbitAngle = 0;
    console.log('🚀 تم إطلاق الصاروخ ووصل إلى المدار!');
    
    // إخفاء شريط التقدم
    if (window.hideProgressBar) {
      window.hideProgressBar();
    }
    
    // إظهار شاشة الانتقال
    setTimeout(() => {
      if (window.showStageTransition) {
        window.showStageTransition();
      }
    }, 1000);
  }
}

// دالة تحديث حركة المكعب الأخضر
function updateGreenCube() {
  if (greenCube && isInOrbit) {
    // تحديث زاوية المدار
    cubeOrbitAngle += CUBE_ORBIT_SPEED;
    
    // حساب الموضع في المدار
    const x = CUBE_ORBIT_RADIUS * Math.cos(cubeOrbitAngle);
    const z = CUBE_ORBIT_RADIUS * Math.sin(cubeOrbitAngle);
    
    // تحريك المكعب
    greenCube.position.set(x, 0, z);
    
    // دوران المكعب حول محوره
    greenCube.rotation.y += 0.02;
    greenCube.rotation.z += 0.01;
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
    particle.life -= 0.01;
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
    particle.life -= 0.015;
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
  const dt = clock.getDelta();
  
  updateMovement();
  updateClampRotation();
  updateRocketLaunch();
  updateGreenCube();
  updateParticles();

  // تتبع الكاميرا للصاروخ أثناء الإطلاق
  if (isLaunching && rocketObject) {
    const followOffsetY = 10;
    const followOffsetZ = 35;
    camera.position.x = rocketObject.position.x;
    camera.position.y = rocketObject.position.y + followOffsetY;
    camera.position.z = rocketObject.position.z + followOffsetZ;
    camera.lookAt(
      rocketObject.position.x,
      rocketObject.position.y + 5,
      rocketObject.position.z
    );
  }
  
  // إبقاء الكاميرا في الفضاء عند الوصول للمدار
  if (isInOrbit && !isLaunching) {
    // موضع ثابت في الفضاء لرؤية الكرة الأرضية
    camera.position.set(0, 100, 120);
    camera.lookAt(0, 0, 0);
    
    // إخفاء الصاروخ عند الوصول للمدار
    if (rocketObject) {
      rocketObject.visible = false;
    }
  }

  // انتقال الضباب تدريجياً مع الارتفاع
  let fogStart = 200, fogEnd = 330;
  if (camera.position.y < fogStart) {
    scene.fog.near = 10000;
    scene.fog.far = 20000;
  } else if (camera.position.y < fogEnd) {
    let t = (camera.position.y - fogStart) / (fogEnd - fogStart);
    scene.fog.near = 50 + t * 200;
    scene.fog.far = 1000 - t * 800;
  } else {
    scene.fog.near = 10000;
    scene.fog.far = 20000;
  }

  // تصغير واختفاء الأرض المسطحة ومحتوياتها
  const groundFadeStart = 200;
  const groundFadeEnd = 330;
  let groundT = 1;
  
  if (camera.position.y > 300) {
    groundT = 0;
  } else if (camera.position.y > groundFadeStart) {
    groundT = 1 - Math.min((camera.position.y - groundFadeStart) / (groundFadeEnd - groundFadeStart), 1);
  }
  
  ground.visible = groundT > 0.01;
  ground.scale.setScalar(groundT);
  
  if (launchBase) { launchBase.visible = groundT > 0.01; launchBase.scale.setScalar(groundT); }
  
  scene.children.forEach(obj => {
    if (obj.geometry && obj.geometry.type === 'CylinderGeometry' && obj !== column) {
      obj.visible = groundT > 0.01;
      obj.scale.setScalar(groundT);
    }
  });
  
  if (column) { column.visible = groundT > 0.01; column.scale.setScalar(groundT); }
  if (flagPole) { flagPole.visible = groundT > 0.01; flagPole.scale.setScalar(groundT); }
  if (greenStripe) { greenStripe.visible = groundT > 0.01; greenStripe.scale.setScalar(groundT); }
  if (whiteStripe) { whiteStripe.visible = groundT > 0.01; whiteStripe.scale.setScalar(groundT); }
  if (blackStripe) { blackStripe.visible = groundT > 0.01; blackStripe.scale.setScalar(groundT); }
  if (star1) { star1.visible = groundT > 0.01; star1.scale.setScalar(groundT); }
  if (star2) { star2.visible = groundT > 0.01; star2.scale.setScalar(groundT); }
  if (star3) { star3.visible = groundT > 0.01; star3.scale.setScalar(groundT); }
  
  if (rocketObject) {
    if (isLaunching || isInOrbit) {
      rocketObject.visible = true;
      rocketObject.scale.setScalar(1);
    } else {
      rocketObject.visible = groundT > 0.01;
      rocketObject.scale.setScalar(groundT);
    }
  }
  
  if (clampObject) { clampObject.visible = groundT > 0.01; clampObject.scale.setScalar(groundT); }

  // منطق تقليص الرؤية
  const cameraHeight = camera.position.y;
  let minFov = 30, maxFov = 75, minHeight = 50, maxHeight = 600;
  if (cameraHeight > minHeight) {
    let t = Math.min((cameraHeight - minHeight) / (maxHeight - minHeight), 1);
    camera.fov = maxFov - t * (maxFov - minFov);
    camera.updateProjectionMatrix();
  } else {
    camera.fov = maxFov;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);

  // تحديث واجهة المستخدم
  const camPos = camera.position;
  document.getElementById('cameraCoords').textContent =
    `x: ${camPos.x.toFixed(2)}, y: ${camPos.y.toFixed(2)}, z: ${camPos.z.toFixed(2)}`;
  
  const clampRotationElement = document.getElementById('clampRotationStatus');
  if (clampRotationElement) {
    const angleInDegrees = (clampRotationAngle * 180 / Math.PI).toFixed(1);
    clampRotationElement.textContent = `${angleInDegrees}°`;
  }
  
  const launchStatusElement = document.getElementById('launchStatus');
  if (launchStatusElement) {
    if (isLaunching) {
      launchStatusElement.textContent = '🚀 إطلاق في التقدم...';
    } else if (hasRotated) {
      launchStatusElement.textContent = 'تم الإطلاق';
    } else {
      launchStatusElement.textContent = 'اضغط X لبدء الإطلاق';
    }
  }
  
  const altitudeStatusElement = document.getElementById('altitudeStatus');
  if (altitudeStatusElement && rocketObject) {
    const altitude = Math.round(rocketObject.position.y);
    altitudeStatusElement.textContent = `${altitude} متر`;
  }
}

// بدء الرسم
animate();

// معالجة تغيير حجم النافذة
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('🚀 تم تحميل المرحلة الأولى: إطلاق الصاروخ');
console.log('🎮 استخدم X لتدوير الكماشة');
console.log('🎮 استخدم L لإطلاق الصاروخ');
console.log('⏳ الانتقال التلقائي للمرحلة الثانية عند الوصول للمدار');
console.log('🟢 المكعب الأخضر سيدور في المدار الأحمر حول الكرة الأرضية');
