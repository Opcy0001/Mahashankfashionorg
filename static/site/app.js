/* ============================================================
   NEXUS 3D — Three.js Interactive 3D Experience
   ============================================================ */

'use strict';

// ---- SCENE SETUP ----
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 5);

// ---- CLOCK ----
const clock = new THREE.Clock();

// ---- MOUSE TRACKING ----
const mouse = { x: 0, y: 0, rawX: 0, rawY: 0 };
const targetMouse = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  mouse.rawX = e.clientX;
  mouse.rawY = e.clientY;
  targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ---- SCROLL ----
let scrollY = 0;
let currentSection = 0;

window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
  const progress = scrollY / (document.body.scrollHeight - window.innerHeight);
  document.getElementById('scroll-progress').style.width = (progress * 100) + '%';
});

// ============================================================
//  GALAXY PARTICLE SYSTEM
// ============================================================

function createGalaxy() {
  const params = {
    count: 120000,
    size: 0.008,
    radius: 5,
    branches: 5,
    spin: 1.2,
    randomness: 0.2,
    randomnessPower: 3.5,
    insideColor: new THREE.Color('#6c63ff'),
    outsideColor: new THREE.Color('#00d4ff'),
  };

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);
  const sizes = new Float32Array(params.count);

  for (let i = 0; i < params.count; i++) {
    const i3 = i * 3;
    const r = Math.random() * params.radius;
    const spinAngle = r * params.spin;
    const branchAngle = (i % params.branches) / params.branches * Math.PI * 2;

    const rX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;
    const rY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;
    const rZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;

    positions[i3]     = Math.cos(branchAngle + spinAngle) * r + rX;
    positions[i3 + 1] = rY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rZ;

    const mixed = new THREE.Color();
    mixed.lerpColors(params.insideColor, params.outsideColor, r / params.radius);
    colors[i3]     = mixed.r;
    colors[i3 + 1] = mixed.g;
    colors[i3 + 2] = mixed.b;

    sizes[i] = Math.random() * 2 + 0.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: params.size,
    sizeAttenuation: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });

  const galaxy = new THREE.Points(geometry, material);
  galaxy.rotation.x = Math.PI * 0.15;
  scene.add(galaxy);
  return galaxy;
}

const galaxy = createGalaxy();

// ============================================================
//  AMBIENT STAR FIELD
// ============================================================

function createStarField() {
  const count = 8000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.015,
    color: new THREE.Color('#ffffff'),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

const starField = createStarField();

// ============================================================
//  FLOATING GEOMETRIC OBJECTS
// ============================================================

const geoGroup = new THREE.Group();
scene.add(geoGroup);

function createGeoObject(type, size, x, y, z, color) {
  let geo;
  switch (type) {
    case 'torus':
      geo = new THREE.TorusGeometry(size, size * 0.35, 16, 50);
      break;
    case 'octahedron':
      geo = new THREE.OctahedronGeometry(size);
      break;
    case 'dodecahedron':
      geo = new THREE.DodecahedronGeometry(size);
      break;
    case 'icosahedron':
      geo = new THREE.IcosahedronGeometry(size);
      break;
    default:
      geo = new THREE.TetrahedronGeometry(size);
  }

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.8,
    roughness: 0.1,
    wireframe: false,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.15,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.userData = {
    rotSpeedX: (Math.random() - 0.5) * 0.01,
    rotSpeedY: (Math.random() - 0.5) * 0.015,
    floatSpeed: Math.random() * 0.5 + 0.5,
    floatAmp: Math.random() * 0.3 + 0.1,
    initY: y,
  };

  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  mesh.add(edges);

  geoGroup.add(mesh);
  return mesh;
}

const geoObjects = [
  createGeoObject('torus',        0.3, -4,   1.5,  -2,  '#6c63ff'),
  createGeoObject('octahedron',   0.4,  4,  -1.5,  -1,  '#00d4ff'),
  createGeoObject('dodecahedron', 0.25, -3, -2.5,  -3,  '#ff6b9d'),
  createGeoObject('icosahedron',  0.35,  3.5, 2.0,  -2,  '#ffd166'),
  createGeoObject('torus',        0.2, -1.5,  3.5,  -4,  '#6c63ff'),
  createGeoObject('octahedron',   0.3,  1.5, -3.0,  -2,  '#00d4ff'),
  createGeoObject('icosahedron',  0.2, -5,   0.5,  -3,  '#ff6b9d'),
  createGeoObject('torus',        0.15, 5,   2.5,  -4,  '#ffd166'),
];

// ============================================================
//  ENERGY RING / PORTAL
// ============================================================

const ringGroup = new THREE.Group();
scene.add(ringGroup);

function createRing(radius, tube, segments, color, opacity) {
  const geo = new THREE.TorusGeometry(radius, tube, 2, segments);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    wireframe: true,
  });
  const ring = new THREE.Mesh(geo, mat);
  ringGroup.add(ring);
  return ring;
}

const rings = [
  createRing(2.5, 0.005, 120, '#6c63ff', 0.4),
  createRing(2.7, 0.003, 100, '#00d4ff', 0.25),
  createRing(2.9, 0.004, 80,  '#ff6b9d', 0.15),
];

rings[0].rotation.x = Math.PI * 0.5;
rings[1].rotation.x = Math.PI * 0.5;
rings[2].rotation.x = Math.PI * 0.5;
rings[1].rotation.z = Math.PI * 0.1;
rings[2].rotation.z = -Math.PI * 0.1;

ringGroup.position.z = -2;
ringGroup.rotation.x = 0.3;

// ============================================================
//  LIGHTING
// ============================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x6c63ff, 2);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0x00d4ff, 1.5);
dirLight2.position.set(-5, -3, 3);
scene.add(dirLight2);

const pointLight = new THREE.PointLight(0xff6b9d, 2, 20);
pointLight.position.set(0, 3, 2);
scene.add(pointLight);

// ============================================================
//  NEBULA / PARTICLES BURST
// ============================================================

function createNebula() {
  const count = 3000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const palette = [
    new THREE.Color('#6c63ff'),
    new THREE.Color('#00d4ff'),
    new THREE.Color('#ff6b9d'),
    new THREE.Color('#ffd166'),
  ];

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(Math.random() * 2 - 1);
    const r     = Math.random() * 4 + 1;

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi) - 3;

    const col = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const nebula = new THREE.Points(geo, mat);
  scene.add(nebula);
  return nebula;
}

const nebula = createNebula();

// ============================================================
//  ANIMATION LOOP
// ============================================================

function lerp(a, b, t) { return a + (b - a) * t; }

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  const delta   = clock.getDelta();

  // Smooth mouse interpolation
  mouse.x = lerp(mouse.x, targetMouse.x, 0.06);
  mouse.y = lerp(mouse.y, targetMouse.y, 0.06);

  // --- Galaxy rotation ---
  galaxy.rotation.y = elapsed * 0.04;
  galaxy.rotation.x = Math.PI * 0.15 + Math.sin(elapsed * 0.1) * 0.05;

  // --- Star field slow drift ---
  starField.rotation.y = elapsed * 0.005;

  // --- Floating geometric objects ---
  geoObjects.forEach((obj, i) => {
    const ud = obj.userData;
    obj.rotation.x += ud.rotSpeedX;
    obj.rotation.y += ud.rotSpeedY;
    obj.position.y = ud.initY + Math.sin(elapsed * ud.floatSpeed + i) * ud.floatAmp;
  });

  // --- Rings ---
  rings.forEach((r, i) => {
    r.rotation.z = elapsed * (0.15 + i * 0.05) * (i % 2 === 0 ? 1 : -1);
  });
  ringGroup.rotation.y = Math.sin(elapsed * 0.3) * 0.15;

  // --- Nebula ---
  nebula.rotation.y = elapsed * 0.02;

  // --- Point light pulse ---
  pointLight.intensity = 2 + Math.sin(elapsed * 2) * 0.8;

  // --- Camera parallax ---
  const parallaxX = mouse.x * 0.8;
  const parallaxY = mouse.y * 0.5;
  camera.position.x = lerp(camera.position.x, parallaxX, 0.04);
  camera.position.y = lerp(camera.position.y, parallaxY + scrollY * 0.001, 0.04);

  // Scroll camera Z & galaxy opacity
  const scrollProgress = scrollY / (document.body.scrollHeight - window.innerHeight);
  camera.position.z = 5 - scrollProgress * 2;
  galaxy.material.opacity = Math.max(0.2, 0.9 - scrollProgress * 0.5);

  // --- Geo group parallax mouse ---
  geoGroup.rotation.x = lerp(geoGroup.rotation.x, -mouse.y * 0.08, 0.03);
  geoGroup.rotation.y = lerp(geoGroup.rotation.y, mouse.x * 0.08, 0.03);

  renderer.render(scene, camera);
}

animate();

// ============================================================
//  RESIZE HANDLER
// ============================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ============================================================
//  CUSTOM CURSOR
// ============================================================

const cursorEl    = document.getElementById('cursor');
const cursorDot   = cursorEl.querySelector('.cursor-dot');
const cursorRing  = cursorEl.querySelector('.cursor-ring');

let cursorX = 0, cursorY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', (e) => {
  cursorX = e.clientX;
  cursorY = e.clientY;
  cursorDot.style.left  = cursorX + 'px';
  cursorDot.style.top   = cursorY + 'px';
});

function animateCursor() {
  ringX = lerp(ringX, cursorX, 0.12);
  ringY = lerp(ringY, cursorY, 0.12);
  cursorRing.style.left = ringX + 'px';
  cursorRing.style.top  = ringY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Hover effect on interactive elements
const hoverTargets = document.querySelectorAll('a, button, .work-card, .service-card, .about-card, input, textarea, select');
hoverTargets.forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

// ============================================================
//  NAVBAR SCROLL
// ============================================================

const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  // Active nav link
  const sections = document.querySelectorAll('.section');
  let currentSectionId = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 120;
    if (window.scrollY >= top) currentSectionId = sec.id;
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === currentSectionId);
  });
});

// ============================================================
//  SCROLL REVEAL
// ============================================================

const revealEls = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, delay);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

// Add staggered delays to siblings
document.querySelectorAll('.services-grid .service-card').forEach((el, i) => {
  el.dataset.delay = i * 80;
});
document.querySelectorAll('.about-card-grid .about-card').forEach((el, i) => {
  el.dataset.delay = i * 100;
});
document.querySelectorAll('.units-section .unit-card').forEach((el, i) => {
  el.dataset.delay = i * 120;
});
document.querySelectorAll('.vision-grid .vision-card').forEach((el, i) => {
  el.dataset.delay = i * 150;
});

revealEls.forEach(el => revealObserver.observe(el));

// ============================================================
//  COUNTER ANIMATION
// ============================================================

function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const duration = 1800;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-count]').forEach(animateCounter);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) counterObserver.observe(heroStats);

// ============================================================
//  CONTACT FORM
// ============================================================

const form = document.getElementById('contact-form');

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">✓</div>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.innerHTML = '<span>Sending...</span>';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    setTimeout(() => {
      form.reset();
      btn.innerHTML = `
        <span>Message Sent!</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
      btn.style.opacity = '1';
      btn.disabled = false;
      showToast("🚀 Your message is on its way! We'll respond within 24 hours.");
      setTimeout(() => {
        btn.innerHTML = `
          <span>Send Message</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        `;
      }, 3000);
    }, 1500);
  });
}

// ============================================================
//  MOBILE NAV TOGGLE
// ============================================================

const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.querySelector('.nav-links');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    navLinks.style.flexDirection = 'column';
    navLinks.style.position = 'absolute';
    navLinks.style.top = '80px';
    navLinks.style.left = '0';
    navLinks.style.right = '0';
    navLinks.style.padding = '20px';
    navLinks.style.background = 'rgba(2,4,8,0.95)';
    navLinks.style.backdropFilter = 'blur(20px)';
    navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
  });
}

// ============================================================
//  PARALLAX ON WORK CARDS
// ============================================================

document.querySelectorAll('.work-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.querySelector('.work-bg').style.transform = `scale(1.07) translate(${x * -15}px, ${y * -15}px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.querySelector('.work-bg').style.transform = '';
  });
});

// ============================================================
//  SMOOTH ANCHOR SCROLL
// ============================================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ============================================================
//  TILT EFFECT ON SERVICE CARDS
// ============================================================

document.querySelectorAll('.service-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `translateY(-6px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg)`;
    card.style.transition = 'none';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = '';
  });
});

// ============================================================
//  SECTION TRANSITION COLORS (change 3D scene color per section)
// ============================================================

const sectionColors = {
  hero:       { primary: '#6c63ff', accent: '#00d4ff' },
  about:      { primary: '#00d4ff', accent: '#6c63ff' },
  units:      { primary: '#6c63ff', accent: '#ff6b9d' },
  industries: { primary: '#ff6b9d', accent: '#ffd166' },
  vision:     { primary: '#ffd166', accent: '#00d4ff' },
  contact:    { primary: '#6c63ff', accent: '#ff6b9d' },
};

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
      const id = entry.target.id;
      const colors = sectionColors[id];
      if (colors && dirLight) {
        dirLight.color.setStyle(colors.primary);
        dirLight2.color.setStyle(colors.accent);
      }
    }
  });
}, { threshold: 0.4 });

document.querySelectorAll('.section').forEach(sec => sectionObserver.observe(sec));

// ============================================================
//  INTRO FADE IN
// ============================================================

window.addEventListener('load', () => {
  document.body.style.opacity = 0;
  document.body.style.transition = 'opacity 0.8s ease';
  setTimeout(() => { document.body.style.opacity = 1; }, 100);
});
