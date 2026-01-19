import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(25, 20, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const glowMap = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');
const starMap = textureLoader.load('https://threejs.org/examples/textures/sprites/disc.png');

// --- INTERACTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let focusedPlanet = null; 
let timeScale = 1.0; 
const backButton = document.getElementById('backButton');

// --- LIGHTING ---
const sunLight = new THREE.PointLight(0xffffff, 150, 100);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// --- THE SUN ---
const sunGroup = new THREE.Group();
scene.add(sunGroup);
const sunCore = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 64), new THREE.MeshBasicMaterial({ color: 0xffffff }));
sunGroup.add(sunCore);

// --- STAR DUST ---
const starCount = 15000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
    const theta = 2 * Math.PI * Math.random(), phi = Math.acos(2 * Math.random() - 1), radius = 100 * Math.pow(Math.random(), 0.9);
    starPositions[i*3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3+1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i*3+2] = radius * Math.cos(phi);
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ size: 0.08, map: starMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffccaa });
const starDust = new THREE.Points(starGeometry, starMaterial); 
scene.add(starDust);

// --- PLANETS & MOONS ---
const planets = [];
const createPlanet = (size, color, distance, speed, name, moonConfigs = []) => {
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    const planet = new THREE.Mesh(
        new THREE.SphereGeometry(size, 64, 64),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.5 })
    );
    planet.position.x = distance;
    planet.userData = { name }; 
    orbitGroup.add(planet);

    const moons = moonConfigs.map(m => {
        const moonOrbit = new THREE.Group();
        planet.add(moonOrbit);
        const moon = new THREE.Mesh(new THREE.SphereGeometry(m.size, 32, 32), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        moon.position.x = m.dist;
        moonOrbit.add(moon);
        return { group: moonOrbit, speed: m.speed };
    });
    const planetObj = { orbitGroup, speed, planet, moons };
    planets.push(planetObj);
    return planetObj;
};

createPlanet(0.4, 0xffccaa, 8, 0.012, "Mercury", [{ size: 0.08, dist: 0.9, speed: 0.04 }]);
createPlanet(0.7, 0x00aaff, 14, 0.008, "Earth", [{ size: 0.12, dist: 1.3, speed: 0.03 }, { size: 0.08, dist: 1.8, speed: 0.02 }]);
createPlanet(1.1, 0xcc88ff, 22, 0.005, "Jupiter", [{ size: 0.15, dist: 2.2, speed: 0.015 }]);

// --- POST PROCESSING ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 1.2, 0.05));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- CLICK DETECTION ---
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planets.map(p => p.planet));

    if (intersects.length > 0) {
        focusedPlanet = intersects[0].object;
        if (backButton) backButton.style.display = 'block';
        
        // --- THE KEY FIX: Transition Camera Position ---
        const worldPos = new THREE.Vector3();
        focusedPlanet.getWorldPosition(worldPos);
        
        // Calculate a position slightly away from the planet
        const jumpPos = worldPos.clone().add(new THREE.Vector3(5, 3, 5));
        
        // Move the camera just once (or use a tween here if you have GSAP)
        camera.position.copy(jumpPos); 
    }
});

if (backButton) {
    backButton.addEventListener('click', () => {
        focusedPlanet = null;
        backButton.style.display = 'none';
        controls.target.set(0, 0, 0);
    });
}

// --- ANIMATION LOOP ---
const tick = () => {
    const time = Date.now() * 0.001;
    const targetScale = focusedPlanet ? 0.1 : 1.0;
    timeScale = THREE.MathUtils.lerp(timeScale, targetScale, 0.05);

    starDust.rotation.y += 0.0001 * timeScale;
    starMaterial.size = 0.07 + Math.sin(time * 3) * 0.01;

    planets.forEach(p => {
        p.orbitGroup.rotation.y += p.speed * timeScale;
        p.planet.rotation.y += 0.01;
        p.moons.forEach(m => m.group.rotation.y += m.speed);
    });

    if (focusedPlanet) {
        const worldPos = new THREE.Vector3();
        focusedPlanet.getWorldPosition(worldPos);
        
        // Update the target every frame so the camera follows the orbit
        controls.target.copy(worldPos); 
    }

    controls.update(); // This allows manual mouse control while tracking the target
    composer.render();
    window.requestAnimationFrame(tick);
};

tick();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});



