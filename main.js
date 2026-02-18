import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ===============================
   CONSTANTS
================================ */
const G = 1;
const DT = 0.02;
const EPSILON = 1;
const STEPS_PER_FRAME = 1;

/* ===============================
   VEC2
================================ */
class Vec2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mul(s) { return new Vec2(this.x * s, this.y * s); }
    div(s) { return new Vec2(this.x / s, this.y / s); }
    length() { return Math.sqrt(this.x*this.x + this.y*this.y); }
}

/* ===============================
   ENTITIES
================================ */
class Body {
    constructor(id, mass, position, velocity) {
        this.id = id;
        this.mass = mass;
        this.position = position;
        this.velocity = velocity;
    }
}

class State {
    constructor(step, time, bodies) {
        this.step = step;
        this.time = time;
        this.bodies = bodies;
    }
}

/* ===============================
   PHYSICS
================================ */
function gravitationalForce(b1, b2) {
    const rVec = b2.position.sub(b1.position);
    const r = rVec.length();
    const softened = Math.sqrt(r*r + EPSILON*EPSILON);
    if (softened === 0) return new Vec2(0,0);

    const magnitude = G * b1.mass * b2.mass / (softened * softened);
    const direction = rVec.div(softened);
    return direction.mul(magnitude);
}

function computeAcceleration(bodies) {
    const acc = {};
    for (const id1 in bodies) {
        let net = new Vec2(0,0);
        for (const id2 in bodies) {
            if (id1 !== id2) {
                net = net.add(gravitationalForce(bodies[id1], bodies[id2]));
            }
        }
        acc[id1] = net.div(bodies[id1].mass);
    }
    return acc;
}

function update(state) {
    const a0 = computeAcceleration(state.bodies);

    const newPos = {};
    for (const id in state.bodies) {
        const b = state.bodies[id];
        newPos[id] = b.position
            .add(b.velocity.mul(DT))
            .add(a0[id].mul(0.5 * DT * DT));
    }

    const tempBodies = {};
    for (const id in state.bodies) {
        const b = state.bodies[id];
        tempBodies[id] = new Body(b.id, b.mass, newPos[id], b.velocity);
    }

    const a1 = computeAcceleration(tempBodies);

    const newBodies = {};
    for (const id in state.bodies) {
        const b = state.bodies[id];
        const newVel = b.velocity.add(
            a0[id].add(a1[id]).mul(0.5 * DT)
        );
        newBodies[id] = new Body(b.id, b.mass, newPos[id], newVel);
    }

    return new State(state.step + 1, state.time + DT, newBodies);
}

/* ===============================
   UTILITIES
================================ */
function radiusFromMass(m) {
    return 0.6 * Math.cbrt(m);
}

function circularVelocity(M, r) {
    return Math.sqrt(G * M / r);
}

function computeCOM(bodies) {
    let totalMass = 0;
    let cx = 0;
    let cy = 0;

    for (const id in bodies) {
        const b = bodies[id];
        totalMass += b.mass;
        cx += b.position.x * b.mass;
        cy += b.position.y * b.mass;
    }

    return new Vec2(cx/totalMass, cy/totalMass);
}

/* ===============================
   THREE SETUP
================================ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 2000);
camera.position.set(0, 0, 70);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    1.5, 1.2, 0.05
));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const sunLight = new THREE.PointLight(0xffffff, 150, 500);
scene.add(sunLight);

/* ===============================
   SYSTEM STATE
================================ */
let currentState;
let meshes = {};

function createSystem(params) {

    currentState = new State(0, 0, {
        sun: new Body("sun", params.sunMass, new Vec2(0,0), new Vec2(0,0)),

        planet1: new Body(
            "planet1",
            params.p1Mass,
            new Vec2(params.p1Dist, 0),
            new Vec2(params.p1Vx, params.p1Vy)
        ),

        planet2: new Body(
            "planet2",
            params.p2Mass,
            new Vec2(params.p2Dist, 0),
            new Vec2(params.p2Vx, params.p2Vy)
        )
    });

    Object.values(meshes).forEach(m => {
        m.geometry.dispose();
        scene.remove(m);
    });

    meshes = {};

    for (const id in currentState.bodies) {
        const b = currentState.bodies[id];
        const color =
            id === "sun" ? 0xffffff :
            id === "planet1" ? 0x00aaff :
            0xffaa00;

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radiusFromMass(b.mass), 64, 64),
            new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.2
            })
        );

        scene.add(mesh);
        meshes[id] = mesh;
    }
}

/* ===============================
   UI DIALOG
================================ */
const panel = document.createElement('div');
panel.style.position = 'absolute';
panel.style.top = '20px';
panel.style.left = '20px';
panel.style.padding = '20px';
panel.style.background = 'rgba(0,0,0,0.8)';
panel.style.borderRadius = '12px';
panel.style.color = 'white';
panel.style.fontFamily = 'sans-serif';
panel.style.width = '280px';
panel.innerHTML = `
<h3>System Setup</h3>

<b>Sun</b><br>
Mass <input id="sunMass" type="number" value="1000"><br><br>

<b>Planet 1</b><br>
Mass <input id="p1Mass" type="number" value="1"><br>
Distance <input id="p1Dist" type="number" value="10"><br>
Vx <input id="p1Vx" type="number" value="0"><br>
Vy <input id="p1Vy" type="number" value="10"><br>
<button id="p1Auto">Auto Orbit</button><br><br>

<b>Planet 2</b><br>
Mass <input id="p2Mass" type="number" value="0.5"><br>
Distance <input id="p2Dist" type="number" value="18"><br>
Vx <input id="p2Vx" type="number" value="0"><br>
Vy <input id="p2Vy" type="number" value="7.45"><br>
<button id="p2Auto">Auto Orbit</button><br><br>

<button id="applyBtn" style="width:100%;padding:6px;">
Apply System
</button>
`;

document.body.appendChild(panel);

document.getElementById("p1Auto").onclick = () => {
    const M = parseFloat(document.getElementById("sunMass").value);
    const r = parseFloat(document.getElementById("p1Dist").value);
    document.getElementById("p1Vx").value = 0;
    document.getElementById("p1Vy").value = circularVelocity(M, r).toFixed(4);
};

document.getElementById("p2Auto").onclick = () => {
    const M = parseFloat(document.getElementById("sunMass").value);
    const r = parseFloat(document.getElementById("p2Dist").value);
    document.getElementById("p2Vx").value = 0;
    document.getElementById("p2Vy").value = circularVelocity(M, r).toFixed(4);
};

document.getElementById("applyBtn").onclick = () => {
    createSystem({
        sunMass: parseFloat(sunMass.value),
        p1Mass: parseFloat(p1Mass.value),
        p1Dist: parseFloat(p1Dist.value),
        p1Vx: parseFloat(p1Vx.value),
        p1Vy: parseFloat(p1Vy.value),
        p2Mass: parseFloat(p2Mass.value),
        p2Dist: parseFloat(p2Dist.value),
        p2Vx: parseFloat(p2Vx.value),
        p2Vy: parseFloat(p2Vy.value)
    });
};

/* ===============================
   INITIAL LOAD
================================ */
createSystem({
    sunMass: 1000,
    p1Mass: 1,
    p1Dist: 10,
    p1Vx: 0,
    p1Vy: circularVelocity(1000,10),
    p2Mass: 0.5,
    p2Dist: 18,
    p2Vx: 0,
    p2Vy: circularVelocity(1000,18)
});

/* ===============================
   LOOP
================================ */
function animate() {
    requestAnimationFrame(animate);

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        currentState = update(currentState);
    }

    for (const id in currentState.bodies) {
        const b = currentState.bodies[id];
        meshes[id].position.set(b.position.x, b.position.y, 0);
    }

    sunLight.position.copy(meshes.sun.position);

    // Camera follows center of mass
    const com = computeCOM(currentState.bodies);
    controls.target.set(com.x, com.y, 0);

    controls.update();
    composer.render();
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
});
