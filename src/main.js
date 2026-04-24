import "./styles.css";
import * as THREE from "three";
import { Peer } from "peerjs";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);
scene.fog = new THREE.Fog(0x101014, 90, 430);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
const clock = new THREE.Clock();

const ui = {
  splash: document.querySelector("#splash"),
  start: document.querySelector("#startBtn"),
  seed: document.querySelector("#seedBtn"),
  pause: document.querySelector("#pauseBtn"),
  reset: document.querySelector("#resetBtn"),
  cam: document.querySelector("#camBtn"),
  roleLabel: document.querySelector("#roleLabel"),
  score: document.querySelector("#scoreLabel"),
  totalScore: document.querySelector("#totalScoreLabel"),
  health: document.querySelector("#healthLabel"),
  heat: document.querySelector("#heatLabel"),
  time: document.querySelector("#timeLabel"),
  pointer: document.querySelector("#criminalPointer"),
  radio: document.querySelector("#radioText"),
  nitro: document.querySelector("#nitroBar"),
  roleCards: [...document.querySelectorAll(".role-card")],
  gameOver: document.querySelector("#gameOver"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  again: document.querySelector("#againBtn"),
  host: document.querySelector("#hostBtn"),
  join: document.querySelector("#joinBtn"),
  room: document.querySelector("#roomInput"),
  mpStatus: document.querySelector("#mpStatus"),
  localP2: document.querySelector("#localP2")
};

const keys = new Set();
const buildings = [];
const obstacles = [];
const parks = [];
const pickups = [];
const ramps = [];
const pedestrians = [];
const vehicles = [];
const sparks = [];
const trafficMats = [];
let towLine;
let towedVehicle = null;
let busUnlocked = false;
let peer;
let conn;
let remoteCar;
let seed = Math.floor(Math.random() * 999999);
let selectedRole = "cop";
let gameStarted = false;
let paused = false;
let cameraMode = 0;
let score = 0;
let lifeScore = 0;
let totalScore = Number(localStorage.getItem("neon-badge-runner-total") || 0);
let heat = 0;
let heatCopTier = 0;
let remaining = 180;
let radioTimer = 0;
let roadMap = [];
let roadCells = [];
let mapLimit = 245;
const blockSize = 28;
const worldCells = 31;
const unlocks = {
  copInterceptor: 350,
  copSwat: 900,
  copTank: 1800,
  criminalMuscle: 400,
  doubleDecker: 1000,
  criminalBulldozer: 1800
};

const world = new THREE.Group();
scene.add(world);

const mats = {
  road: new THREE.MeshStandardMaterial({ color: 0x25252a, roughness: 0.82 }),
  lane: new THREE.MeshBasicMaterial({ color: 0xf5e7b8 }),
  crosswalk: new THREE.MeshBasicMaterial({ color: 0xf3eee1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x1f7a5a, roughness: 0.9 }),
  lawn: new THREE.MeshStandardMaterial({ color: 0x3f9b55, roughness: 0.92 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xc79b5f, roughness: 0.96 }),
  cactus: new THREE.MeshStandardMaterial({ color: 0x2c8a4a, roughness: 0.82 }),
  desertRock: new THREE.MeshStandardMaterial({ color: 0x8c7257, roughness: 0.9 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x7b7b72, roughness: 0.8 }),
  park: new THREE.MeshStandardMaterial({ color: 0x2e9b63, roughness: 0.94 }),
  tree: new THREE.MeshStandardMaterial({ color: 0x1c6a3a, roughness: 0.86 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6d5135, roughness: 0.9 }),
  houseRoof: new THREE.MeshStandardMaterial({ color: 0x7d2f32, roughness: 0.78 }),
  houseWall: new THREE.MeshStandardMaterial({ color: 0xd7c6a5, roughness: 0.74 }),
  fence: new THREE.MeshStandardMaterial({ color: 0xd8cfb2, roughness: 0.84 }),
  playground: new THREE.MeshStandardMaterial({ color: 0xff5a5f, roughness: 0.55 }),
  playgroundBlue: new THREE.MeshStandardMaterial({ color: 0x3fa7d6, roughness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9b6a3f, roughness: 0.82 }),
  water: new THREE.MeshStandardMaterial({ color: 0x2489a6, emissive: 0x052936, roughness: 0.28, metalness: 0.15 }),
  rubble: new THREE.MeshStandardMaterial({ color: 0x6f6b5f, roughness: 0.88 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x36e7d4, emissive: 0x0a5b59, roughness: 0.28, metalness: 0.1 }),
  windowLit: new THREE.MeshBasicMaterial({ color: 0xffe6a3 }),
  windowCool: new THREE.MeshBasicMaterial({ color: 0x55d6ff }),
  windowDark: new THREE.MeshBasicMaterial({ color: 0x15212a }),
  ramp: new THREE.MeshStandardMaterial({ color: 0xf9c74f, emissive: 0x2e1b00, roughness: 0.58 }),
  rampStripe: new THREE.MeshBasicMaterial({ color: 0x101014 }),
  cop: new THREE.MeshStandardMaterial({ color: 0x1665d8, roughness: 0.45 }),
  criminal: new THREE.MeshStandardMaterial({ color: 0xff3c38, roughness: 0.5 }),
  traffic: new THREE.MeshStandardMaterial({ color: 0x6f7d87, roughness: 0.58 }),
  pedestrianSkin: new THREE.MeshStandardMaterial({ color: 0xf0b27a, roughness: 0.6 }),
  pedestrianDark: new THREE.MeshStandardMaterial({ color: 0x17161a, roughness: 0.72 }),
  pedestrianBright: new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.62 }),
  remote: new THREE.MeshStandardMaterial({ color: 0xf9c74f, roughness: 0.45 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf5e7b8, emissive: 0x15110a }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf9c74f, emissive: 0x4a3200, roughness: 0.34 }),
  loot: new THREE.MeshStandardMaterial({ color: 0xf9c74f, emissive: 0x5c3300, roughness: 0.2 }),
  cash: new THREE.MeshStandardMaterial({ color: 0x74d66d, emissive: 0x123d17, roughness: 0.42 }),
  donut: new THREE.MeshStandardMaterial({ color: 0xffb4cf, emissive: 0x5d1430, roughness: 0.35 })
};

  for (const color of [0x6f7d87, 0xb6a16e, 0x5e8c61, 0x9b715f, 0xa9b5bd, 0x4d5966]) {
  trafficMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.62 }));
}

const towGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
towLine = new THREE.Line(towGeometry, new THREE.LineBasicMaterial({ color: 0xf9c74f }));
towLine.visible = false;
scene.add(towLine);

const hemi = new THREE.HemisphereLight(0xf5e7b8, 0x182820, 1.15);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-90, 140, 60);
sun.castShadow = true;
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const rng = (function makeRng() {
  let state = seed;
  return {
    reset(nextSeed) {
      state = nextSeed || 1;
    },
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.next();
    },
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    }
  };
})();

function makeBox(w, h, d, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeFlatPanel(w, h, d, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function maxHealthForRole(role, isBus = false) {
  if (isBus) return 260;
  if (role === "cop") return 145;
  if (role === "criminal") return 170;
  return 75;
}

function maxHealthForLevel(role, level) {
  if (role === "cop") return level >= 4 ? 360 : level >= 3 ? 245 : level >= 2 ? 190 : 145;
  if (role === "criminal") return level >= 4 ? 340 : level >= 3 ? 260 : level >= 2 ? 210 : 170;
  return 75;
}

function vehicleMass(car) {
  if (car.isTank) return 5.7;
  if (car.isDozer) return 5.2;
  if (car.isBus) return 4.4;
  if (car.vehicleLevel >= 3) return 3.2;
  if (car.vehicleLevel >= 2) return 2.35;
  if (car.trafficVariant === "pickup") return 1.65;
  if (car.trafficVariant === "scooter") return 0.42;
  if (car.role === "traffic") return 1.15;
  return 1.65;
}

function makeCar(role, controlled = false, tint = null) {
  const group = new THREE.Group();
  const trafficVariant = role === "traffic" ? rng.pick(["sedan", "sedan", "sedan", "pickup", "scooter"]) : null;
  const material = tint || (role === "cop" ? mats.cop : role === "criminal" ? mats.criminal : rng.pick(trafficMats));

  if (trafficVariant === "pickup") {
    const cab = makeBox(5.4, 1.65, 4.3, material, 0, 1.25, 2.15);
    const bed = makeBox(5.7, 1.0, 5.2, material, 0, 1.05, -2.65);
    const bedGap = makeBox(4.6, 0.74, 3.9, mats.tire, 0, 1.45, -2.75);
    const glass = makeBox(3.7, 1.25, 2.2, mats.glass, 0, 2.45, 2.2);
    const bumper = makeBox(6.1, 0.45, 0.72, mats.white, 0, 1.05, 4.55);
    group.add(cab, bed, bedGap, glass, bumper);
    for (const x of [-3.1, 3.1]) {
      for (const z of [-3.35, 3.45]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.56, 12), mats.tire);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.65, z);
        tire.castShadow = true;
        group.add(tire);
      }
    }
  } else if (trafficVariant === "scooter") {
    const deck = makeBox(1.2, 0.42, 3.8, material, 0, 0.92, 0.15);
    const seat = makeBox(1.35, 0.45, 1.25, mats.tire, 0, 1.42, -0.65);
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 4, 8), mats.pedestrianBright);
    rider.position.set(0, 2.05, -0.1);
    rider.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), mats.pedestrianSkin);
    head.position.set(0, 2.78, -0.08);
    head.castShadow = true;
    const handlebar = makeBox(1.7, 0.16, 0.24, mats.white, 0, 1.78, 1.72);
    group.add(deck, seat, rider, head, handlebar);
    for (const z of [-1.55, 1.75]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.32, 14), mats.tire);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(0, 0.62, z);
      tire.castShadow = true;
      group.add(tire);
    }
  } else {
    const body = makeBox(5.2, 1.4, 8.3, material, 0, 1.1, 0);
    const cabin = makeBox(3.6, 1.4, 3.3, mats.glass, 0, 2.25, 0.6);
    const bumper = makeBox(5.6, 0.45, 0.6, mats.white, 0, 1.15, 4.55);
    group.add(body, cabin, bumper);

    for (const x of [-2.9, 2.9]) {
      for (const z of [-2.8, 2.8]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.52, 12), mats.tire);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.62, z);
        tire.castShadow = true;
        group.add(tire);
      }
    }

    if (role === "cop") {
      const bar = makeBox(3.2, 0.32, 0.7, mats.white, 0, 3.15, 0.7);
      const red = makeBox(1.4, 0.38, 0.8, mats.criminal, -0.8, 3.4, 0.7);
      const blue = makeBox(1.4, 0.38, 0.8, mats.cop, 0.8, 3.4, 0.7);
      group.add(bar, red, blue);
    } else if (role === "criminal") {
      const spoiler = makeBox(5, 0.28, 0.55, mats.tire, 0, 2.1, -4.35);
      group.add(spoiler);
    } else {
      const roof = makeBox(3.1, 0.42, 2.4, mats.white, 0, 3.02, 0.3);
      group.add(roof);
    }
  }

  world.add(group);
  const car = {
    group,
    role,
    controlled,
    velocity: new THREE.Vector3(),
    speed: 0,
    angle: 0,
    target: null,
    cooldown: 0,
    rampCooldown: 0,
    verticalSpeed: 0,
    nitro: 1,
    maxHealth: trafficVariant === "pickup" ? 100 : trafficVariant === "scooter" ? 35 : maxHealthForRole(role),
    health: trafficVariant === "pickup" ? 100 : trafficVariant === "scooter" ? 35 : maxHealthForRole(role),
    radius: trafficVariant === "pickup" ? 4.8 : trafficVariant === "scooter" ? 2.25 : 4.2,
    isBus: false,
    isInterceptor: false,
    isTank: false,
    isDozer: false,
    vehicleLevel: 1,
    npcScore: 0,
    trafficVariant,
    laneTarget: null,
    towCooldown: 0,
    busted: 0,
    wander: rng.range(0, Math.PI * 2),
    name: controlled ? "Player" : `${role}-${vehicles.length}`
  };
  vehicles.push(car);
  return car;
}

let player = makeCar("cop", true);
let player2 = null;

function rebuildAsBus(car) {
  for (let i = car.group.children.length - 1; i >= 0; i--) {
    const child = car.group.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    car.group.remove(child);
  }

  const lower = makeBox(7.6, 2.2, 15.5, mats.criminal, 0, 1.35, 0);
  const upper = makeBox(7.1, 2.0, 13.8, mats.criminal, 0, 3.55, 0.35);
  const windshield = makeBox(6.2, 1.25, 0.5, mats.glass, 0, 2.45, 8.02);
  const sideStripe = makeBox(7.85, 0.48, 13.5, mats.gold, 0, 2.35, -0.5);
  car.group.add(lower, upper, windshield, sideStripe);

  for (const x of [-4.1, 4.1]) {
    for (const z of [-5.4, 5.4]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.65, 14), mats.tire);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.72, z);
      tire.castShadow = true;
      car.group.add(tire);
    }
  }

  car.isBus = true;
  car.isInterceptor = false;
  car.isTank = false;
  car.isDozer = false;
  car.vehicleLevel = 3;
  car.radius = 7.2;
  car.maxHealth = maxHealthForRole(car.role, true);
  car.health = car.maxHealth;
  car.nitro = 1;
}

function rebuildAsBulldozer(car) {
  for (let i = car.group.children.length - 1; i >= 0; i--) {
    const child = car.group.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    car.group.remove(child);
  }

  const body = makeBox(7.8, 2.2, 11.4, mats.gold, 0, 1.55, -0.6);
  const cabin = makeBox(4.9, 2.1, 4.6, mats.glass, 0, 3.38, -1.35);
  const hood = makeBox(6.7, 1.3, 4.8, mats.gold, 0, 2.1, 3.4);
  const blade = makeBox(10.8, 2.1, 0.82, mats.rubble, 0, 1.18, 6.9);
  const bladeLip = makeBox(11.5, 0.38, 0.55, mats.white, 0, 2.28, 7.1);
  car.group.add(body, cabin, hood, blade, bladeLip);

  for (const x of [-4.4, 4.4]) {
    const tread = makeBox(1.15, 1.1, 10.2, mats.tire, x, 0.72, 0.25);
    car.group.add(tread);
    for (const z of [-3.8, -1.2, 1.4, 4.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.36, 12), mats.rubble);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.78, z);
      wheel.castShadow = true;
      car.group.add(wheel);
    }
  }

  car.isBus = false;
  car.isInterceptor = false;
  car.isTank = false;
  car.isDozer = true;
  car.vehicleLevel = 4;
  car.radius = 7.6;
  car.maxHealth = maxHealthForLevel("criminal", 4);
  car.health = car.maxHealth;
  car.nitro = 1;
}

function rebuildAsTank(car) {
  for (let i = car.group.children.length - 1; i >= 0; i--) {
    const child = car.group.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    car.group.remove(child);
  }

  const base = makeBox(8.8, 1.8, 11.2, mats.cop, 0, 1.18, 0);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 1.35, 14), mats.cop);
  turret.position.set(0, 2.72, 0.6);
  turret.castShadow = true;
  turret.receiveShadow = true;
  const barrel = makeBox(1.05, 0.82, 7.4, mats.tire, 0, 2.88, 5.15);
  const armor = makeBox(9.5, 0.7, 1.1, mats.white, 0, 1.35, 6.05);
  const red = makeBox(1.4, 0.42, 0.8, mats.criminal, -1.1, 3.55, -1.75);
  const blue = makeBox(1.4, 0.42, 0.8, mats.glass, 1.1, 3.55, -1.75);
  car.group.add(base, turret, barrel, armor, red, blue);

  for (const x of [-4.85, 4.85]) {
    const tread = makeBox(1.25, 1.15, 11.8, mats.tire, x, 0.78, 0);
    car.group.add(tread);
    for (const z of [-4.25, -1.4, 1.4, 4.25]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.42, 12), mats.rubble);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.86, z);
      wheel.castShadow = true;
      car.group.add(wheel);
    }
  }

  car.isBus = false;
  car.isInterceptor = false;
  car.isTank = true;
  car.isDozer = false;
  car.vehicleLevel = 4;
  car.radius = 7.9;
  car.maxHealth = maxHealthForLevel("cop", 4);
  car.health = car.maxHealth;
  car.nitro = 1;
}

function rebuildAsCopUpgrade(car, level) {
  for (let i = car.group.children.length - 1; i >= 0; i--) {
    const child = car.group.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    car.group.remove(child);
  }

  if (level >= 3) {
    const body = makeBox(7.2, 2.1, 11.8, mats.cop, 0, 1.35, 0);
    const cabin = makeBox(5.6, 1.6, 5.2, mats.glass, 0, 3.05, 0.8);
    const ram = makeBox(8.2, 0.8, 1.2, mats.tire, 0, 1.05, 6.55);
    const stripe = makeBox(7.5, 0.42, 10.4, mats.white, 0, 2.35, -0.2);
    const bar = makeBox(4.4, 0.38, 0.85, mats.white, 0, 4.05, 0.9);
    const red = makeBox(1.8, 0.45, 0.95, mats.criminal, -1.1, 4.36, 0.9);
    const blue = makeBox(1.8, 0.45, 0.95, mats.cop, 1.1, 4.36, 0.9);
    car.group.add(body, cabin, ram, stripe, bar, red, blue);
    for (const x of [-4, 4]) {
      for (const z of [-4.2, 4.2]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.65, 14), mats.tire);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.72, z);
        tire.castShadow = true;
        car.group.add(tire);
      }
    }
    car.radius = 5.9;
  } else {
    const body = makeBox(6.4, 1.65, 9.6, mats.cop, 0, 1.18, 0);
    const cabin = makeBox(4.5, 1.55, 4.1, mats.glass, 0, 2.65, 0.7);
    const bumper = makeBox(6.9, 0.55, 0.85, mats.white, 0, 1.05, 5.15);
    const bar = makeBox(3.8, 0.35, 0.8, mats.white, 0, 3.55, 0.7);
    const red = makeBox(1.6, 0.42, 0.9, mats.criminal, -0.95, 3.85, 0.7);
    const blue = makeBox(1.6, 0.42, 0.9, mats.cop, 0.95, 3.85, 0.7);
    car.group.add(body, cabin, bumper, bar, red, blue);
    for (const x of [-3.5, 3.5]) {
      for (const z of [-3.4, 3.4]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.58, 14), mats.tire);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.66, z);
        tire.castShadow = true;
        car.group.add(tire);
      }
    }
    car.radius = 4.9;
  }

  car.isInterceptor = true;
  car.isTank = false;
  car.isDozer = false;
  car.vehicleLevel = level;
  car.maxHealth = maxHealthForLevel("cop", level);
  car.health = car.maxHealth;
  car.nitro = 1;
}

function rebuildAsCriminalMuscle(car) {
  for (let i = car.group.children.length - 1; i >= 0; i--) {
    const child = car.group.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    car.group.remove(child);
  }
  const body = makeBox(6.2, 1.35, 9.7, mats.criminal, 0, 1.1, 0);
  const cabin = makeBox(3.9, 1.25, 3.4, mats.glass, 0, 2.25, 0.9);
  const hood = makeBox(3.4, 0.4, 2.5, mats.tire, 0, 2.0, 3.05);
  const spoiler = makeBox(6.4, 0.34, 0.7, mats.tire, 0, 2.05, -4.9);
  car.group.add(body, cabin, hood, spoiler);
  for (const x of [-3.3, 3.3]) {
    for (const z of [-3.25, 3.25]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.58, 14), mats.tire);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.64, z);
      tire.castShadow = true;
      car.group.add(tire);
    }
  }
  car.vehicleLevel = 2;
  car.isBus = false;
  car.isTank = false;
  car.isDozer = false;
  car.radius = 4.9;
  car.maxHealth = maxHealthForLevel("criminal", 2);
  car.health = car.maxHealth;
  car.nitro = 1;
}

function resetVehicleLevel(car) {
  if (car !== player) return;
  lifeScore = 0;
  busUnlocked = false;
  rebuildDefaultVehicle(car);
  car.vehicleLevel = 1;
  car.isBus = false;
  car.isInterceptor = false;
  car.isTank = false;
  car.isDozer = false;
  car.radius = 4.2;
  car.maxHealth = maxHealthForLevel(car.role, 1);
  car.health = car.maxHealth;
}

function rebuildDefaultVehicle(car) {
  for (let i = car.group.children.length - 1; i >= 0; i--) {
    const child = car.group.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    car.group.remove(child);
  }

  const material = car.role === "cop" ? mats.cop : car.role === "criminal" ? mats.criminal : mats.traffic;
  const body = makeBox(5.2, 1.4, 8.3, material, 0, 1.1, 0);
  const cabin = makeBox(3.6, 1.4, 3.3, mats.glass, 0, 2.25, 0.6);
  const bumper = makeBox(5.6, 0.45, 0.6, mats.white, 0, 1.15, 4.55);
  car.group.add(body, cabin, bumper);
  for (const x of [-2.9, 2.9]) {
    for (const z of [-2.8, 2.8]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.52, 12), mats.tire);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.62, z);
      tire.castShadow = true;
      car.group.add(tire);
    }
  }
  if (car.role === "cop") {
    const bar = makeBox(3.2, 0.32, 0.7, mats.white, 0, 3.15, 0.7);
    const red = makeBox(1.4, 0.38, 0.8, mats.criminal, -0.8, 3.4, 0.7);
    const blue = makeBox(1.4, 0.38, 0.8, mats.cop, 0.8, 3.4, 0.7);
    car.group.add(bar, red, blue);
  } else if (car.role === "criminal") {
    const spoiler = makeBox(5, 0.28, 0.55, mats.tire, 0, 2.1, -4.35);
    car.group.add(spoiler);
  }
}

function clearWorld() {
  for (let i = world.children.length - 1; i >= 0; i--) {
    const child = world.children[i];
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    world.remove(child);
  }
  buildings.length = 0;
  obstacles.length = 0;
  parks.length = 0;
  pickups.length = 0;
  ramps.length = 0;
  pedestrians.length = 0;
  vehicles.length = 0;
  sparks.length = 0;
}

function isRoadCell(x, z) {
  return x % 3 === 0 || z % 3 === 0 || (x + z + seed) % 11 === 0;
}

function biomeForCell(gx, gz, half) {
  const desertScore = gx / half + gz / half * 0.55;
  const parkScore = -gx / half + -gz / half * 0.45;
  if (desertScore > 1.08) return "desert";
  if (parkScore > 1.14) return "park";
  const ring = Math.hypot(gx, gz) / half;
  const residentialBand = ring > 0.5 && ring < 0.78;
  const pocketA = gx < -5 && gx > -11 && gz > -3 && gz < 5;
  const pocketB = gz < -6 && gz > -12 && gx > -3 && gx < 6;
  const pocketC = gx > 7 && gx < 12 && gz > -4 && gz < 4;
  if (residentialBand && (pocketA || pocketB || pocketC)) return "neighborhood";
  return "city";
}

function generateCity() {
  clearWorld();
  rng.reset(seed);
  roadMap = [];
  roadCells = [];
  towedVehicle = null;
  towLine.visible = false;
  busUnlocked = false;
  heatCopTier = Math.floor(heat / 20);

  const block = blockSize;
  const cells = worldCells;
  const half = Math.floor(cells / 2);
  const citySize = cells * block + block * 2;
  mapLimit = half * block + block * 0.78;

  scene.fog.near = 150;
  scene.fog.far = 760;
  sun.shadow.camera.left = -mapLimit;
  sun.shadow.camera.right = mapLimit;
  sun.shadow.camera.top = mapLimit;
  sun.shadow.camera.bottom = -mapLimit;
  sun.shadow.camera.updateProjectionMatrix();

  const ground = makeBox(citySize, 0.6, citySize, mats.grass, 0, -0.32, 0);
  ground.receiveShadow = true;
  world.add(ground);

  for (let gx = -half; gx <= half; gx++) {
    for (let gz = -half; gz <= half; gz++) {
      const x = gx * block;
      const z = gz * block;
      const biome = biomeForCell(gx, gz, half);
      if (isRoadCell(gx, gz)) {
        const isNorthSouth = gx % 3 === 0;
        const isEastWest = gz % 3 === 0;
        const isIntersection = isNorthSouth && isEastWest;
        const cell = {
          position: new THREE.Vector3(x, 0, z),
          gx,
          gz,
          isIntersection,
          rampAngle: isNorthSouth ? 0 : Math.PI / 2
        };
        roadCells.push(cell);
        roadMap.push(cell.position);
        const roadBase = biome === "desert" ? makeBox(block + 1.2, 0.08, block + 1.2, mats.sand, x, -0.01, z) : biome === "park" ? makeBox(block + 1.2, 0.08, block + 1.2, mats.park, x, -0.01, z) : biome === "neighborhood" ? makeBox(block + 1.2, 0.08, block + 1.2, mats.lawn, x, -0.01, z) : null;
        if (roadBase) world.add(roadBase);
        const road = makeBox(block + 1, 0.12, block + 1, mats.road, x, 0.02, z);
        road.receiveShadow = true;
        world.add(road);
        if (gx % 3 === 0) {
          world.add(makeBox(0.45, 0.14, block * 0.55, mats.lane, x, 0.1, z));
          if (!isIntersection) {
            world.add(makeBox(3.6, 0.18, block + 0.6, mats.sidewalk, x - block * 0.34, 0.12, z));
            world.add(makeBox(3.6, 0.18, block + 0.6, mats.sidewalk, x + block * 0.34, 0.12, z));
          }
        }
        if (gz % 3 === 0) {
          world.add(makeBox(block * 0.55, 0.14, 0.45, mats.lane, x, 0.1, z));
          if (!isIntersection) {
            world.add(makeBox(block + 0.6, 0.18, 3.6, mats.sidewalk, x, 0.12, z - block * 0.34));
            world.add(makeBox(block + 0.6, 0.18, 3.6, mats.sidewalk, x, 0.12, z + block * 0.34));
          }
        }
        if (isIntersection) makeCrosswalks(x, z, block);
      } else if (biome === "desert") {
        makeDesertPatch(x, z, block);
      } else if (biome === "neighborhood") {
        makeNeighborhoodLot(x, z, block);
      } else if (biome === "park" || (Math.abs(gx * 17 + gz * 31 + seed) % 19 === 0) || (gx % 6 === 2 && gz % 6 === -2)) {
        makePark(x, z, block);
      } else {
        const h = rng.range(10, 58);
        const w = rng.range(11, 20);
        const d = rng.range(11, 20);
        const base = makeBox(block * 0.92, 0.35, block * 0.92, mats.sidewalk, x, 0.08, z);
        const bmat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(rng.range(0.03, 0.58), rng.range(0.16, 0.45), rng.range(0.22, 0.44)),
          roughness: 0.72,
          metalness: 0.08
        });
        const building = makeBox(w, h, d, bmat, x, h / 2, z);
        addSkyscraperWindows(building, w, h, d);
        building.userData.radius = Math.max(w, d) * 0.75;
        building.userData.maxHealth = Math.max(90, h * 4);
        building.userData.health = building.userData.maxHealth;
        building.userData.destructible = true;
        buildings.push(building);
        obstacles.push(building);
        world.add(base, building);

        const signColor = rng.pick([mats.cop, mats.criminal, mats.loot, mats.glass]) || mats.glass;
        if (rng.next() > 0.45) {
          const sign = makeBox(w * 0.72, 1.2, 0.32, signColor, x, rng.range(5, h - 2), z - d / 2 - 0.22);
          world.add(sign);
        }
      }
    }
  }

  const rampCells = roadCells.filter((cell) => !cell.isIntersection && (cell.gx % 3 === 0 || cell.gz % 3 === 0));
  for (let i = 0; i < 24; i++) {
    const cell = rng.pick(rampCells);
    const sideOffset = cell.rampAngle === 0 ? new THREE.Vector3(rng.range(-4, 4), 0, rng.range(-3, 3)) : new THREE.Vector3(rng.range(-3, 3), 0, rng.range(-4, 4));
    const angle = cell.rampAngle + (rng.next() > 0.5 ? 0 : Math.PI);
    makeRamp(cell.position.x + sideOffset.x, cell.position.z + sideOffset.z, angle);
  }

  for (let i = 0; i < 64; i++) {
    const p = rng.pick(roadMap);
    const pickup = selectedRole === "cop" ? makeDonutPickup() : makeCashPickup();
    pickup.position.set(p.x + rng.range(-7, 7), 2.2, p.z + rng.range(-7, 7));
    if (selectedRole === "cop") pickup.rotation.x = Math.PI / 2;
    pickup.castShadow = true;
    pickup.userData.spin = rng.range(-2.5, 2.5);
    pickups.push(pickup);
    world.add(pickup);
  }

  const sidewalkCells = roadCells.filter((roadCell) => !roadCell.isIntersection && (roadCell.gx % 3 === 0 || roadCell.gz % 3 === 0));
  for (let i = 0; i < 54; i++) {
    const cell = rng.pick(sidewalkCells) || rng.pick(roadCells);
    makePedestrian(cell);
  }

  player = makeCar(selectedRole, true);
  placeCar(player, roadMap[0] || new THREE.Vector3());
  player.group.position.set(0, 0, 0);

  const enemyRole = selectedRole === "cop" ? "criminal" : "cop";
  const cpuRoles = selectedRole === "cop" ? ["criminal", "cop", "cop", "cop"] : ["cop", "cop", "cop", "cop"];
  for (const role of cpuRoles) {
    const car = makeCar(role, false);
    placeCar(car, rng.pick(roadMap));
    snapToStreetHeading(car);
    car.group.rotation.y = car.angle;
  }

  for (let i = 0; i < 38; i++) {
    const car = makeCar("traffic", false);
    placeCar(car, rng.pick(roadMap));
    snapToStreetHeading(car);
    car.group.rotation.y = car.angle;
    car.speed = car.trafficVariant === "scooter" ? rng.range(18, 36) : car.trafficVariant === "pickup" ? rng.range(12, 24) : rng.range(14, 28);
  }

  if (ui.localP2.checked) {
    player2 = makeCar(enemyRole, true, enemyRole === "cop" ? mats.cop : mats.criminal);
    placeCar(player2, rng.pick(roadMap));
    player2.name = "Player 2";
  } else {
    player2 = null;
  }

  if (remoteCar) {
    remoteCar = makeCar("criminal", false, mats.remote);
    remoteCar.name = "Remote";
  }
}

function makeDonutPickup() {
  return new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.92, 12, 22), mats.donut);
}

function makeCashPickup() {
  const cash = new THREE.Group();
  const bill = makeBox(4.4, 0.24, 2.35, mats.cash, 0, 0, 0);
  const band = makeBox(0.62, 0.28, 2.62, mats.gold, 0, 0.05, 0);
  const stem = makeBox(0.26, 0.36, 1.65, mats.white, 0, 0.25, 0);
  const top = makeBox(1.25, 0.36, 0.25, mats.white, 0, 0.25, -0.58);
  const mid = makeBox(1.18, 0.36, 0.25, mats.white, 0, 0.25, 0);
  const bottom = makeBox(1.25, 0.36, 0.25, mats.white, 0, 0.25, 0.58);
  cash.add(bill, band, stem, top, mid, bottom);
  cash.rotation.y = rng.range(0, Math.PI * 2);
  return cash;
}

function placeCar(car, point) {
  car.group.position.set(point.x, 0, point.z);
}

function makeCrosswalks(x, z, block) {
  const stripeCount = 10;
  const stripeGap = block * 0.065;
  const stripeLength = 3.5;
  const stripeWidth = 0.72;
  const inset = block * 0.36;
  for (let i = 0; i < stripeCount; i++) {
    const offset = (i - (stripeCount - 1) / 2) * stripeGap;
    world.add(makeFlatPanel(stripeWidth, 0.08, stripeLength, mats.crosswalk, x + offset, 0.18, z - inset));
    world.add(makeFlatPanel(stripeWidth, 0.08, stripeLength, mats.crosswalk, x + offset, 0.18, z + inset));
    world.add(makeFlatPanel(stripeLength, 0.08, stripeWidth, mats.crosswalk, x - inset, 0.18, z + offset));
    world.add(makeFlatPanel(stripeLength, 0.08, stripeWidth, mats.crosswalk, x + inset, 0.18, z + offset));
  }
}

function addSkyscraperWindows(building, w, h, d) {
  if (h < 24) return;
  const rows = Math.min(15, Math.floor(h / 4));
  const frontCols = Math.max(3, Math.floor(w / 3.2));
  const sideCols = Math.max(3, Math.floor(d / 3.2));
  const startY = -h / 2 + 4.2;
  const rowStep = (h - 7) / rows;
  const litPalette = [mats.windowLit, mats.windowCool, mats.windowDark];

  for (let row = 0; row < rows; row++) {
    const y = startY + row * rowStep;
    for (let col = 0; col < frontCols; col++) {
      const x = ((col + 0.5) / frontCols - 0.5) * w * 0.72;
      const mat = rng.pick(litPalette);
      building.add(makeFlatPanel(0.92, 0.62, 0.08, mat, x, y, -d / 2 - 0.05));
      building.add(makeFlatPanel(0.92, 0.62, 0.08, mat, x, y, d / 2 + 0.05));
    }
    for (let col = 0; col < sideCols; col++) {
      const z = ((col + 0.5) / sideCols - 0.5) * d * 0.72;
      const mat = rng.pick(litPalette);
      building.add(makeFlatPanel(0.08, 0.62, 0.92, mat, -w / 2 - 0.05, y, z));
      building.add(makeFlatPanel(0.08, 0.62, 0.92, mat, w / 2 + 0.05, y, z));
    }
  }
}

function makePark(x, z, block) {
  const park = new THREE.Group();
  park.position.set(x, 0, z);
  const base = makeBox(block * 0.92, 0.24, block * 0.92, mats.park, 0, 0.06, 0);
  base.receiveShadow = true;
  park.add(base);

  if (rng.next() > 0.55) {
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(rng.range(3.5, 6), rng.range(3.5, 6), 0.18, 18), mats.water);
    pond.position.set(rng.range(-5, 5), 0.23, rng.range(-5, 5));
    pond.scale.z = rng.range(0.55, 1.2);
    pond.receiveShadow = true;
    park.add(pond);
  }

  if (rng.next() > 0.58) {
    addPlayground(park, block);
  }

  for (let i = 0; i < rng.range(6, 11); i++) {
    const tree = new THREE.Group();
    const trunk = makeBox(0.9, rng.range(2, 3.5), 0.9, mats.trunk, 0, 1.1, 0);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(1.8, 2.8), 0), mats.tree);
    crown.position.set(0, trunk.position.y + rng.range(1.4, 2.2), 0);
    crown.castShadow = true;
    crown.receiveShadow = true;
    tree.add(trunk, crown);
    tree.position.set(rng.range(-block * 0.34, block * 0.34), 0, rng.range(-block * 0.34, block * 0.34));
    tree.userData.radius = 1.8;
    tree.userData.maxHealth = 35;
    tree.userData.health = 35;
    tree.userData.destructible = true;
    obstacles.push(tree);
    park.add(tree);
  }

  parks.push(park);
  world.add(park);
  return park;
}

function addPlayground(park, block) {
  const playground = new THREE.Group();
  playground.position.set(rng.range(-block * 0.16, block * 0.16), 0, rng.range(-block * 0.16, block * 0.16));

  const pad = makeBox(13.2, 0.14, 10.2, mats.desertRock, 0, 0.14, 0);
  const slideDeck = makeBox(2.6, 1.1, 2.6, mats.playgroundBlue, -2.8, 1.05, -0.8);
  const slide = makeBox(2.0, 0.22, 5.3, mats.playground, -2.8, 0.72, 2.2);
  slide.rotation.x = -0.32;
  const ladderA = makeBox(0.22, 2.3, 0.22, mats.white, -4.1, 1.25, -2.1);
  const ladderB = makeBox(0.22, 2.3, 0.22, mats.white, -1.5, 1.25, -2.1);
  const swingTop = makeBox(5.2, 0.22, 0.28, mats.white, 3.2, 2.8, -1.4);
  const swingLegA = makeBox(0.24, 2.8, 0.24, mats.white, 0.8, 1.42, -1.4);
  const swingLegB = makeBox(0.24, 2.8, 0.24, mats.white, 5.6, 1.42, -1.4);
  const seatA = makeBox(1.25, 0.16, 0.55, mats.tire, 2.4, 1.2, -1.4);
  const seatB = makeBox(1.25, 0.16, 0.55, mats.tire, 4.2, 1.2, -1.4);
  playground.add(pad, slideDeck, slide, ladderA, ladderB, swingTop, swingLegA, swingLegB, seatA, seatB);
  playground.userData.radius = 6.5;
  playground.userData.maxHealth = 70;
  playground.userData.health = 70;
  playground.userData.destructible = true;
  obstacles.push(playground);
  park.add(playground);
}

function makeNeighborhoodLot(x, z, block) {
  const lot = new THREE.Group();
  lot.position.set(x, 0, z);
  const lawn = makeBox(block * 0.94, 0.18, block * 0.94, mats.lawn, 0, 0.05, 0);
  const drivewaySide = rng.next() > 0.5 ? 1 : -1;
  const driveway = makeBox(4.6, 0.12, block * 0.62, mats.sidewalk, drivewaySide * block * 0.28, 0.16, -block * 0.05);
  lot.add(lawn, driveway);

  const house = makeHouse();
  house.position.set(rng.range(-3.5, 3.5), 0, rng.range(-2.5, 4.5));
  house.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
  house.userData.radius = 7.2;
  house.userData.maxHealth = 95;
  house.userData.health = 95;
  house.userData.destructible = true;
  obstacles.push(house);
  buildings.push(house);
  lot.add(house);

  addFenceRun(lot, block, -block * 0.43, -block * 0.43, block * 0.43, true);
  addFenceRun(lot, block, block * 0.43, -block * 0.43, block * 0.43, true);
  addFenceRun(lot, block, -block * 0.43, -block * 0.43, block * 0.43, false);

  const mailbox = new THREE.Group();
  mailbox.add(makeBox(0.22, 1.0, 0.22, mats.white, 0, 0.55, 0));
  mailbox.add(makeBox(0.9, 0.45, 0.55, rng.pick([mats.cop, mats.criminal, mats.gold]), 0, 1.15, 0));
  mailbox.position.set(-drivewaySide * block * 0.28, 0, -block * 0.38);
  lot.add(mailbox);

  if (rng.next() > 0.45) {
    const parked = makeBox(3.5, 1.0, 5.8, rng.pick(trafficMats), drivewaySide * block * 0.28, 0.85, -block * 0.22);
    const cab = makeBox(2.4, 0.85, 2.4, mats.glass, drivewaySide * block * 0.28, 1.65, -block * 0.25);
    lot.add(parked, cab);
  }

  parks.push(lot);
  world.add(lot);
  return lot;
}

function makeHouse() {
  const house = new THREE.Group();
  const wallMat = rng.next() > 0.45 ? mats.houseWall : new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng.range(0.05, 0.14), rng.range(0.22, 0.42), rng.range(0.58, 0.76)), roughness: 0.76 });
  const body = makeBox(10.8, 4.2, 8.6, wallMat, 0, 2.1, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.8, 3.1, 4), mats.houseRoof);
  roof.position.set(0, 5.55, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.82;
  roof.castShadow = true;
  roof.receiveShadow = true;
  const door = makeBox(1.55, 2.45, 0.18, mats.wood, -2.6, 1.35, -4.42);
  const windowA = makeFlatPanel(1.45, 1.05, 0.1, mats.windowLit, 1.2, 2.45, -4.48);
  const windowB = makeFlatPanel(1.45, 1.05, 0.1, mats.windowCool, 3.45, 2.45, -4.48);
  const stoop = makeBox(3.6, 0.32, 2.0, mats.sidewalk, -2.6, 0.22, -5.15);
  house.add(body, roof, door, windowA, windowB, stoop);
  return house;
}

function addFenceRun(parent, block, fixed, start, end, vertical) {
  const count = 5;
  for (let i = 0; i < count; i++) {
    const t = start + (end - start) * (i / (count - 1));
    const x = vertical ? fixed : t;
    const z = vertical ? t : fixed;
    parent.add(makeBox(vertical ? 0.28 : 3.8, 0.75, vertical ? 3.8 : 0.28, mats.fence, x, 0.45, z));
  }
}

function makeDesertPatch(x, z, block) {
  const desert = new THREE.Group();
  desert.position.set(x, 0, z);
  const base = makeBox(block * 0.96, 0.22, block * 0.96, mats.sand, 0, 0.05, 0);
  base.receiveShadow = true;
  desert.add(base);

  if (rng.next() > 0.48) {
    addWildWestSet(desert, block);
  }

  for (let i = 0; i < rng.range(4, 8); i++) {
    const cactus = makeCactus();
    cactus.position.set(rng.range(-block * 0.36, block * 0.36), 0, rng.range(-block * 0.36, block * 0.36));
    cactus.rotation.y = rng.range(0, Math.PI * 2);
    cactus.userData.radius = 1.55;
    cactus.userData.maxHealth = 45;
    cactus.userData.health = 45;
    cactus.userData.destructible = true;
    obstacles.push(cactus);
    desert.add(cactus);
  }

  for (let i = 0; i < rng.range(4, 9); i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(0.8, 1.8), 0), mats.desertRock);
    rock.position.set(rng.range(-block * 0.4, block * 0.4), rng.range(0.25, 0.6), rng.range(-block * 0.4, block * 0.4));
    rock.rotation.set(rng.range(-0.3, 0.3), rng.range(0, Math.PI), rng.range(-0.3, 0.3));
    rock.castShadow = true;
    rock.receiveShadow = true;
    desert.add(rock);
  }

  parks.push(desert);
  world.add(desert);
  return desert;
}

function addWildWestSet(desert, block) {
  const set = new THREE.Group();
  set.position.set(rng.range(-block * 0.18, block * 0.18), 0, rng.range(-block * 0.18, block * 0.18));
  set.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);

  const saloon = makeBox(8.4, 4.2, 5.8, mats.wood, 0, 2.1, 0);
  const falseFront = makeBox(9.2, 2.8, 0.52, mats.wood, 0, 5.35, -3.15);
  const porch = makeBox(10.4, 0.35, 2.8, mats.desertRock, 0, 0.32, -4.35);
  const sign = makeBox(5.2, 0.9, 0.28, mats.gold, 0, 4.65, -3.48);
  const trough = makeBox(5.6, 0.72, 1.2, mats.desertRock, -6.8, 0.62, -2.3);
  const railA = makeBox(0.28, 1.3, 7.0, mats.wood, 6.7, 0.92, -1.2);
  const railB = makeBox(0.28, 1.3, 7.0, mats.wood, -6.7, 0.92, -1.2);
  set.add(saloon, falseFront, porch, sign, trough, railA, railB);
  set.userData.radius = 8.5;
  set.userData.maxHealth = 115;
  set.userData.health = 115;
  set.userData.destructible = true;
  obstacles.push(set);
  desert.add(set);
}

function makeCactus() {
  const cactus = new THREE.Group();
  const height = rng.range(4.2, 7.4);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, height, 10), mats.cactus);
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  cactus.add(trunk);

  for (const side of [-1, 1]) {
    if (rng.next() < 0.24) continue;
    const armHeight = rng.range(height * 0.42, height * 0.72);
    const upper = rng.range(1.3, 2.4);
    const horizontal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 2.2, 8), mats.cactus);
    horizontal.rotation.z = Math.PI / 2;
    horizontal.position.set(side * 1.08, armHeight, 0);
    horizontal.castShadow = true;
    const vertical = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, upper, 8), mats.cactus);
    vertical.position.set(side * 2.05, armHeight + upper * 0.45, 0);
    vertical.castShadow = true;
    cactus.add(horizontal, vertical);
  }

  return cactus;
}

function nearestRoadCell(pos) {
  let best = roadCells[0];
  let bestDist = Infinity;
  for (const cell of roadCells) {
    const dist = cell.position.distanceTo(pos);
    if (dist < bestDist) {
      best = cell;
      bestDist = dist;
    }
  }
  return best;
}

function nearestSidewalkCell(pos) {
  let best = null;
  let bestDist = Infinity;
  for (const cell of roadCells) {
    if (cell.isIntersection || (cell.gx % 3 !== 0 && cell.gz % 3 !== 0)) continue;
    const dist = cell.position.distanceTo(pos);
    if (dist < bestDist) {
      best = cell;
      bestDist = dist;
    }
  }
  return best || nearestRoadCell(pos);
}

function snapToStreetHeading(car) {
  const cell = nearestRoadCell(car.group.position);
  if (!cell) return;
  if (cell.gx % 3 === 0 && cell.gz % 3 !== 0) {
    car.angle = rng.pick([0, Math.PI]);
  } else if (cell.gz % 3 === 0 && cell.gx % 3 !== 0) {
    car.angle = rng.pick([Math.PI / 2, Math.PI * 1.5]);
  } else {
    car.angle = rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
  }
}

function nextStreetTarget(car, lookahead = 4) {
  const cell = nearestRoadCell(car.group.position);
  if (!cell) return rng.pick(roadMap).clone();
  const forwardX = Math.round(Math.sin(car.angle));
  const forwardZ = Math.round(Math.cos(car.angle));
  const candidates = roadCells
    .filter((candidate) => {
      const dx = candidate.gx - cell.gx;
      const dz = candidate.gz - cell.gz;
      const ahead = dx * forwardX + dz * forwardZ;
      const lateral = Math.abs(dx * forwardZ - dz * forwardX);
      return ahead > 0 && ahead <= lookahead && lateral <= 0.25;
    })
    .sort((a, b) => cell.position.distanceTo(a.position) - cell.position.distanceTo(b.position));
  if (candidates.length) return candidates[candidates.length - 1].position.clone();

  const canTurn = cell.isIntersection || rng.next() > 0.72;
  if (canTurn) snapToStreetHeading(car);
  const fallback = roadCells.filter((candidate) => candidate.position.distanceTo(car.group.position) > 50);
  return (rng.pick(fallback)?.position || rng.pick(roadMap)).clone();
}

function makeRamp(x, z, angle) {
  const group = new THREE.Group();
  group.position.set(x, 0.18, z);
  group.rotation.y = angle;

  const deck = makeBox(8.8, 1.25, 17.5, mats.ramp, 0, 0.65, 0);
  deck.rotation.x = -0.24;
  const stripeA = makeBox(1.1, 0.08, 13.5, mats.rampStripe, -2.25, 1.34, 0.5);
  const stripeB = makeBox(1.1, 0.08, 13.5, mats.rampStripe, 2.25, 1.34, 0.5);
  stripeA.rotation.x = deck.rotation.x;
  stripeB.rotation.x = deck.rotation.x;
  const lip = makeBox(9.4, 0.45, 1.2, mats.white, 0, 1.72, -7.8);
  group.add(deck, stripeA, stripeB, lip);
  group.userData = {
    radius: 10,
    angle
  };
  ramps.push(group);
  world.add(group);
  return group;
}

function makePedestrian(cell) {
  if (!cell) return null;
  const group = new THREE.Group();
  const shirt = rng.next() > 0.5 ? mats.pedestrianBright : rng.pick([mats.cop, mats.criminal, mats.gold]);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.15, 4, 8), shirt);
  body.position.y = 1.25;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), mats.pedestrianSkin);
  head.position.y = 2.25;
  head.castShadow = true;
  const hat = makeBox(0.72, 0.16, 0.72, mats.pedestrianDark, 0, 2.63, 0);
  group.add(body, head, hat);

  const pedestrian = {
    group,
    speed: rng.range(3.2, 6.2),
    angle: 0,
    wobble: rng.range(0, Math.PI * 2),
    hitCooldown: 0
  };
  placePedestrianNearCell(pedestrian, cell);
  pedestrians.push(pedestrian);
  world.add(group);
  return pedestrian;
}

function placePedestrianNearCell(pedestrian, cell, offset = new THREE.Vector3()) {
  const northSouth = cell.gx % 3 === 0 && cell.gz % 3 !== 0;
  const eastWest = cell.gz % 3 === 0 && cell.gx % 3 !== 0;
  if (northSouth || (!eastWest && rng.next() > 0.5)) {
    const side = rng.next() > 0.5 ? 1 : -1;
    pedestrian.group.position.set(cell.position.x + side * blockSize * 0.34 + offset.x, 0, cell.position.z + rng.range(-blockSize * 0.38, blockSize * 0.38) + offset.z);
    pedestrian.angle = rng.pick([0, Math.PI]);
  } else {
    const side = rng.next() > 0.5 ? 1 : -1;
    pedestrian.group.position.set(cell.position.x + rng.range(-blockSize * 0.38, blockSize * 0.38) + offset.x, 0, cell.position.z + side * blockSize * 0.34 + offset.z);
    pedestrian.angle = rng.pick([Math.PI / 2, Math.PI * 1.5]);
  }
  pedestrian.group.rotation.y = pedestrian.angle;
  pedestrian.hitCooldown = 0;
}

function nearestRoadTarget(car) {
  if (!car.target || car.group.position.distanceTo(car.target) < 12 || rng.next() > 0.995) {
    if (car.role === "traffic") {
      car.target = nextStreetTarget(car, 5);
      return car.target;
    }
    const enemies = vehicles.filter((v) => v !== car && v.role !== car.role && v.role !== "traffic" && car.role !== "traffic");
    if (enemies.length && rng.next() > 0.35) {
      const targetEnemy = enemies.sort((a, b) => car.group.position.distanceTo(a.group.position) - car.group.position.distanceTo(b.group.position))[0];
      const pos = targetEnemy.group.position;
      car.target = new THREE.Vector3(pos.x, 0, pos.z);
    } else {
      car.target = rng.pick(roadMap).clone();
    }
  }
  return car.target;
}

function updatePlayer(car, dt, scheme) {
  const forward = keys.has(scheme.up) || keys.has(scheme.upAlt);
  const back = keys.has(scheme.down) || keys.has(scheme.downAlt);
  const left = keys.has(scheme.left) || keys.has(scheme.leftAlt);
  const right = keys.has(scheme.right) || keys.has(scheme.rightAlt);
  const boost = keys.has(scheme.boost);
  const levelBoost = Math.max(0, car.vehicleLevel - 1);
  const isHeavyRig = car.isTank || car.isDozer;
  const accel = isHeavyRig ? (forward ? 68 : back ? -42 : 0) : car.isBus ? (forward ? 76 : back ? -48 : 0) : forward ? 86 + levelBoost * 14 : back ? -56 : 0;
  const baseMax = car.isTank ? 58 : car.isDozer ? 62 : car.isBus ? 68 : 72 + levelBoost * 12;
  const boostedMax = car.isTank ? 82 : car.isDozer ? 88 : car.isBus ? 98 : 108 + levelBoost * 12;
  const maxSpeed = boost && car.nitro > 0 ? boostedMax : baseMax;
  car.speed += accel * dt;
  car.speed *= Math.pow(0.88, dt * 5);
  car.speed = THREE.MathUtils.clamp(car.speed, isHeavyRig ? -24 : car.isBus ? -28 : -34, maxSpeed);
  if (boost && Math.abs(car.speed) > 18 && car.nitro > 0) {
    car.nitro = Math.max(0, car.nitro - dt * 0.34);
    addSpark(car.group.position, selectedRole === "cop" ? 0x36e7d4 : 0xff3c38);
  } else {
    car.nitro = Math.min(1, car.nitro + dt * 0.12);
  }
  const turn = (left ? 1 : 0) - (right ? 1 : 0);
  car.angle += turn * dt * (car.isTank ? 1.25 : car.isDozer ? 1.38 : car.isBus ? 1.65 : car.isInterceptor ? 2.25 : 2.55) * THREE.MathUtils.clamp(Math.abs(car.speed) / 30, 0.2, 1);
  moveCar(car, dt);
}

function updateCpu(car, dt) {
  if (car.role === "traffic") {
    updateTraffic(car, dt);
    return;
  }
  const target = nearestRoadTarget(car);
  const dx = target.x - car.group.position.x;
  const dz = target.z - car.group.position.z;
  const desired = Math.atan2(dx, dz);
  let delta = THREE.MathUtils.euclideanModulo(desired - car.angle + Math.PI, Math.PI * 2) - Math.PI;
  car.angle += THREE.MathUtils.clamp(delta, -dt * 1.75, dt * 1.75);
  const heatBoost = selectedRole === "criminal" ? heat * 0.62 : heat * 0.22;
  const targetSpeed = car.role === "cop" ? 48 + heatBoost : 64;
  car.speed += (targetSpeed - car.speed) * dt * 1.15;
  if (car.role !== player.role && car.group.position.distanceTo(player.group.position) < 90) {
    car.speed += (12 + heat * 0.15) * dt;
  }
  applyStreetDiscipline(car, dt);
  moveCar(car, dt);
}

function updateTraffic(car, dt) {
  const target = nearestRoadTarget(car);
  const dx = target.x - car.group.position.x;
  const dz = target.z - car.group.position.z;
  const desired = Math.atan2(dx, dz);
  const delta = THREE.MathUtils.euclideanModulo(desired - car.angle + Math.PI, Math.PI * 2) - Math.PI;
  const turnRate = car.trafficVariant === "scooter" ? 1.25 : car.trafficVariant === "pickup" ? 0.72 : 0.85;
  car.angle += THREE.MathUtils.clamp(delta, -dt * turnRate, dt * turnRate);
  const minSpeed = car.trafficVariant === "scooter" ? 18 : car.trafficVariant === "pickup" ? 13 : 16;
  const maxSpeed = car.trafficVariant === "scooter" ? 36 : car.trafficVariant === "pickup" ? 24 : 30;
  car.speed += (rng.range(minSpeed, maxSpeed) - car.speed) * dt * 0.35;
  applyStreetDiscipline(car, dt);
  moveCar(car, dt);
}

function updatePedestrians(dt) {
  const criminal = findCriminalTarget();
  const anchor = criminal?.group.position || player.group.position;
  for (const pedestrian of pedestrians) {
    pedestrian.hitCooldown = Math.max(0, pedestrian.hitCooldown - dt);
    pedestrian.wobble += dt * 7;
    pedestrian.group.rotation.z = Math.sin(pedestrian.wobble) * 0.08;
    pedestrian.group.rotation.y = pedestrian.angle + Math.sin(pedestrian.wobble * 0.35) * 0.1;
    pedestrian.group.position.x += Math.sin(pedestrian.angle) * pedestrian.speed * dt;
    pedestrian.group.position.z += Math.cos(pedestrian.angle) * pedestrian.speed * dt;

  const localCell = nearestSidewalkCell(pedestrian.group.position);
    if (localCell && pedestrian.group.position.distanceTo(localCell.position) > blockSize * 0.58) {
      pedestrian.angle += Math.PI + rng.range(-0.25, 0.25);
    }

    if (pedestrian.group.position.distanceTo(anchor) > 390) {
      respawnPedestrianNearAnchor(pedestrian, anchor);
    }
  }
}

function respawnPedestrianNearAnchor(pedestrian, anchor = player.group.position) {
  const angle = rng.range(0, Math.PI * 2);
  const distance = rng.range(90, 175);
  const desired = new THREE.Vector3(anchor.x + Math.sin(angle) * distance, 0, anchor.z + Math.cos(angle) * distance);
  const cell = nearestSidewalkCell(desired);
  const point = cell?.position?.clone?.() || desired;
  const chunk = blockSize * worldCells;
  const offset = new THREE.Vector3(
    Math.round((desired.x - point.x) / chunk) * chunk,
    0,
    Math.round((desired.z - point.z) / chunk) * chunk
  );
  placePedestrianNearCell(pedestrian, cell, offset);
}

function applyStreetDiscipline(car, dt) {
  const cell = nearestRoadCell(car.group.position);
  if (!cell) return;
  if (cell.isIntersection) {
    car.speed *= Math.pow(car.role === "traffic" ? 0.72 : 0.86, dt * 5);
    if (rng.next() < dt * (car.role === "traffic" ? 0.65 : 0.24)) {
      snapToStreetHeading(car);
      car.target = nextStreetTarget(car, car.role === "traffic" ? 4 : 6);
    }
  }
  const laneAngle = cell.gx % 3 === 0 && cell.gz % 3 !== 0 ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI) : cell.gz % 3 === 0 && cell.gx % 3 !== 0 ? (Math.sin(car.angle) >= 0 ? Math.PI / 2 : Math.PI * 1.5) : car.angle;
  const delta = THREE.MathUtils.euclideanModulo(laneAngle - car.angle + Math.PI, Math.PI * 2) - Math.PI;
  car.angle += THREE.MathUtils.clamp(delta, -dt * 0.42, dt * 0.42);
}

function moveCar(car, dt) {
  const previous = car.group.position.clone();
  const dir = new THREE.Vector3(Math.sin(car.angle), 0, Math.cos(car.angle));
  car.group.position.addScaledVector(dir, car.speed * dt);
  car.group.rotation.y = car.angle;
  car.rampCooldown = Math.max(0, car.rampCooldown - dt);

  const boundary = mapLimit - car.radius - 2;
  if (Math.abs(car.group.position.x) > boundary || Math.abs(car.group.position.z) > boundary) {
    const hitX = Math.abs(car.group.position.x) > boundary;
    const hitZ = Math.abs(car.group.position.z) > boundary;
    car.group.position.x = THREE.MathUtils.clamp(car.group.position.x, -boundary, boundary);
    car.group.position.z = THREE.MathUtils.clamp(car.group.position.z, -boundary, boundary);
    car.speed *= -0.34;
    car.angle += Math.PI + rng.range(-0.45, 0.45);
    car.target = null;
    car.cooldown = Math.max(car.cooldown, 0.45);
    car.verticalSpeed = Math.max(car.verticalSpeed, Math.abs(car.speed) * 0.04);
    addSpark(car.group.position, 0xf9c74f);
    if (car.controlled) {
      shake(0.45);
      announce(hitX && hitZ ? "Corner boundary hit. This city has limits now." : "Boundary hit. No more edge teleporting.");
    }
  }

  handleRamps(car);
  car.verticalSpeed -= 36 * dt;
  car.group.position.y = Math.max(0, car.group.position.y + car.verticalSpeed * dt);
  if (car.group.position.y === 0 && car.verticalSpeed < 0) {
    car.verticalSpeed = 0;
  }

  for (const obstacle of obstacles) {
    if (car.group.position.y > 2.2) continue;
    const radius = obstacle.userData.radius || 12;
    const obstaclePos = new THREE.Vector3();
    obstacle.getWorldPosition(obstaclePos);
    const dx = car.group.position.x - obstaclePos.x;
    const dz = car.group.position.z - obstaclePos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < radius + car.radius) {
      const impact = Math.abs(car.speed);
      const hitPoint = car.group.position.clone();
      car.group.position.copy(previous);
      car.speed *= -0.42;
      car.angle += rng.range(-0.55, 0.55);
      damageCar(car, impact * 0.22, null);
      damageObstacle(obstacle, impact * (car.isTank ? 2.45 : car.isDozer ? 2.7 : car.isBus ? 1.9 : 1.15), hitPoint);
      if (car.controlled) shake(0.35);
      addSpark(previous, 0xf9c74f);
      break;
    }
  }
}

function handleRamps(car) {
  if (car.rampCooldown > 0 || Math.abs(car.speed) < 15 || car.group.position.y > 0.8) return;
  for (const ramp of ramps) {
    const dx = car.group.position.x - ramp.position.x;
    const dz = car.group.position.z - ramp.position.z;
    if (Math.hypot(dx, dz) > ramp.userData.radius) continue;

    const rampDir = new THREE.Vector3(Math.sin(ramp.userData.angle), 0, Math.cos(ramp.userData.angle));
    const carDir = new THREE.Vector3(Math.sin(car.angle), 0, Math.cos(car.angle));
    const alignment = rampDir.dot(carDir) * Math.sign(car.speed);
    if (alignment < 0.25) continue;

    car.verticalSpeed = 22 + Math.min(18, Math.abs(car.speed) * 0.28);
    car.speed += Math.sign(car.speed || 1) * 9;
    car.rampCooldown = 1.2;
    shake(car.controlled ? 0.55 : 0.2);
    for (let i = 0; i < 7; i++) addSpark(car.group.position, 0xf9c74f);
    if (car.controlled) announce("Ramp launch! Airborne justice has questionable paperwork.");
    break;
  }
}

function respawnCar(car, avoid = player.group.position) {
  if (car === towedVehicle) releaseTow("Cable released. Target respawned.");
  if (car === player) resetVehicleLevel(car);
  if (car !== player && car.role !== "traffic") resetCpuVehicleLevel(car);
  const candidates = roadMap.filter((point) => point.distanceTo(avoid) > 120).sort(() => rng.next() - 0.5);
  const point = candidates[0] || rng.pick(roadMap) || new THREE.Vector3();
  car.group.position.set(point.x, 0, point.z);
  car.angle = rng.range(0, Math.PI * 2);
  car.group.rotation.y = car.angle;
  car.speed = 0;
  car.verticalSpeed = 0;
  car.cooldown = 1.4;
  car.rampCooldown = 0.6;
  car.target = rng.pick(roadMap)?.clone?.() || null;
  car.health = car.maxHealth;
  car.nitro = 1;
}

function respawnNpcNearAnchor(car, anchor = player.group.position) {
  if (car === player || car === player2 || car === remoteCar) return;
  if (car === towedVehicle) releaseTow("Cable snapped. Target left the district.");
  const angle = rng.range(0, Math.PI * 2);
  const distance = rng.range(95, 185);
  const desired = new THREE.Vector3(anchor.x + Math.sin(angle) * distance, 0, anchor.z + Math.cos(angle) * distance);
  const cell = nearestRoadCell(desired);
  const point = cell?.position?.clone?.() || desired;
  const chunk = blockSize * worldCells;
  const offsetX = Math.round((desired.x - point.x) / chunk) * chunk;
  const offsetZ = Math.round((desired.z - point.z) / chunk) * chunk;
  car.group.position.set(point.x + offsetX, 0, point.z + offsetZ);
  snapToStreetHeading(car);
  car.group.rotation.y = car.angle;
  car.speed = car.role === "traffic" ? (car.trafficVariant === "scooter" ? rng.range(18, 36) : car.trafficVariant === "pickup" ? rng.range(12, 24) : rng.range(16, 30)) : rng.range(28, 46);
  car.verticalSpeed = 0;
  car.health = car.maxHealth;
  car.cooldown = 1.1;
  car.target = null;
}

function recycleDistantNpcs() {
  const criminal = findCriminalTarget();
  const anchor = criminal?.group.position || player.group.position;
  for (const car of vehicles) {
    if (car === player || car === player2 || car === remoteCar) continue;
    if (car.group.position.distanceTo(anchor) > 420) {
      respawnNpcNearAnchor(car, anchor);
    }
  }
}

function findCriminalTarget() {
  return vehicles.find((car) => car.role === "criminal");
}

function addScore(points) {
  score += points;
  lifeScore += points;
  totalScore += points;
  localStorage.setItem("neon-badge-runner-total", String(Math.floor(totalScore)));
  maybeUpgradePlayerVehicle();
}

function updateHeatCopSpawns() {
  const tier = Math.min(5, Math.floor(heat / 20));
  if (tier <= heatCopTier) return;
  const criminal = findCriminalTarget();
  const anchor = criminal?.group.position || player.group.position;
  for (let level = heatCopTier + 1; level <= tier; level++) {
    spawnHeatCopUnit(level, anchor);
  }
  heatCopTier = tier;
}

function spawnHeatCopUnit(level, anchor) {
  const car = makeCar("cop", false);
  car.name = `Heat Unit ${level}`;
  respawnNpcNearAnchor(car, anchor);
  car.npcScore = level * 165;
  maybeUpgradeNpcVehicle(car);
  car.speed = rng.range(38, 56) + level * 3;
  car.cooldown = 0.4;
  if (player.role === "criminal" || player.group.position.distanceTo(anchor) < 180) {
    announce(`Heat ${Math.floor(heat)}: extra cop unit dispatched.`);
  }
}

function maybeUpgradePlayerVehicle() {
  if (!player || player.health <= 0) return;
  if (selectedRole === "cop") {
    if (totalScore >= unlocks.copTank && lifeScore >= 1400 && player.vehicleLevel < 4) {
      rebuildAsTank(player);
      announce("Level 4 cop vehicle deployed: tank. Momentum has entered the chat.");
    } else if (totalScore >= unlocks.copSwat && lifeScore >= 700 && player.vehicleLevel < 3) {
      rebuildAsCopUpgrade(player, 3);
      announce("Level 3 cop vehicle deployed: SWAT ram van. Resets when wrecked.");
    } else if (totalScore >= unlocks.copInterceptor && lifeScore >= 350 && player.vehicleLevel < 2) {
      rebuildAsCopUpgrade(player, 2);
      announce("Level 2 cop vehicle deployed: interceptor cruiser. Resets when wrecked.");
    }
  } else if (selectedRole === "criminal") {
    if (totalScore >= unlocks.criminalBulldozer && lifeScore >= 1400 && player.vehicleLevel < 4) {
      rebuildAsBulldozer(player);
      announce("Level 4 criminal vehicle deployed: bulldozer. Side streets are now suggestions.");
    } else if (totalScore >= unlocks.doubleDecker && lifeScore >= 1000 && player.vehicleLevel < 3) {
      rebuildAsBus(player);
      busUnlocked = true;
      announce("Level 3 criminal vehicle deployed: double decker bus. Resets when wrecked.");
    } else if (totalScore >= unlocks.criminalMuscle && lifeScore >= 400 && player.vehicleLevel < 2) {
      rebuildAsCriminalMuscle(player);
      announce("Level 2 criminal vehicle deployed: muscle car. Resets when wrecked.");
    }
  }
}

function resetCpuVehicleLevel(car) {
  if (car.controlled || car === remoteCar || (car.role !== "cop" && car.role !== "criminal")) return;
  rebuildDefaultVehicle(car);
  car.vehicleLevel = 1;
  car.npcScore = 0;
  car.isBus = false;
  car.isInterceptor = false;
  car.isTank = false;
  car.isDozer = false;
  car.radius = 4.2;
  car.maxHealth = maxHealthForLevel(car.role, 1);
  car.health = car.maxHealth;
}

function grantNpcUpgradeScore(car, points) {
  if (!car || car.controlled || car === remoteCar || (car.role !== "cop" && car.role !== "criminal")) return;
  car.npcScore += points;
  maybeUpgradeNpcVehicle(car);
}

function maybeUpgradeNpcVehicle(car) {
  if (!car || car.controlled || car.health <= 0) return;
  const scoreNeeded = car.role === "cop" ? [0, 160, 380, 700] : [0, 140, 340, 650];
  const desiredLevel = car.npcScore >= scoreNeeded[3] ? 4 : car.npcScore >= scoreNeeded[2] ? 3 : car.npcScore >= scoreNeeded[1] ? 2 : 1;
  if (desiredLevel <= car.vehicleLevel) return;

  if (car.role === "cop") {
    if (desiredLevel >= 4) rebuildAsTank(car);
    else rebuildAsCopUpgrade(car, desiredLevel);
  } else {
    if (desiredLevel >= 4) rebuildAsBulldozer(car);
    else if (desiredLevel >= 3) rebuildAsBus(car);
    else rebuildAsCriminalMuscle(car);
  }

  if (car.group.position.distanceTo(player.group.position) < 130) {
    const label = car.role === "cop" ? (desiredLevel >= 4 ? "CPU tank" : desiredLevel >= 3 ? "CPU SWAT van" : "CPU interceptor") : (desiredLevel >= 4 ? "CPU bulldozer" : desiredLevel >= 3 ? "CPU bus" : "CPU muscle car");
    announce(`${label} upgraded nearby. The streets are escalating.`);
  }
}

function toggleTowCable() {
  if (towedVehicle) {
    releaseTow("Cable released.");
    return;
  }
  const candidates = vehicles
    .filter((car) => car !== player && car !== player2 && car !== remoteCar)
    .map((car) => ({ car, dist: car.group.position.distanceTo(player.group.position) }))
    .filter((item) => item.dist < 24)
    .sort((a, b) => a.dist - b.dist);
  if (!candidates.length) {
    announce("Tow cable missed. Get closer to an NPC car and hit E.");
    return;
  }
  towedVehicle = candidates[0].car;
  towedVehicle.towCooldown = 0.8;
  towLine.visible = true;
  announce("Tow cable latched. Swing that NPC like bad paperwork.");
}

function releaseTow(message = "Cable released.") {
  if (towedVehicle) {
    towedVehicle.towCooldown = 0.8;
  }
  towedVehicle = null;
  towLine.visible = false;
  announce(message);
}

function updateTowCable(dt) {
  if (!towedVehicle) {
    towLine.visible = false;
    return;
  }
  if (!vehicles.includes(towedVehicle) || towedVehicle.group.position.distanceTo(player.group.position) > 68) {
    releaseTow("Cable snapped.");
    return;
  }

  const anchor = player.group.position.clone();
  anchor.y += 1.7;
  const target = towedVehicle.group.position.clone();
  target.y += 1.5;
  const delta = target.clone().sub(anchor);
  const dist = Math.max(delta.length(), 0.001);
  const cableLength = player.isTank || player.isDozer ? 27 : player.isBus ? 24 : 19;
  if (dist > cableLength) {
    delta.normalize();
    const pull = dist - cableLength;
    towedVehicle.group.position.addScaledVector(delta, -pull * 0.65);
    towedVehicle.speed = Math.max(towedVehicle.speed, Math.min(Math.abs(player.speed) * (player.isTank || player.isDozer ? 0.95 : 0.72), player.isTank || player.isDozer ? 82 : player.isBus ? 70 : 58));
    towedVehicle.angle = Math.atan2(delta.x, delta.z) + Math.PI + Math.sin(performance.now() * 0.008) * 0.55;
  }
  towedVehicle.verticalSpeed = Math.max(towedVehicle.verticalSpeed, 0);
  towedVehicle.cooldown = Math.max(towedVehicle.cooldown, 0.12);
  const positions = towLine.geometry.attributes.position;
  positions.setXYZ(0, anchor.x, anchor.y, anchor.z);
  positions.setXYZ(1, target.x, target.y, target.z);
  positions.needsUpdate = true;
  towLine.visible = true;

  for (const car of vehicles) {
    if (car === player || car === towedVehicle || car.cooldown > 0) continue;
    if (car.group.position.distanceTo(towedVehicle.group.position) < car.radius + towedVehicle.radius + 1.5) {
      bounceVehicles(towedVehicle, car);
      if (selectedRole === "criminal") addScore(25);
      heat = Math.min(99, heat + 2);
    }
  }
}

function bounceVehicles(a, b, dealDamage = true) {
  const normal = a.group.position.clone().sub(b.group.position);
  if (normal.lengthSq() < 0.01) normal.set(rng.range(-1, 1), 0, rng.range(-1, 1));
  normal.y = 0;
  normal.normalize();

  const aSpeed = a.speed;
  const bSpeed = b.speed;
  const aMass = vehicleMass(a);
  const bMass = vehicleMass(b);
  const aMomentum = Math.abs(aSpeed) * aMass;
  const bMomentum = Math.abs(bSpeed) * bMass;
  const hitter = aMomentum >= bMomentum ? a : b;
  const victim = hitter === a ? b : a;
  const hitterMass = hitter === a ? aMass : bMass;
  const victimMass = victim === a ? aMass : bMass;
  const hitterSpeed = hitter === a ? aSpeed : bSpeed;
  const victimSpeed = victim === a ? aSpeed : bSpeed;
  const hitterDir = new THREE.Vector3(Math.sin(hitter.angle), 0, Math.cos(hitter.angle)).multiplyScalar(Math.sign(hitterSpeed || 1));
  const victimDir = new THREE.Vector3(Math.sin(victim.angle), 0, Math.cos(victim.angle)).multiplyScalar(Math.sign(victimSpeed || 1));
  const closingSpeed = Math.max(0, hitterDir.clone().multiplyScalar(Math.abs(hitterSpeed)).sub(victimDir.multiplyScalar(Math.abs(victimSpeed))).length());
  const massRatio = hitterMass / Math.max(victimMass, 0.1);
  const shove = THREE.MathUtils.clamp(closingSpeed * 0.14 * massRatio, 2.5, 14);
  const launchChance = THREE.MathUtils.clamp((closingSpeed - 32) / 78 + (massRatio - 1) * 0.09, 0.04, 0.78);
  const launchPower = THREE.MathUtils.clamp((closingSpeed - 18) * 0.22 * Math.min(massRatio, 3.4), 0, 28);

  const aSeparation = 1.4 + shove * (bMass / (aMass + bMass));
  const bSeparation = 1.4 + shove * (aMass / (aMass + bMass));
  a.group.position.addScaledVector(normal, aSeparation);
  b.group.position.addScaledVector(normal, -bSeparation);

  victim.group.position.addScaledVector(hitterDir, shove * THREE.MathUtils.clamp(massRatio, 0.8, 3.2));
  victim.angle = Math.atan2(hitterDir.x, hitterDir.z) + rng.range(-0.22, 0.22);
  victim.speed = THREE.MathUtils.clamp(Math.abs(hitterSpeed) * THREE.MathUtils.clamp(0.5 + massRatio * 0.2, 0.45, 1.35), 8, victim.role === "traffic" ? 95 : 110);
  hitter.speed = hitterSpeed * THREE.MathUtils.clamp(1 - 0.12 / Math.max(massRatio, 0.6), 0.72, 0.96);

  const loserLaunch = rng.next() < launchChance;
  const winnerLaunch = rng.next() < launchChance * 0.23 && massRatio < 1.4;
  if (launchPower > 0) {
    if (loserLaunch) {
      victim.verticalSpeed = Math.max(victim.verticalSpeed, launchPower * rng.range(0.72, 1.22));
      victim.group.position.y = Math.max(victim.group.position.y, 0.35);
    }
    if (winnerLaunch) {
      hitter.verticalSpeed = Math.max(hitter.verticalSpeed, launchPower * rng.range(0.35, 0.7));
      hitter.group.position.y = Math.max(hitter.group.position.y, 0.25);
    }
  }
  a.angle += rng.range(-0.22, 0.22);
  b.angle += rng.range(-0.22, 0.22);
  a.cooldown = Math.max(a.cooldown, 0.45);
  b.cooldown = Math.max(b.cooldown, 0.45);
  const hitPoint = a.group.position.clone().add(b.group.position).multiplyScalar(0.5);
  const hitPower = Math.max(8, closingSpeed * 0.38 + (aMomentum + bMomentum) * 0.035);
  if (dealDamage) {
    damageCar(a, hitPower, b);
    damageCar(b, hitPower, a);
  }
  for (let i = 0; i < 5 + Math.floor(Math.min(6, shove * 0.35)); i++) addSpark(hitPoint, 0xf9c74f);
  if (a === player || b === player) {
    shake(0.45 + launchPower * 0.015);
    announce(launchPower > 8 && (loserLaunch || winnerLaunch) ? "Momentum hit! Someone is briefly in aviation." : "Shove collision! Mass plus speed just won the argument.");
  }
}

function damageCar(car, amount, source = null) {
  if (!car || car.health <= 0) return;
  const adjusted = car.isTank || car.isDozer ? amount * 0.48 : car.isBus ? amount * 0.58 : amount;
  car.health = Math.max(0, car.health - adjusted);
  const color = car.role === "cop" ? 0x36e7d4 : car.role === "criminal" ? 0xff3c38 : 0xf9c74f;
  if (adjusted > 12) {
    for (let i = 0; i < 4; i++) addSpark(car.group.position, color);
  }
  if (car === player && adjusted > 8) {
    shake(Math.min(0.8, adjusted / 40));
    announce(`Vehicle damaged: ${Math.ceil(car.health)} HP left.`);
  }
  if (car.health > 0) return;

  if (car.role === "criminal") {
    const captor = source?.role === "cop" ? source : vehicles.find((vehicle) => vehicle.role === "cop") || source || player;
    captureCar(captor, car);
  } else if (car.role === "cop" && source?.role === "criminal") {
    captureCar(source, car);
  } else {
    if (car === player) {
      announce("Your vehicle is wrecked. Dispatch rebuilt it down the road.");
      heat = selectedRole === "criminal" ? Math.min(99, heat + 10) : heat;
    }
    respawnCar(car, source?.group?.position || player.group.position);
  }
}

function damageObstacle(obstacle, amount, impactPoint) {
  if (!obstacle.userData?.destructible) return;
  obstacle.userData.health -= amount;
  obstacle.rotation.y += rng.range(-0.02, 0.02);
  if (obstacle.userData.health > 0) return;
  destroyObstacle(obstacle, impactPoint);
}

function destroyObstacle(obstacle, impactPoint = obstacle.position) {
  const obstacleIndex = obstacles.indexOf(obstacle);
  if (obstacleIndex >= 0) obstacles.splice(obstacleIndex, 1);
  const buildingIndex = buildings.indexOf(obstacle);
  if (buildingIndex >= 0) buildings.splice(buildingIndex, 1);

  const worldPos = new THREE.Vector3();
  obstacle.getWorldPosition(worldPos);
  const parent = obstacle.parent;
  if (parent) parent.remove(obstacle);
  else world.remove(obstacle);

  for (let i = 0; i < 10; i++) {
    const rubble = makeBox(rng.range(1.4, 4), rng.range(0.6, 1.6), rng.range(1.4, 4), mats.rubble, worldPos.x + rng.range(-8, 8), rng.range(0.25, 1.2), worldPos.z + rng.range(-8, 8));
    rubble.rotation.set(rng.range(-0.4, 0.4), rng.range(0, Math.PI), rng.range(-0.4, 0.4));
    rubble.userData.life = rng.range(9, 16);
    rubble.userData.vel = new THREE.Vector3(rng.range(-2.5, 2.5), rng.range(1, 5), rng.range(-2.5, 2.5));
    rubble.userData.rubble = true;
    sparks.push(rubble);
    world.add(rubble);
  }
  for (let i = 0; i < 20; i++) addSpark(impactPoint, 0xf9c74f);
  addScore(35);
  heat = Math.min(99, heat + 3);
  announce("Building collapsed. The city planner is inconsolable.");
}

function captureCar(captor, target) {
  const targetWasPlayer = target === player;
  const targetWasLocalP2 = target === player2;
  const capturePoint = target.group.position.clone();

  if (captor.role === "cop" && target.role === "criminal") {
    target.busted += 1;
    grantNpcUpgradeScore(captor, 180);
    if (captor === player) {
      addScore(125);
      heat = Math.max(0, heat - 7);
      announce(`Captured! Prisoner van made pickup #${target.busted}. They respawn across town.`);
    } else if (targetWasPlayer) {
      score = Math.max(0, score - 55);
      heat = Math.min(99, heat + 13);
      announce("Caught by the cops. You respawned across town with fresh heat.");
    }
  } else if (captor.role === "criminal" && target.role === "cop") {
    grantNpcUpgradeScore(captor, 170);
    if (captor === player) {
      addScore(90);
      heat = Math.min(99, heat + 6);
      announce("You juked a cruiser into retirement. It respawned mad.");
    } else if (targetWasPlayer) {
      score = Math.max(0, score - 40);
      heat = Math.max(0, heat - 4);
      announce("Criminals shoved your cruiser off the beat. Respawning at dispatch.");
    }
  }

  for (let i = 0; i < 16; i++) addSpark(capturePoint, captor.role === "cop" ? 0x36e7d4 : 0xff3c38);
  shake(targetWasPlayer || targetWasLocalP2 || captor === player ? 0.9 : 0.35);
  captor.cooldown = Math.max(captor.cooldown, 0.8);
  respawnCar(target, captor.group.position);
  captor.speed *= -0.25;
}

let shakeAmount = 0;
function shake(amount) {
  shakeAmount = Math.max(shakeAmount, amount);
}

function addSpark(pos, color) {
  if (sparks.length > 55) return;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.25, 0.75), 7, 7), new THREE.MeshBasicMaterial({ color }));
  spark.position.copy(pos);
  spark.position.y = rng.range(1, 3);
  spark.userData.life = 0.45;
  spark.userData.vel = new THREE.Vector3(rng.range(-8, 8), rng.range(3, 12), rng.range(-8, 8));
  sparks.push(spark);
  world.add(spark);
}

function handleInteractions(dt) {
  for (const pickup of [...pickups]) {
    pickup.rotation.z += dt * pickup.userData.spin;
    pickup.position.y = 2.2 + Math.sin(performance.now() * 0.004 + pickup.position.x) * 0.35;
    if (pickup.position.distanceTo(player.group.position) < 6) {
      if (selectedRole === "cop") {
        const before = player.health;
        player.health = Math.min(player.maxHealth, player.health + 35);
        heat = Math.max(0, heat - 1);
        announce(player.health > before ? `Donut medic kit: healed to ${Math.ceil(player.health)} HP.` : "Donut secured. Already at full health.");
      } else {
        addScore(50);
        heat = Math.min(99, heat + 4);
        announce("Loot scooped. The city budget felt that.");
      }
      world.remove(pickup);
      pickups.splice(pickups.indexOf(pickup), 1);
    }
  }

  for (const pedestrian of pedestrians) {
    if (pedestrian.hitCooldown > 0) continue;
    for (const car of vehicles) {
      if (car.group.position.y > 2.4 || Math.abs(car.speed) < 8) continue;
      if (pedestrian.group.position.distanceTo(car.group.position) > car.radius + 0.75) continue;
      hitPedestrian(pedestrian, car);
      break;
    }
  }

  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    a.cooldown = Math.max(0, a.cooldown - dt);
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      if (a.group.position.y > 2.6 || b.group.position.y > 2.6) continue;
      const dist = a.group.position.distanceTo(b.group.position);
      if (dist > a.radius + b.radius || a.cooldown > 0 || b.cooldown > 0) continue;

      if (a.role === "traffic" || b.role === "traffic") {
        bounceVehicles(a, b);
        continue;
      }

      if (a.role === "cop" && b.role === "criminal") {
        damageCar(b, 34 + Math.abs(a.speed - b.speed) * 0.28, a);
        damageCar(a, 14 + Math.abs(a.speed - b.speed) * 0.12, b);
        bounceVehicles(a, b, false);
      } else if (a.role === "criminal" && b.role === "cop") {
        damageCar(a, 34 + Math.abs(a.speed - b.speed) * 0.28, b);
        damageCar(b, 14 + Math.abs(a.speed - b.speed) * 0.12, a);
        bounceVehicles(a, b, false);
      }
    }
  }

  for (const spark of [...sparks]) {
    spark.userData.life -= dt;
    if (spark.userData.vel) {
      spark.position.addScaledVector(spark.userData.vel, dt);
      spark.userData.vel.y -= spark.userData.rubble ? 9 * dt : 22 * dt;
    }
    if (!spark.userData.rubble) {
      spark.material.opacity = Math.max(0, spark.userData.life);
    }
    if (spark.userData.life <= 0) {
      sparks.splice(sparks.indexOf(spark), 1);
      world.remove(spark);
    }
  }
}

function hitPedestrian(pedestrian, car) {
  pedestrian.hitCooldown = 1.4;
  const hitPoint = pedestrian.group.position.clone();
  for (let i = 0; i < 8; i++) addSpark(hitPoint, 0x2ec4b6);
  if (car === player) {
    if (selectedRole === "criminal") {
      addScore(12);
      heat = Math.min(99, heat + 2);
      announce("Sidewalk mayhem! Pedestrian bonked and respawned with a dramatic story.");
    } else {
      score = Math.max(0, score - 8);
      heat = Math.min(99, heat + 1);
      announce("Careful, officer. Pedestrian clipped, no collision wall, very real paperwork.");
    }
    shake(0.22);
  }
  respawnPedestrianNearAnchor(pedestrian, findCriminalTarget()?.group.position || player.group.position);
}

function updateCamera(dt) {
  const target = player.group.position;
  let offset;
  if (cameraMode === 0) {
    offset = new THREE.Vector3(-Math.sin(player.angle) * 50, 36, -Math.cos(player.angle) * 50);
  } else if (cameraMode === 1) {
    offset = new THREE.Vector3(0, 112, 78);
  } else {
    offset = new THREE.Vector3(Math.sin(player.angle) * 5, 9, Math.cos(player.angle) * 5);
  }
  const desired = target.clone().add(offset);
  if (shakeAmount > 0) {
    desired.x += rng.range(-shakeAmount, shakeAmount) * 3;
    desired.y += rng.range(-shakeAmount, shakeAmount) * 2;
    shakeAmount = Math.max(0, shakeAmount - dt * 1.7);
  }
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  camera.lookAt(target.x, target.y + 3, target.z);
}

function announce(text) {
  ui.radio.textContent = text;
  radioTimer = 3.8;
}

function updateUi() {
  const vehicleName = selectedRole === "cop" ? (player.vehicleLevel >= 4 ? "Tank" : player.vehicleLevel >= 3 ? "SWAT" : player.vehicleLevel >= 2 ? "Interceptor" : "Cop") : (player.vehicleLevel >= 4 ? "Dozer" : player.vehicleLevel >= 3 ? "Bus" : player.vehicleLevel >= 2 ? "Muscle" : "Criminal");
  ui.roleLabel.textContent = `${vehicleName} L${player.vehicleLevel}`;
  ui.score.textContent = String(Math.floor(score));
  ui.totalScore.textContent = String(Math.floor(totalScore));
  ui.health.textContent = `${Math.ceil(player.health)}/${Math.ceil(player.maxHealth)}`;
  ui.health.parentElement.style.setProperty("--health", `${THREE.MathUtils.clamp((player.health / player.maxHealth) * 100, 0, 100)}%`);
  ui.heat.textContent = String(Math.floor(heat));
  const min = Math.floor(remaining / 60).toString().padStart(2, "0");
  const sec = Math.floor(remaining % 60).toString().padStart(2, "0");
  ui.time.textContent = `${min}:${sec}`;
  ui.nitro.style.width = `${Math.floor(player.nitro * 100)}%`;
  updateCriminalPointer();
}

function updateCriminalPointer() {
  if (selectedRole === "cop") {
    const criminal = findCriminalTarget();
    if (criminal) {
      const projected = criminal.group.position.clone();
      projected.y += 2;
      projected.project(camera);
      if (projected.z > 1) projected.multiplyScalar(-1);

      const margin = 76;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cx = width / 2;
      const cy = height / 2;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      const rawX = screenX - cx;
      const rawY = screenY - cy;
      const length = Math.hypot(rawX, rawY) || 1;
      const dirX = rawX / length;
      const dirY = rawY / length;
      const scaleX = dirX === 0 ? Infinity : (cx - margin) / Math.abs(dirX);
      const scaleY = dirY === 0 ? Infinity : (cy - margin) / Math.abs(dirY);
      const scale = Math.min(scaleX, scaleY);
      const x = THREE.MathUtils.clamp(cx + dirX * scale, margin, width - margin);
      const y = THREE.MathUtils.clamp(cy + dirY * scale, margin, height - margin);
      const arrowAngle = Math.atan2(dirY, dirX) + Math.PI / 2;
      ui.pointer.classList.remove("hidden");
      ui.pointer.style.left = `${x - 27}px`;
      ui.pointer.style.top = `${y - 27}px`;
      ui.pointer.querySelector("span").style.transform = `rotate(${arrowAngle}rad)`;
      return;
    }
  }
  ui.pointer.classList.add("hidden");
}

function endGame() {
  gameStarted = false;
  ui.gameOver.classList.remove("hidden");
  const target = selectedRole === "cop" ? "arrests" : "loot haul";
  ui.resultTitle.textContent = score > 900 ? "Absolute siren poetry." : score > 450 ? "Respectable chaos." : "Messy, but cinematic.";
  ui.resultText.textContent = `Round ${target}: ${Math.floor(score)}. Total score: ${Math.floor(totalScore)}. Heat ended at ${Math.floor(heat)}.`;
}

function resetRound(newSeed = false) {
  if (newSeed) seed = Math.floor(Math.random() * 999999);
  score = 0;
  heat = selectedRole === "criminal" ? 18 : 0;
  heatCopTier = Math.floor(heat / 20);
  remaining = 180;
  paused = false;
  ui.gameOver.classList.add("hidden");
  generateCity();
  updateUi();
  announce(selectedRole === "cop" ? "Cop upgrades reset on wreck: 350 Interceptor, 700 SWAT, 1400 Tank if total allows." : "Criminal upgrades reset on wreck: 400 Muscle, 1000 Bus, 1400 Bulldozer if total allows.");
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameStarted && !paused) {
    remaining -= dt;
    if (remaining <= 0) endGame();
    updatePlayer(player, dt, {
      up: "KeyW",
      upAlt: "ArrowUp",
      down: "KeyS",
      downAlt: "ArrowDown",
      left: "KeyA",
      leftAlt: "ArrowLeft",
      right: "KeyD",
      rightAlt: "ArrowRight",
      boost: "ShiftLeft"
    });
    if (player2) {
      updatePlayer(player2, dt, {
        up: "KeyI",
        upAlt: "Numpad8",
        down: "KeyK",
        downAlt: "Numpad5",
        left: "KeyJ",
        leftAlt: "Numpad4",
        right: "KeyL",
        rightAlt: "Numpad6",
        boost: "Space"
      });
    }
    for (const car of vehicles) {
      if (!car.controlled && car !== remoteCar) updateCpu(car, dt);
    }
    updatePedestrians(dt);
    updateTowCable(dt);
    recycleDistantNpcs();
    updateHeatCopSpawns();
    handleInteractions(dt);
    updateCamera(dt);
    updateUi();
    sendMultiplayer();
    if (radioTimer > 0) {
      radioTimer -= dt;
      if (radioTimer <= 0) ui.radio.textContent = selectedRole === "cop" ? "Donuts heal. Total score unlocks Interceptor, SWAT, and Tank tiers." : "Total score unlocks Muscle, Bus, and Bulldozer tiers.";
    }
  }
  renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function bindUi() {
  ui.roleCards.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      ui.roleCards.forEach((card) => card.classList.toggle("selected", card === button));
      resetRound(true);
    });
  });

  ui.start.addEventListener("click", () => {
    ui.splash.classList.add("hidden");
    gameStarted = true;
    resetRound(false);
  });
  ui.seed.addEventListener("click", () => resetRound(true));
  ui.reset.addEventListener("click", () => resetRound(true));
  ui.pause.addEventListener("click", () => {
    paused = !paused;
    ui.pause.textContent = paused ? "▶" : "II";
  });
  ui.cam.addEventListener("click", () => {
    cameraMode = (cameraMode + 1) % 3;
  });
  ui.again.addEventListener("click", () => {
    gameStarted = true;
    resetRound(true);
  });
  ui.localP2.addEventListener("change", () => resetRound(false));
  ui.host.addEventListener("click", hostRoom);
  ui.join.addEventListener("click", joinRoom);

  window.addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (event.code === "Escape") {
      paused = !paused;
      ui.pause.textContent = paused ? "▶" : "II";
    }
    if (event.code === "KeyE" && !event.repeat && gameStarted && !paused) {
      toggleTowCable();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("resize", resize);
}

function hostRoom() {
  closeNet();
  const room = `NBR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  peer = new Peer(room);
  peer.on("open", (id) => {
    ui.room.value = id;
    ui.mpStatus.textContent = `Hosting ${id}. Send this code to a friend.`;
  });
  peer.on("connection", (connection) => {
    conn = connection;
    wireConnection();
    ui.mpStatus.textContent = "Friend connected. Rivalry authorized.";
  });
  peer.on("error", (error) => {
    ui.mpStatus.textContent = `Network hiccup: ${error.type}`;
  });
}

function joinRoom() {
  closeNet();
  const room = ui.room.value.trim().toUpperCase();
  if (!room) {
    ui.mpStatus.textContent = "Enter a room code first.";
    return;
  }
  peer = new Peer();
  peer.on("open", () => {
    conn = peer.connect(room);
    wireConnection();
    ui.mpStatus.textContent = `Joining ${room}...`;
  });
  peer.on("error", (error) => {
    ui.mpStatus.textContent = `Network hiccup: ${error.type}`;
  });
}

function wireConnection() {
  conn.on("open", () => {
    ui.mpStatus.textContent = "Online player linked. Yellow car is them.";
    if (!remoteCar) remoteCar = makeCar("criminal", false, mats.remote);
  });
  conn.on("data", (data) => {
    if (!remoteCar) remoteCar = makeCar(data.role || "criminal", false, mats.remote);
    remoteCar.role = data.role || "criminal";
    remoteCar.group.position.set(data.x, 0, data.z);
    remoteCar.group.rotation.y = data.a;
  });
  conn.on("close", () => {
    ui.mpStatus.textContent = "Friend disconnected.";
  });
}

function sendMultiplayer() {
  if (!conn?.open) return;
  conn.send({
    role: selectedRole,
    x: player.group.position.x,
    z: player.group.position.z,
    a: player.angle,
    score,
    heat
  });
}

function closeNet() {
  if (conn) conn.close();
  if (peer) peer.destroy();
  conn = null;
  peer = null;
}

resize();
bindUi();
resetRound(true);
camera.position.set(0, 80, 90);
camera.lookAt(0, 0, 0);
animate();
