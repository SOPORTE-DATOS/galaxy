// === Importaciones ===
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// === Escena y cámara ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.8,
  10000
);
camera.position.set(0, 30, 800);


// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Controles ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;


// === Post-proceso ===
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85
);
composer.addPass(bloomPass);

// === Núcleo brillante ===
const coreGeometry = new THREE.SphereGeometry(45, 70, 70);
const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 2 });
const core = new THREE.Mesh(coreGeometry, coreMaterial);

// === Grupo Galaxia ===
const galaxyGroup = new THREE.Group();
scene.add(galaxyGroup);
galaxyGroup.add(core);

// === Shaders para nebulosas ===
const nebulaVertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

const nebulaFragment = `
    varying vec2 vUv;
    uniform float time;
    uniform vec3 color;

    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = rand(i);
        float b = rand(i + vec2(1.0, 0.0));
        float c = rand(i + vec2(0.0, 1.0));
        float d = rand(i + vec2(1.0, 1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a, b, u.x) + (c - a)*u.y*(1.0-u.x) + (d - b)*u.x*u.y;
    }

    void main() {
      vec2 uv = vUv * 3.0 - 1.5;
      float dist = length(uv);

      float n = noise(vUv * 3.0 + time * 0.05);
      float edge = smoothstep(1.0, 0.6, dist);
      float alpha = smoothstep(0.3, 1.0, n) * edge * 0.5;

      gl_FragColor = vec4(color * n, alpha);
    }
  `;

// === Función para crear nebulosa con color y tamaño ===
function createNebula(size, color) {
  const material = new THREE.ShaderMaterial({
    vertexShader: nebulaVertex,
    fragmentShader: nebulaFragment,
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(color) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;

  return { mesh, material };
}

// Función para crear textura de corazón

function createHeartTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  const x = size / 2;
  const y = size / 2;
  const width = size * 0.7;
  const height = size * 0.65;

  // --- Rotamos 180° para que no salga al revés ---
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI);
  ctx.translate(-x, -y);

  // --- Degradado radial basado en distancia al centro ---
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
  gradient.addColorStop(0, "#FF4D4D");  // Cerca del núcleo
  gradient.addColorStop(0.5, "#FF9900"); // Intermedio
  gradient.addColorStop(1, "#FFFF33");   // Exterior
  ctx.fillStyle = gradient;

  // --- Dibujar el corazón estilo emoji ---
  ctx.beginPath();
  ctx.moveTo(x, y + height / 4);
  ctx.bezierCurveTo(
    x - width / 2, y + height / 2,
    x - width / 1.6, y - height / 4,
    x, y - height / 3
  );
  ctx.bezierCurveTo(
    x + width / 1.6, y - height / 4,
    x + width / 2, y + height / 2,
    x, y + height / 4
  );
  ctx.closePath();

  // --- Recortar el degradado para que solo aparezca dentro del corazón ---
  ctx.save();
  ctx.clip();
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // --- Brillo blanco estilo emoji ---
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(x - width * 0.2, y - height * 0.2, width * 0.15, height * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // 🔹 Restauramos para futuras operaciones
  return new THREE.CanvasTexture(canvas);
}


const heartTexture = createHeartTexture();

// === Galaxia con partículas ===
const radius = 800;
function createGalaxy() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  const arms = 5;
  const starsPerArm = 1000;

  for (let arm = 0; arm < arms; arm++) {
    for (let i = 0; i < starsPerArm; i++) {
      const dist = Math.pow(Math.random(), 0.5) * radius;
      const angle = dist * 0.05 + (arm * ((2 * Math.PI) / arms)) + Math.random() * 0.5;
      const x = Math.cos(angle) * dist;
      const y = (Math.random() - 0.5) * 50;
      const z = Math.sin(angle) * dist;

      positions.push(x, y, z);

      const color = new THREE.Color();
      color.setHSL((dist / radius) * 0.8, 1, 0.6);
      colors.push(color.r, color.g, color.b);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 10,                   // Tamaño de los corazones
    map: heartTexture,          // Textura del corazón
    transparent: true,
    alphaTest: 0.1,              // Para evitar bordes feos
    depthWrite: false,
    vertexColors: false,         // Desactivar colores por vértice si solo quieres corazones rojos
    blending: THREE.AdditiveBlending
  });/*
const material = new THREE.PointsMaterial({
  size: 2,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});

*/
  return new THREE.Points(geometry, material);
}

const galaxy = createGalaxy();
galaxyGroup.add(galaxy);

// === Crear varias nebulosas con distintos colores y velocidades ===
const nebulaConfigs = [
  { size: radius * 3.2, color: "#ff66ff", blur: 0, speed: 0.0005 },
  { size: radius * 2.8, color: "#66ccff", speed: 0.0005 },
  { size: radius * 2.0, color: "#66ccff", speed: 0.0005 },
  { size: radius * 1.0, color: "#ffff66", speed: 0.0005 },
  { size: radius * 0.5, color: "#fffffcff", speed: 0.0005 }

];

const nebulas = nebulaConfigs.map(cfg => {
  const n = createNebula(cfg.size, cfg.color);
  galaxyGroup.add(n.mesh);
  return { ...cfg, ...n };
});


// === Palabras en espiral ===
const words = [
  "Te Amo", "Te Quiero", "Te Pienso", "Te Sueño", "Te Adoro", "Te Extraño", "Te Necesito",
  "Mi Vida", "Mi Amor", "Mi Corazón",
  "Eres Mi Todo", "Eres Mi Luz", "Eres Mi Sonrisa", "Eres Mi Inspiración",
  "Siempre Tú", "Juntos Para Siempre", "Eres mi Universo",
  "Mi Tesoro",
  "Mi Ternura", "Mi Todo", "Mi Hogar",
  "Te Llevo En Mi Alma", "Te Llevo En Mi Corazón", "Te Pienso A Cada Momento", "Te Sueño De Noche",
  "Contigo Siempre", "Contigo Aprendí", "Contigo Todo",
  "Eres Mi Destino", "Eres Mi Fuerza", "Eres Mi Refugio",
  "Amo Tu Mirada", "Amo Tu Sonrisa", "Amo Tus Besos", "Amo Tus Caricias", "Tu Voz", "Tu Calor",
  "Nuestro Secreto", "Nuestro Momento",
  "Quiero Verte", "Quiero Abrazarte", "Quiero Besarte", "Quiero Mimarte", "Quiero Soñarte",
  "Amor Eterno", "Amor Verdadero", "Amor Infinito", "Amor Sincero", "Amor Puro",
  "Mi Pareja", "Mi Amada", "Mi Reina", "Mi Princesa", "Mi Cielo",
  "Eres Especial", "Eres Única", "Eres Increíble", "Eres Hermosa", "Eres Perfecta",
  "Mi Razón De Ser", "Mi Compañía", "Mi Media Naranja", "Mi Confidente",
  "Mi Mejor Amiga", "Mi Cómplice", "Mi Aventurera",
  "Eres Mi Mundo", "Eres Mi Universo", "Eres Mi Cielo", "Eres Mi Estrella", "Eres Mi Sol",
  "Te Amo Más Cada Día", "Te Pienso Sin Parar", "Te Sueño Sin Fin",
  "Te Adoro Con Todo Mi Ser", "Te Extraño Cuando No Estás", "Te Necesito A Mi Lado",
  "Eres Mi Vida Entera", "Eres Mi Todo Y Más", "Eres Mi Luz En La Oscuridad",
  "Eres Mi Sonrisa En Los Días Grises", "Eres Mi Inspiración Diaria",
  "Juntos Somos Invencibles", "Para Siempre Contigo", "Mi Señorita", "Mis ojitos lindos", "Mi Shelly", "Mi linda Señorita"
];


const wordSprites = [];
const numWords = 150; // Número total de palabras
const arms = 5;      // Misma cantidad de brazos que la galaxia

function createTextSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Limpieza con transparencia
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Color de las palabras (elige uno o haz lista para variar)
  const wordColors = ["#FFE29F", "#FFD6E0", "#FFF5E6", "#99DDFF"];
  const color = wordColors[Math.floor(Math.random() * wordColors.length)];

  // Texto con color complementario
  ctx.font = "Bold 70px Arial";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 30);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Material transparente
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,   // permite ver a través
    depthWrite: false    // evita que tape otras cosas
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(80, 20, 1);
  return sprite;
}

for (let i = 0; i < numWords; i++) {
  const word = words[Math.floor(Math.random() * words.length)];
  const sprite = createTextSprite(word);

  // Generar en el espiral, igual que las estrellas
  const dist = Math.pow(Math.random(), 0.5) * radius;
  const arm = Math.floor(Math.random() * arms);
  const angle = dist * 0.05 + (arm * ((2 * Math.PI) / arms)) + Math.random() * 0.5;

  const x = Math.cos(angle) * dist;
  const y = (Math.random() - 0.5) * 50;
  const z = Math.sin(angle) * dist;

  sprite.position.set(x, y, z);
  galaxyGroup.add(sprite); // se une al grupo para rotar con la galaxia
  wordSprites.push({ sprite, baseY: y, speed: 0.5 + Math.random() * 0.5 });
}


// === Animación ===
function animate() {
  requestAnimationFrame(animate);

  // Tiempo para shaders
  const t = performance.now() / 1000
  nebulas.forEach(n => n.material.uniforms.time.value = t);

  // Rotación de nebulosas con distintas velocidades
  nebulas.forEach(n => n.mesh.rotation.z -= n.speed);

  // Rotación de la galaxia
  galaxyGroup.rotation.y += 0.0005;


  // Palabras orbitando
  wordSprites.forEach((w) => {
    w.sprite.position.y = w.baseY + Math.sin(Date.now() * 0.001 * w.speed) * 10;
  });
  controls.update();
  composer.render();
  updateWords();
}

animate();

// === Ajuste de pantalla ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});