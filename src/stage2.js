import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// المشهد
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011); // لون الفضاء الداكن
scene.fog = new THREE.Fog(0x000011, 100, 200);

// الكاميرا
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 50, 50);
camera.lookAt(0, 0, 0);

// الراسم
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ساعة لحساب الزمن بين الإطارات
const clock = new THREE.Clock();

// متغيرات المدار
let isInOrbit = false;
let orbitAngle = 0;
const ORBIT_RADIUS = 30;
let ORBIT_SPEED = 0.01;

// متغيرات القمر الصناعي
let satellite = null;
let satelliteOrbitAngle = 0;
const SATELLITE_ORBIT_RADIUS = 35; // مدار أكبر من مدار الصاروخ
const SATELLITE_SPEED = 0.015; // سرعة أسرع قليلاً

// إضاءة الفضاء
const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);

// متغيرات أجزاء الصاروخ
let rocketParts = {
  lowerStage: null,
  upperStage: null,
  payload: null
};

// إنشاء أجزاء الصاروخ المنفصلة
function createRocketParts() {
  console.log('🚀 إنشاء أجزاء الصاروخ للمدار...');
  
  // إنشاء المرحلة السفلى - أسطوانة كبيرة
  const lowerGeometry = new THREE.CylinderGeometry(2.5, 3, 10, 16);
  const lowerMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff4444,
    metalness: 0.8,
    roughness: 0.2
  });
  rocketParts.lowerStage = new THREE.Mesh(lowerGeometry, lowerMaterial);
  rocketParts.lowerStage.position.set(0, 0, 0);
  scene.add(rocketParts.lowerStage);
  
  // إنشاء المرحلة العلوية - أسطوانة متوسطة
  const upperGeometry = new THREE.CylinderGeometry(1.8, 2.2, 8, 16);
  const upperMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x44ff44,
    metalness: 0.8,
    roughness: 0.2
  });
  rocketParts.upperStage = new THREE.Mesh(upperGeometry, upperMaterial);
  rocketParts.upperStage.position.set(0, 0, 0);
  scene.add(rocketParts.upperStage);
  
  // إنشاء الحمولة - مخروط
  const payloadGeometry = new THREE.ConeGeometry(1.2, 6, 16);
  const payloadMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4444ff,
    metalness: 0.8,
    roughness: 0.2
  });
  rocketParts.payload = new THREE.Mesh(payloadGeometry, payloadMaterial);
  rocketParts.payload.position.set(0, 0, 0);
  scene.add(rocketParts.payload);
  
  console.log('✅ تم إنشاء أجزاء الصاروخ بنجاح');
}

// إنشاء القمر الصناعي
function createSatellite() {
  console.log('🛰️ إنشاء القمر الصناعي...');
  
  // إنشاء مجموعة للقمر الصناعي
  satellite = new THREE.Group();
  
  // جسم القمر الصناعي الرئيسي - مكعب
  const bodyGeometry = new THREE.BoxGeometry(2, 2, 2);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888,
    metalness: 0.9,
    roughness: 0.1
  });
  const satelliteBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
  satellite.add(satelliteBody);
  
  // ألواح الطاقة الشمسية
  const solarPanelGeometry = new THREE.BoxGeometry(4, 0.1, 2);
  const solarPanelMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2244aa,
    metalness: 0.7,
    roughness: 0.3
  });
  
  // اللوح الأيمن
  const rightPanel = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
  rightPanel.position.set(3, 0, 0);
  satellite.add(rightPanel);
  
  // اللوح الأيسر
  const leftPanel = new THREE.Mesh(solarPanelGeometry, solarPanelMaterial);
  leftPanel.position.set(-3, 0, 0);
  satellite.add(leftPanel);
  
  // هوائي الاتصال
  const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
  const antennaMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x666666,
    metalness: 0.8,
    roughness: 0.2
  });
  const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  antenna.position.set(0, 1.5, 0);
  satellite.add(antenna);
  
  // وضع القمر الصناعي في مداره
  satellite.position.set(SATELLITE_ORBIT_RADIUS, 0, 0);
  satellite.rotation.y = Math.PI / 2; // توجيه القمر الصناعي في اتجاه الحركة
  
  scene.add(satellite);
  
  console.log('✅ تم إنشاء القمر الصناعي بنجاح');
}

// إنشاء الأرض
function createEarth() {
  const earthGeometry = new THREE.SphereGeometry(20, 64, 64);
  const earthTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
  const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture });
  const earth = new THREE.Mesh(earthGeometry, earthMaterial);
  earth.position.set(0, 0, 0);
  scene.add(earth);
  
  // مدار الصاروخ (حلقة رفيعة)
  const orbitGeometry = new THREE.TorusGeometry(ORBIT_RADIUS, 0.1, 16, 100);
  const orbitMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.6
  });
  const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbitRing.rotation.x = Math.PI / 2;
  scene.add(orbitRing);
  
  // مدار القمر الصناعي (حلقة رفيعة)
  const satelliteOrbitGeometry = new THREE.TorusGeometry(SATELLITE_ORBIT_RADIUS, 0.1, 16, 100);
  const satelliteOrbitMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6
  });
  const satelliteOrbitRing = new THREE.Mesh(satelliteOrbitGeometry, satelliteOrbitMaterial);
  satelliteOrbitRing.rotation.x = Math.PI / 2;
  scene.add(satelliteOrbitRing);
  
  return earth;
}

// دالة لإعادة تجميع أجزاء الصاروخ
function resetRocketParts() {
  if (rocketParts.lowerStage && rocketParts.upperStage && rocketParts.payload) {
    // إعادة تعيين المواضع
    rocketParts.lowerStage.position.set(0, 0, 0);
    rocketParts.upperStage.position.set(0, 0, 0);
    rocketParts.payload.position.set(0, 0, 0);
    
    // إعادة تعيين الدوران
    rocketParts.lowerStage.rotation.set(0, 0, 0);
    rocketParts.upperStage.rotation.set(0, 0, 0);
    rocketParts.payload.rotation.set(0, 0, 0);
    
    console.log('🔄 تم إعادة تجميع أجزاء الصاروخ');
  }
}

// دالة للتبديل بين المودل الأصلي والأجزاء المنفصلة
function toggleRocketView() {
  if (rocketParts.lowerStage && rocketParts.upperStage && rocketParts.payload) {
    const isVisible = rocketParts.lowerStage.visible;
    
    if (isVisible) {
      // إخفاء الأجزاء
      rocketParts.lowerStage.visible = false;
      rocketParts.upperStage.visible = false;
      rocketParts.payload.visible = false;
      console.log('🔄 تم إخفاء أجزاء الصاروخ');
    } else {
      // إظهار الأجزاء
      rocketParts.lowerStage.visible = true;
      rocketParts.upperStage.visible = true;
      rocketParts.payload.visible = true;
      console.log('🔄 تم إظهار أجزاء الصاروخ');
    }
  }
}

// دالة للتبديل رؤية القمر الصناعي
function toggleSatelliteView() {
  if (satellite) {
    const isVisible = satellite.visible;
    
    if (isVisible) {
      // إخفاء القمر الصناعي
      satellite.visible = false;
      console.log('🛰️ تم إخفاء القمر الصناعي');
    } else {
      // إظهار القمر الصناعي
      satellite.visible = true;
      console.log('🛰️ تم إظهار القمر الصناعي');
    }
  }
}

// دالة تحديث حركة الصاروخ في المدار
function updateOrbit() {
  if (isInOrbit && rocketParts.payload) {
    // تحديث زاوية المدار
    orbitAngle += ORBIT_SPEED;
    
    // حساب الموضع في المدار
    const x = ORBIT_RADIUS * Math.cos(orbitAngle);
    const z = ORBIT_RADIUS * Math.sin(orbitAngle);
    
    // تحريك جميع الأجزاء معاً في المدار
    if (rocketParts.lowerStage) {
      rocketParts.lowerStage.position.set(x, 0, z);
    }
    if (rocketParts.upperStage) {
      rocketParts.upperStage.position.set(x, 0, z);
    }
    if (rocketParts.payload) {
      rocketParts.payload.position.set(x, 0, z);
      
      // دوران الصاروخ ليكون دائماً في اتجاه الحركة
      const tangentAngle = orbitAngle + Math.PI / 2;
      rocketParts.payload.rotation.y = tangentAngle;
    }
  }
}

// دالة تحديث حركة القمر الصناعي
function updateSatelliteOrbit() {
  if (satellite) {
    // تحديث زاوية مدار القمر الصناعي
    satelliteOrbitAngle += SATELLITE_SPEED;
    
    // حساب الموضع في المدار
    const x = SATELLITE_ORBIT_RADIUS * Math.cos(satelliteOrbitAngle);
    const z = SATELLITE_ORBIT_RADIUS * Math.sin(satelliteOrbitAngle);
    
    // تحريك القمر الصناعي
    satellite.position.set(x, 0, z);
    
    // دوران القمر الصناعي ليكون دائماً في اتجاه الحركة
    const tangentAngle = satelliteOrbitAngle + Math.PI / 2;
    satellite.rotation.y = tangentAngle;
    
    // دوران إضافي للقمر الصناعي حول محوره
    satellite.rotation.z += 0.01;
  }
}

// التحكم
const controls = new PointerLockControls(camera, document.body);

// ربط أزرار التحكم في الواجهة
const startOrbitBtn = document.getElementById('startOrbit');
const stopOrbitBtn = document.getElementById('stopOrbit');
const resetRocketBtn = document.getElementById('resetRocket');
const toggleViewBtn = document.getElementById('toggleView');
const toggleSatelliteBtn = document.getElementById('toggleSatellite');
const orbitSpeedSlider = document.getElementById('orbitSpeedSlider');
const speedValue = document.getElementById('speedValue');

// تحديث سرعة المدار
if (orbitSpeedSlider) {
  orbitSpeedSlider.addEventListener('input', (e) => {
    ORBIT_SPEED = parseFloat(e.target.value);
    if (speedValue) {
      speedValue.textContent = e.target.value;
    }
  });
}

// أزرار التحكم
if (startOrbitBtn) {
  startOrbitBtn.addEventListener('click', () => {
    isInOrbit = true;
    updateUI();
    console.log('🚀 بدء الدوران حول الأرض');
  });
}

if (stopOrbitBtn) {
  stopOrbitBtn.addEventListener('click', () => {
    isInOrbit = false;
    updateUI();
    console.log('⏸️ إيقاف الدوران');
  });
}

if (resetRocketBtn) {
  resetRocketBtn.addEventListener('click', () => {
    resetRocketParts();
    updateUI();
  });
}

if (toggleViewBtn) {
  toggleViewBtn.addEventListener('click', () => {
    toggleRocketView();
    updateUI();
  });
}

if (toggleSatelliteBtn) {
  toggleSatelliteBtn.addEventListener('click', () => {
    toggleSatelliteView();
    updateUI();
  });
}

// مفاتيح التحكم
window.addEventListener('keydown', (e) => {
  switch (e.code) {
    // مفاتيح التحكم في أجزاء الصاروخ
    case 'Digit1': // دوران المرحلة السفلى
      if (rocketParts.lowerStage) {
        rocketParts.lowerStage.rotation.y += 0.2;
        console.log('🔄 دوران المرحلة السفلى');
      }
      break;
    case 'Digit2': // دوران المرحلة العلوية
      if (rocketParts.upperStage) {
        rocketParts.upperStage.rotation.y += 0.2;
        console.log('🔄 دوران المرحلة العلوية');
      }
      break;
    case 'Digit3': // دوران الحمولة
      if (rocketParts.payload) {
        rocketParts.payload.rotation.y += 0.2;
        console.log('🔄 دوران الحمولة');
      }
      break;
    case 'KeyQ': // فصل المرحلة السفلى
      if (rocketParts.lowerStage) {
        rocketParts.lowerStage.position.y -= 2;
        console.log('🚀 فصل المرحلة السفلى');
      }
      break;
    case 'KeyE': // فصل المرحلة العلوية
      if (rocketParts.upperStage) {
        rocketParts.upperStage.position.y += 2;
        console.log('🚀 فصل المرحلة العلوية');
      }
      break;
    case 'KeyR': // إعادة تجميع الصاروخ
      resetRocketParts();
      break;
    case 'KeyT': // تبديل رؤية الصاروخ
      toggleRocketView();
      break;
    case 'KeyS': // تبديل رؤية القمر الصناعي
      toggleSatelliteView();
      break;
    case 'Space': // بدء/إيقاف الدوران
      isInOrbit = !isInOrbit;
      updateUI();
      if (isInOrbit) {
        console.log('🚀 بدء الدوران حول الأرض');
      } else {
        console.log('⏸️ إيقاف الدوران');
      }
      break;
  }
});

// دالة تحديث واجهة المستخدم
function updateUI() {
  // تحديث حالة المدار
  const orbitStatus = document.getElementById('orbitStatus');
  const orbitSpeed = document.getElementById('orbitSpeed');
  
  if (orbitStatus) {
    orbitStatus.textContent = isInOrbit ? 'المدار: نشط' : 'المدار: متوقف';
  }
  
  if (orbitSpeed) {
    orbitSpeed.textContent = `السرعة: ${ORBIT_SPEED.toFixed(3)}`;
  }
  
  // تحديث حالة أجزاء الصاروخ
  if (rocketParts.lowerStage && rocketParts.upperStage && rocketParts.payload) {
    const lowerStatus = document.getElementById('lowerStatus');
    const upperStatus = document.getElementById('upperStatus');
    const payloadStatus = document.getElementById('payloadStatus');
    
    // فحص فصل المراحل
    const lowerY = rocketParts.lowerStage.position.y;
    const upperY = rocketParts.upperStage.position.y;
    const payloadY = rocketParts.payload.position.y;
    
    const separationThreshold = 1.0;
    
    if (lowerStatus) {
      lowerStatus.textContent = Math.abs(lowerY - upperY) > separationThreshold ? 'منفصل' : 'متصل';
    }
    
    if (upperStatus) {
      upperStatus.textContent = Math.abs(upperY - payloadY) > separationThreshold ? 'منفصل' : 'متصل';
    }
    
    if (payloadStatus) {
      payloadStatus.textContent = 'متصل';
    }
  }
  
  // تحديث إحداثيات الكاميرا
  const cameraCoords = document.getElementById('cameraCoords');
  if (cameraCoords) {
    cameraCoords.innerHTML = `
      <div>Camera Info</div>
      <div>x: ${camera.position.x.toFixed(2)}, y: ${camera.position.y.toFixed(2)}, z: ${camera.position.z.toFixed(2)}</div>
    `;
  }
  
  // تحديث حالة القمر الصناعي
  if (satellite) {
    const satelliteStatus = document.getElementById('satelliteStatus');
    if (satelliteStatus) {
      satelliteStatus.textContent = satellite.visible ? '🛰️ القمر الصناعي: نشط' : '🛰️ القمر الصناعي: مخفي';
    }
  }
}

// دالة الرسم
function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta();
  
  // تحديث حركة الصاروخ في المدار
  updateOrbit();
  
  // تحديث حركة القمر الصناعي
  updateSatelliteOrbit();
  
  // دوران الأرض
  if (earth) {
    earth.rotation.y += 0.001;
  }
  
  // تحديث واجهة المستخدم
  updateUI();
  
  renderer.render(scene, camera);
}

// إنشاء المشهد
const earth = createEarth();
createRocketParts();
createSatellite();

// بدء الرسم
animate();

// معالجة تغيير حجم النافذة
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('🌍 تم تحميل مرحلة الدوران حول الأرض');
console.log('🛰️ تم إضافة القمر الصناعي');
console.log('🎮 استخدم Space لبدء/إيقاف الدوران');
console.log('🔧 استخدم 1, 2, 3 لتدوير الأجزاء');
console.log('🚀 استخدم Q, E لفصل المراحل');
console.log('🔄 استخدم R لإعادة التجميع');
console.log('👁️ استخدم T لإخفاء/إظهار الصاروخ');
console.log('🛰️ استخدم S لإخفاء/إظهار القمر الصناعي');
console.log('🌍 المشهد يحتوي على: كرة أرضية + مدارين + قمر صناعي');
