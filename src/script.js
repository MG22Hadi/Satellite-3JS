import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// المشهد
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10000, 20000); // الضباب مفعّل دائماً بقيم بعيدة جداً

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

// ساعة لحساب الزمن بين الإطارات (Delta Time)
const clock = new THREE.Clock();
// سرعة دوران الأرض الواقعية (راديان في الثانية): دورة كاملة كل 24 ساعة
const EARTH_ROTATION_RAD_PER_SEC = (2 * Math.PI) / (24 * 60 * 60);
// مُعامل تضخيم بسيط لجعل الدوران مرئيًا قليلًا مع الحفاظ على الواقعية النسبية
const EARTH_ROTATION_VISIBILITY_MULTIPLIER = 30; // غيّره بين 10 و 30 حسب تفضيلك

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
let isInOrbit = false; // هل وصل الصاروخ للمدار؟
let orbitAngle = 0; // زاوية دوران الصاروخ في المدار
const ORBIT_PERIOD_SECONDS = 90; // دورة المدار بالثواني (أقصر من الواقع لكن مرئي)
const ORBIT_ECCENTRICITY = 0.1; // انحراف المدار (0 = دائري، 0.1 = إهليلجي خفيف)
const ORBIT_SEMI_MAJOR_AXIS = 25; // نصف المحور الرئيسي للمدار

// مراحل ما بعد الغيوم: تحكم بالسرعة والحجم للإحساس بالمسافة
const FOG_START_Y = 200;
const FOG_END_Y = 330;
let rocketSpeedGround = rocketLaunchSpeed; // السرعة قبل الغيوم
let rocketSpeedSpace = 0.2; // تُحسب عند الإطلاق لتحقيق نسبة 3x
const desiredCloudsToOrbitTimeRatio = 3; // الزمن من الغيوم للمدار = 3x زمن من الإطلاق للغيوم
const rocketScaleGround = 1;
const rocketScaleSpaceEnd = 0.1; // الحجم عند المدار لإحساس أقوى بالبعد

// --- متغيرات إحداثيات قاعدة المخروط المبتور ---
let frustumBaseX = 0;
let frustumBaseY =0.5 ; // الافتراضي: نصف الارتفاع
let frustumBaseZ = -0.; // نفس إزاحة الصاروخ

// قيمة ارتفاع الوصول إلى المدار (تُستخدم في أكثر من موضع)
const orbitTargetY = 370; // يمكن تعديلها لاحقًا لتصبح ديناميكية

// تعريف المتغيرات العامة للعناصر الأرضية
let launchBase, column, flagPole, greenStripe, whiteStripe, blackStripe, star1, star2, star3;

// تحميل نموذج Saturn V وتجزئة المراحل
const loader = new GLTFLoader();
loader.load('SaturnV.glb', (gltf) => {
  const rocket = gltf.scene;
  rocket.scale.set(1, 1, 1);
  rocket.position.set(0, 4.5, -0.7);
  rocketObject = rocket;
  scene.add(rocket);
  // --- قاعدة مخروطية تحت الصاروخ ---
  // قاعدة مخروطية مبتورة (Frustum)
  const coneBaseRadius = 6; // القاعدة السفلية
  const coneTopRadius = 2;  // الدائرة العلوية الصغيرة
  const coneHeight = 8;
  const frustumGeometry = new THREE.CylinderGeometry(coneTopRadius, coneBaseRadius, coneHeight, 32);
  const frustumMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const frustumBase = new THREE.Mesh(frustumGeometry, frustumMaterial);
  // استخدم المتغيرات للتحكم في موضع القاعدة
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
    [-15,0, 15],
    [-15, 0, -15],
    [15, 0, -15]
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(x, y, z);
    scene.add(leg);
  });
  // 2. العمود الجانبي
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

// --- كرة الأرضية ---
let earthMesh = null;
const earthGeometry = new THREE.SphereGeometry(20, 64, 64);
const earthTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture });
earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
earthMesh.position.set(0, 0, 0); // في مركز المشهد
const initialEarthScale = 20;
earthMesh.scale.setScalar(initialEarthScale);
earthMesh.visible = false;
// اجعل خط الاستواء في الواجهة (وليس القطب)
earthMesh.rotation.x = -Math.PI /2.8; // خط الاستواء في المنتصف
// أضف دوران حول Y ليكون الشرق الأوسط في المنتصف
const middleEastLongitude = 100; // أو 120 أو 140 حسب التجربة
earthMesh.rotation.y = -middleEastLongitude / 360 * Math.PI+4.9;
scene.add(earthMesh);

// مدار القمر الصناعي حول الأرض (حلقة رفيعة)
const baseOrbitRadius = 25; // 3 * نصف قطر الأرض الأصلي
const orbitTube = 0.1; // سماكة رفيعة جداً
const orbitRadialSegments = 64;
const orbitTubularSegments = 200;

const orbitGeometry = new THREE.TorusGeometry(baseOrbitRadius, orbitTube, orbitRadialSegments, orbitTubularSegments);
const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // أحمر
const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);

orbitRing.position.copy(earthMesh.position); // نفس مركز الكرة الأرضية
orbitRing.rotation.x = Math.PI ; // حول خط الاستواء

scene.add(orbitRing);

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
  // حساب سرعة ما بعد الغيوم لتحقيق نسبة زمن 3x بين (الغيوم→المدار) و(الإطلاق→الغيوم)
  rocketSpeedGround = rocketLaunchSpeed;
  const d1 = Math.max(FOG_END_Y - rocketObject.position.y, 1e-6);
  const d2 = Math.max(orbitTargetY - FOG_END_Y, 1e-6);
  rocketSpeedSpace = rocketSpeedGround * d2 / (desiredCloudsToOrbitTimeRatio * d1);
  // حد أمان لعدم بطء شديد أو سرعة كبيرة
  rocketSpeedSpace = Math.min(Math.max(rocketSpeedSpace, 0.05), rocketSpeedGround);
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
  
  // تحريك الصاروخ للأعلى بسرعات متفاوتة حسب المرحلة
  const currentSpeed = (rocketObject.position.y < FOG_END_Y) ? rocketSpeedGround : rocketSpeedSpace;
  rocketObject.position.y += currentSpeed;
  rocketLaunchHeight += rocketLaunchSpeed;
  
  // مسار منحني: بعد الغيوم قوس سلس لليمين مع دوران رأس الصاروخ
  if (rocketObject.position.y > FOG_END_Y) {
    const curveStartY = FOG_END_Y;
    const curveEndY = orbitTargetY;
    const t = Math.min(Math.max((rocketObject.position.y - curveStartY) / Math.max(curveEndY - curveStartY, 1e-6), 0), 1);
    const maxHorizontalOffset = 80; // قوة الانحناء لليمين
    
    // قوس سلس لليمين: من عمودي إلى أفقي (تقعر بالاتجاه المعاكس)
    const horizontalOffset = maxHorizontalOffset * (1 - Math.cos(t * Math.PI * 0.5)); // قوس محدب من 0 إلى +80
    
    // تحديث موضع الصاروخ
    rocketObject.position.x = horizontalOffset;
    rocketObject.position.z = -0.7;
    
    // دوران سلس لرأس الصاروخ: دائماً في اتجاه الحركة
    if (rocketObject.position.y > curveStartY + 1) { // تجنب القسمة على صفر
      const prevY = rocketObject.position.y - currentSpeed;
      const prevT = Math.min(Math.max((prevY - curveStartY) / Math.max(curveEndY - curveStartY, 1e-6), 0), 1);
      const prevHorizontalOffset = maxHorizontalOffset * (1 - Math.cos(prevT * Math.PI * 0.5));
      
      // حساب اتجاه الحركة
      const deltaX = horizontalOffset - prevHorizontalOffset;
      const deltaY = currentSpeed;
      const movementAngle = Math.atan2(deltaX, deltaY);
      
      // تطبيق الدوران السلس: رأس الصاروخ في اتجاه الحركة
      rocketObject.rotation.z = -movementAngle; // دوران حول المحور Z للانحراف الأفقي
      
      // دوران إضافي لجعل الصاروخ أفقي بالكامل عند المدار
      if (t > 0.8) { // في آخر 20% من المسار
        const finalRotationT = (t - 0.8) / 0.2; // من 0 إلى 1
        const targetRotationZ = -Math.PI / 2; // 90 درجة لليمين (أفقي)
        const currentRotationZ = rocketObject.rotation.z;
        rocketObject.rotation.z = THREE.MathUtils.lerp(currentRotationZ, targetRotationZ, finalRotationT * 0.1); // انتقال سلس
      }
      
      // عند الوصول للمدار: رأس الصاروخ منطبق على المدار
      if (isInOrbit) {
        // جعل الصاروخ أفقي تماماً ومطابق للمدار
        rocketObject.rotation.z = -Math.PI / 2; // 90 درجة لليمين (أفقي)
        rocketObject.scale.setScalar(1); // حجم ثابت
      }
    }
  }
  
  // إنشاء جزيئات الدخان
  createSmokeParticle(rocketObject.position.x, rocketObject.position.y - 2, rocketObject.position.z);
  
  // إنشاء جزيئات النار
  createFireParticle(rocketObject.position.x, rocketObject.position.y - 3, rocketObject.position.z);
  
  // ضبط مقياس الصاروخ تدريجيًا بعد الغيوم لإحساس المسافة (ينتقل من 1 إلى rocketScaleSpaceEnd)
  if (rocketObject.position.y < FOG_END_Y) {
    rocketObject.scale.setScalar(rocketScaleGround);
  } else {
    const tScale = Math.min(Math.max((rocketObject.position.y - FOG_END_Y) / Math.max((orbitTargetY - FOG_END_Y), 1e-6), 0), 1);
    const scaleVal = THREE.MathUtils.lerp(rocketScaleGround, rocketScaleSpaceEnd, tScale);
    rocketObject.scale.setScalar(scaleVal);
  }

  // --- التوقف عند ارتفاع المدار الأحمر ---
  if (rocketObject.position.y >= orbitTargetY) {
    isLaunching = false;
    isInOrbit = true;
    orbitAngle = 0; // إعادة تعيين زاوية المدار
    console.log('🚀 تم إطلاق الصاروخ ووصل إلى المدار!');
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
  const dt = clock.getDelta();
  updateMovement();
  updateClampRotation();
  updateRocketLaunch();
  updateParticles();

  // تتبع الكاميرا للصاروخ أثناء الإطلاق ليبقى في منتصف الشاشة مع إبعاد للخلف لظهور كامل الصاروخ
  if (isLaunching && rocketObject) {
    const followOffsetY = 10; // ارتفاع الكاميرا فوق الصاروخ
    const followOffsetZ = 35; // مسافة الكاميرا خلف الصاروخ
    camera.position.x = rocketObject.position.x;
    camera.position.y = rocketObject.position.y + followOffsetY;
    camera.position.z = rocketObject.position.z + followOffsetZ;
    camera.lookAt(
      rocketObject.position.x,
      rocketObject.position.y + 5, // النظر نحو منتصف الصاروخ تقريبًا
      rocketObject.position.z
    );
  }

  // --- انتقال الضباب تدريجياً مع الارتفاع ---
  let fogStart = 200, fogEnd = 330;
  if (camera.position.y < fogStart) {
    scene.fog.near = 10000;
    scene.fog.far = 20000;
  } else if (camera.position.y < fogEnd) {
    let t = (camera.position.y - fogStart) / (fogEnd - fogStart); // من 0 إلى 1
    scene.fog.near = 50 + t * 200; // من 50 إلى 250
    scene.fog.far = 1000 - t * 800; // من 1000 إلى 200
  } else {
    // بعد 330، الضباب يختفي تماماً
    scene.fog.near = 10000;
    scene.fog.far = 20000;
  }

  // --- تصغير واختفاء الأرض المسطحة ومحتوياتها تدريجياً ---
  const groundFadeStart = 200;
  const groundFadeEnd = 330;
  let groundT = 1;
  // إذا تجاوزنا ارتفاع 300 (انتهاء الضباب)، نخفي كل العناصر الأرضية فوراً
  if (camera.position.y > 300) {
    groundT = 0;
  } else if (camera.position.y > groundFadeStart) {
    groundT = 1 - Math.min((camera.position.y - groundFadeStart) / (groundFadeEnd - groundFadeStart), 1);
  }
  ground.visible = groundT > 0.01;
  ground.scale.setScalar(groundT);
  if (launchBase) { launchBase.visible = groundT > 0.01; launchBase.scale.setScalar(groundT); }
  // إخفاء أرجل الدعم مع الأرض
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
      rocketObject.scale.setScalar(1); // حجم ثابت عند الإطلاق أو عند المدار
    } else {
      rocketObject.visible = groundT > 0.01;
      rocketObject.scale.setScalar(groundT);
    }
  }
  if (clampObject) { clampObject.visible = groundT > 0.01; clampObject.scale.setScalar(groundT); }

  // --- ظهور الأرض الكروية تدريجياً مع الارتفاع ---
  if (earthMesh) {
    if (camera.position.y >= 330) {
      earthMesh.rotation.y += EARTH_ROTATION_RAD_PER_SEC * EARTH_ROTATION_VISIBILITY_MULTIPLIER * dt; // دوران واقعي مع تضخيم مرئي
    }
    const earthAppearStart = 300, earthAppearEnd = 600;
    let t = Math.min(Math.max((camera.position.y - earthAppearStart) / (earthAppearEnd - earthAppearStart), 0), 1);
    let scale = initialEarthScale - t * (initialEarthScale - 1.5);
    earthMesh.visible = t > 0.01;
    earthMesh.material.transparent = false;
    earthMesh.material.opacity = 1;
    earthMesh.scale.setScalar(scale);
    orbitRing.scale.setScalar(scale);
    if (camera.position.y >= 330) {
      orbitRing.visible = true;
    } else {
      orbitRing.visible = false;
    }
  }

  // --- منطق تقليص الرؤية ---
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

  // تحديث إحداثيات الكاميرا
  const camPos = camera.position;
  document.getElementById('cameraCoords').textContent =
    `Camera: x=${camPos.x.toFixed(2)}, y=${camPos.y.toFixed(2)}, z=${camPos.z.toFixed(2)}`;
  
  const clampRotationElement = document.getElementById('clampRotationStatus');
  if (clampRotationElement) {
    const angleInDegrees = (clampRotationAngle * 180 / Math.PI).toFixed(1);
    clampRotationElement.textContent = `زاوية الدوران: ${angleInDegrees}°`;
  }
  
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