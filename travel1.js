// Stellar Journey — 6-planet cinematic tour
/* Built for a smooth local run:
   - No external assets required (aside from Three.js CDN)
   - One-click "Start Journey", then "Next Planet" steps through 6 worlds
   - Subtle stars, shimmering dust, and planet-specific HUD info
*/


// ---------- 1) Scene / Camera / Renderer ----------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050510, 0.00055);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 12000);
camera.position.set(0, 8, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// ---------- 2) Lights ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);

const starKey = new THREE.DirectionalLight(0xffffff, 1.2);
starKey.position.set(30, 25, 20);
scene.add(starKey);

// ---------- 3) Background stars (static) ----------
function makeStars(count = 2400, spread = 3000) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ size: 1.1, transparent: true, opacity: 0.9 });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);

  // Soft twinkle
  setInterval(() => { mat.opacity = 0.7 + Math.random() * 0.3; }, 180);
}
makeStars();

// ---------- 4) Flying dust (slow parallax) ----------
const dustGeo = new THREE.BufferGeometry();
const dustCount = 900;
const dPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dPos[i*3+0] = (Math.random()-0.5)*200;
  dPos[i*3+1] = (Math.random()-0.5)*200;
  dPos[i*3+2] = -Math.random()*2600;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
const dustMat = new THREE.PointsMaterial({ size: 0.8, transparent:true, opacity:0.6 });
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);

// ---------- 5) Planets data ----------
const planets = [
  { key:'Aurora',  color:0xff884d, radius:7,  ring:false, dist:-400,  info:'Fiery desert world orbiting close to its star. Temp ~ 650K.' },
  { key:'Zephyr',  color:0x6ac5ff, radius:9,  ring:true,  dist:-800,  info:'Windy gas giant with crystalline storms in its upper clouds.' },
  { key:'Lunara',  color:0xe8d5b7, radius:6,  ring:false, dist:-1200, info:'Ocean-mirrored surface; tidally locked to its pale sun.' },
  { key:'Chronos', color:0xa3a3ff, radius:10, ring:true,  dist:-1600, info:'Massive world with a slow day-night cycle and faint auroras.' },
  { key:'Obsidia', color:0x222222, radius:8,  ring:false, dist:-2000, info:'Volcanic plains streaked with glowing magma rivers.' },
  { key:'Elysium', color:0x00ffcc, radius:11, ring:true,  dist:-2400, info:'Lush atmosphere rich in exotic gases; rumored biosignatures.' },
];

const planetMeshes = [];
const ringMeshes = [];

// Helper to create a ring
function addRing(inner, outer, color=0xffffff){
  const geo = new THREE.RingGeometry(inner, outer, 96);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent:true, opacity:0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI/2.1;
  return mesh;
}

// Create all planets
for (const p of planets){
  const g = new THREE.SphereGeometry(p.radius, 96, 96);
  const m = new THREE.MeshPhongMaterial({ color: p.color, shininess: 35, specular: 0x333333 });
  const s = new THREE.Mesh(g, m);
  s.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*14, p.dist);
  scene.add(s);
  planetMeshes.push(s);

  if (p.ring){
    const r = addRing(p.radius*1.2, p.radius*1.6, 0xffffff);
    r.position.copy(s.position);
    scene.add(r);
    ringMeshes.push(r);
  } else {
    ringMeshes.push(null);
  }

  // Tiny moon for variety on some
  if (Math.random() > 0.5){
    const mg = new THREE.SphereGeometry(Math.max(1.2, p.radius*0.18), 32, 32);
    const mm = new THREE.MeshPhongMaterial({ color: 0x8888aa });
    const moon = new THREE.Mesh(mg, mm);
    moon.position.set(s.position.x + p.radius*2.1, s.position.y+1.2, p.dist - 6);
    moon.userData.orbitAround = s;
    moon.userData.angle = Math.random()*Math.PI*2;
    scene.add(moon);
    s.userData.moon = moon;
  }
}

// ---------- 6) Camera flight control ----------
let current = -1;
let flying = false;

const statsBox = document.getElementById('statsBox');
const startBtn = document.getElementById('startBtn');
const nextBtn  = document.getElementById('nextBtn');
const stepText = document.getElementById('stepText');
const stepDots = document.getElementById('stepDots');

function rebuildDots(){
  stepDots.innerHTML = '';
  for(let i=0;i<planets.length;i++){
    const d = document.createElement('div');
    d.className = 'dotStep' + (i<=current ? ' active' : '');
    stepDots.appendChild(d);
  }
}
rebuildDots();

function updateProgress(){
  stepText.textContent = `Planet ${Math.max(current,0)} / ${planets.length}`;
  const dots = stepDots.children;
  for (let i=0;i<dots.length;i++){
    dots[i].classList.toggle('active', i<=current);
  }
}

function ease(a,b,t){ return a + (b-a) * (1-Math.pow(1-t, 3)); } // cubic-out

function flyTo(idx){
  if (idx < 0 || idx >= planets.length) return;
  if (flying) return;
  flying = true;

  const targetZ = planets[idx].dist + 28;
  const targetX = planetMeshes[idx].position.x * 0.25;
  const targetY = planetMeshes[idx].position.y * 0.25 + 8;

  const startPos = camera.position.clone();
  let t = 0;

  const flight = () => {
    t += 0.0125;
    const tt = Math.min(t, 1);
    camera.position.z = ease(startPos.z, targetZ, tt);
    camera.position.x = ease(startPos.x, targetX, tt);
    camera.position.y = ease(startPos.y, targetY, tt);

    // subtle look-at
    camera.lookAt(planetMeshes[idx].position.x, planetMeshes[idx].position.y, planetMeshes[idx].position.z);

    if (tt < 1){
      requestAnimationFrame(flight);
    } else {
      current = idx;
      showInfo(idx);
      flying = false;
      nextBtn.disabled = false;
      rebuildDots();
      updateProgress();
    }
  };
  flight();
}

function showInfo(idx){
  const p = planets[idx];
  statsBox.style.display = 'block';
  statsBox.innerHTML = `
    <h3>🪐 ${p.key}</h3>
    <p>${p.info}</p>
    <p><b>Radius:</b> ${p.radius.toFixed(1)} units • <b>Rings:</b> ${p.ring ? 'Yes' : 'No'}</p>
    <p><b>Distance marker:</b> ${Math.abs(p.dist)} units from start</p>
  `;
}

// Buttons
startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  nextBtn.disabled = true;
  statsBox.style.display = 'none';
  current = -1;
  updateProgress();
  flyTo(0);
});
nextBtn.addEventListener('click', () => {
  const next = current + 1;
  if (next < planets.length) {
    statsBox.style.display = 'none';
    nextBtn.disabled = true;
    flyTo(next);
  } else {
    // Journey finished
    statsBox.style.display = 'block';
    statsBox.innerHTML = `<h3>✨ Mission Complete</h3><p>You visited all ${planets.length} worlds. Refresh to ride again.</p>`;
    nextBtn.disabled = true;
  }
});

// ---------- 7) Animation loop ----------
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Gentle camera float (only when not flying)
  if (!flying){
    camera.position.x += Math.sin(t*0.5)*0.005;
    camera.position.y += Math.cos(t*0.3)*0.004;
  }

  // Rotate planets & rings; orbit moons
  for (let i=0;i<planetMeshes.length;i++){
    const s = planetMeshes[i];
    s.rotation.y += 0.002;
    const r = ringMeshes[i];
    if (r) r.rotation.z += 0.0007;

    const moon = s.userData.moon;
    if (moon){
      moon.userData.angle += 0.01;
      const rad = s.geometry.parameters.radius * 2.1;
      moon.position.x = s.position.x + Math.cos(moon.userData.angle)*rad;
      moon.position.z = s.position.z + Math.sin(moon.userData.angle)*rad;
      moon.position.y = s.position.y + 1.2 + Math.sin(moon.userData.angle*2)*0.4;
    }
  }

  // Move dust forward to simulate motion
  const arr = dust.geometry.attributes.position.array;
  for (let i=0;i<dustCount;i++){
    arr[i*3+2] += 1.4; // forward
    if (arr[i*3+2] > 120) {
      arr[i*3+0] = (Math.random()-0.5)*200;
      arr[i*3+1] = (Math.random()-0.5)*200;
      arr[i*3+2] = -2400 - Math.random()*400;
    }
  }
  dust.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}
animate();

// ---------- 8) Resize ----------
window.addEventListener('resize', () =>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
