// ----- 1. Setup scene, camera, renderer -----
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Add this after you create your camera
const listener = new THREE.AudioListener();
camera.add(listener);


// ----- 2. Lights -----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// ----- 3. Stars -----
function createStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 3000;
  const positions = [];

  for (let i = 0; i < starCount; i++) {
    positions.push((Math.random() - 0.5) * 3000);
    positions.push((Math.random() - 0.5) * 3000);
    positions.push((Math.random() - 0.5) * 3000);
  }

  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.5,
    transparent: true,
    opacity: 0.8
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // Twinkle effect
  setInterval(() => {
    starMaterial.opacity = 0.6 + Math.random() * 0.4;
  }, 150);
}
createStars();

// ----- 4. Earth with texture -----
const earthTexture = new THREE.TextureLoader().load("https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg");
const earthGeometry = new THREE.SphereGeometry(5, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture });
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
earth.position.set(0, 0, 0);
scene.add(earth);

// ----- 5. Exoplanet -----
const planetGeometry = new THREE.SphereGeometry(8, 64, 64);
const planetMaterial = new THREE.MeshPhongMaterial({ color: 0xff884d, shininess: 30 });
const exoplanet = new THREE.Mesh(planetGeometry, planetMaterial);
exoplanet.position.set(0, 0, -500);
scene.add(exoplanet);

// Add ring (optional)
const ringGeometry = new THREE.RingGeometry(10, 12, 64);
const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeometry, ringMaterial);
ring.rotation.x = Math.PI / 2;
ring.position.set(0, 0, -500);
scene.add(ring);

// ----- 6. Camera start position -----
camera.position.set(0, 5, 25);  // closer to Earth so you see it

// ----- 7. Animation loop -----
function animate() {
  requestAnimationFrame(animate);

  // Rotate Earth & Exoplanet
  earth.rotation.y += 0.003;
  exoplanet.rotation.y += 0.001;

  // Camera wobble (faster sway)
  camera.position.x = Math.sin(Date.now() * 0.002) * 6; 
  camera.position.y = Math.sin(Date.now() * 0.0015) * 4 + 8;

  renderer.render(scene, camera);
}
animate();

// Create an Audio object
const sound = new THREE.Audio(listener);

// Load the MP3 file
const audioLoader = new THREE.AudioLoader();
audioLoader.load('galaxy.mp3', function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);       // play in loop
    sound.setVolume(1);      // adjust volume (0 to 1)
    // sound.play();           // optional: auto-play immediately
    sound.play();

});

document.getElementById("flyBtn").addEventListener("click", function () {
    window.location.href = "travel.html";
});

// ----- 8. Fly button -----
document.getElementById("flyBtn").onclick = () => {
  let step = 0;
  const flyInterval = setInterval(() => {
    camera.position.z -= 10; // Faster zoom forward
    step += 10;

    if (step >= 500) {
      clearInterval(flyInterval);

      // Show stats
      const statsBox = document.getElementById("statsBox");
      statsBox.style.display = "block";
      statsBox.innerHTML = `
        <h3>🪐 Exoplanet Found!</h3>
        <p><b>Radius:</b> 3.2 Earth radii</p>
        <p><b>Orbital Period:</b> 200 days</p>
        <p><b>Star Temperature:</b> 4900 K</p>
        <p><b>Similarity to Earth:</b> 62%</p>
      `;
    }
  }, 40); // smaller interval = smoother & faster flight

  const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const loader = new THREE.AudioLoader();
loader.load('galaxy.mp3', function(buffer){
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
    sound.setMuted(true);    // start muted
    sound.play();            // autoplay muted is allowed
});

// Unmute on first user click
window.addEventListener('click', () => {
    if(sound.isMuted) sound.setMuted(false);
}, { once: true });
};
