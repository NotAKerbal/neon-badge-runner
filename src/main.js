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
  heat: document.querySelector("#heatLabel"),
  time: document.querySelector("#timeLabel"),
  tracker: document.querySelector("#trackerLabel"),
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
const pickups = [];
const ramps = [];
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
let totalScore = Number(localStorage.getItem("neon-badge-runner-total") || 0);
let heat = 0;
let remaining = 180;
let radioTimer = 0;
let roadMap = [];
let roadCells = [];
let mapLimit = 245;
const unlocks = {
  doubleDecker: 1000
};

const world = new THREE.Group();
scene.add(world);

const mats = {
  road: new THREE.MeshStandardMaterial({ color: 0x25252a, roughness: 0.82 }),
  lane: new THREE.MeshBasicMaterial({ color: 0xf5e7b8 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x1f7a5a, roughness: 0.9 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x7b7b72, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x36e7d4, emissive: 0x0a5b59, roughness: 0.28, metalness: 0.1 }),
  ramp: new THREE.MeshStandardMaterial({ color: 0xf9c74f, emissive: 0x2e1b00, roughness: 0.58 }),
  rampStripe: new THREE.MeshBasicMaterial({ color: 0x101014 }),
  cop: new THREE.MeshStandardMaterial({ color: 0x1665d8, roughness: 0.45 }),
  criminal: new THREE.MeshStandardMaterial({ color: 0xff3c38, roughness: 0.5 }),
  traffic: new THREE.MeshStandardMaterial({ color: 0x6f7d87, roughness: 0.58 }),
  remote: new THREE.MeshStandardMaterial({ color: 0xf9c74f, roughness: 0.45 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf5e7b8, emissive: 0x15110a }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf9c74f, emissive: 0x4a3200, roughness: 0.34 }),
  loot: new THREE.MeshStandardMaterial({ color: 0xf9c74f, emissive: 0x5c3300, roughness: 0.2 }),
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

function makeCar(role, controlled = false, tint = null) {
  const group = new THREE.Group();
  const material = tint || (role === "cop" ? mats.cop : role === "criminal" ? mats.criminal : rng.pick(trafficMats));
  const body = makeBox(5.2, 1.4, 8.3, material, 0, 1.1, 0);
  const cabin = makeBox(3.6, 1.4, 3.3, mats.glass, 0, 2.25, -0.6);
  const bumper = makeBox(5.6, 0.45, 0.6, mats.white, 0, 1.15, -4.55);
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
    const bar = makeBox(3.2, 0.32, 0.7, mats.white, 0, 3.15, -0.7);
    const red = makeBox(1.4, 0.38, 0.8, mats.criminal, -0.8, 3.4, -0.7);
    const blue = makeBox(1.4, 0.38, 0.8, mats.cop, 0.8, 3.4, -0.7);
    group.add(bar, red, blue);
  } else if (role === "criminal") {
    const spoiler = makeBox(5, 0.28, 0.55, mats.tire, 0, 2.1, 4.35);
    group.add(spoiler);
  } else {
    const roof = makeBox(3.1, 0.42, 2.4, mats.white, 0, 3.02, -0.3);
    group.add(roof);
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
    radius: 4.2,
    isBus: false,
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
  const upper = makeBox(7.1, 2.0, 13.8, mats.criminal, 0, 3.55, -0.35);
  const windshield = makeBox(6.2, 1.25, 0.5, mats.glass, 0, 2.45, -8.02);
  const sideStripe = makeBox(7.85, 0.48, 13.5, mats.gold, 0, 2.35, 0.5);
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
  car.radius = 7.2;
  car.nitro = 1;
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
  pickups.length = 0;
  ramps.length = 0;
  vehicles.length = 0;
  sparks.length = 0;
}

function isRoadCell(x, z) {
  return x % 3 === 0 || z % 3 === 0 || (x + z + seed) % 11 === 0;
}

function generateCity() {
  clearWorld();
  rng.reset(seed);
  roadMap = [];
  roadCells = [];
  towedVehicle = null;
  towLine.visible = false;
  busUnlocked = false;

  const block = 28;
  const cells = 25;
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
        const road = makeBox(block + 1, 0.12, block + 1, mats.road, x, 0.02, z);
        road.receiveShadow = true;
        world.add(road);
        if (gx % 3 === 0) world.add(makeBox(0.45, 0.14, block * 0.55, mats.lane, x, 0.1, z));
        if (gz % 3 === 0) world.add(makeBox(block * 0.55, 0.14, 0.45, mats.lane, x, 0.1, z));
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
        building.userData.radius = Math.max(w, d) * 0.75;
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
  for (let i = 0; i < 18; i++) {
    const cell = rng.pick(rampCells);
    const sideOffset = cell.rampAngle === 0 ? new THREE.Vector3(rng.range(-4, 4), 0, rng.range(-3, 3)) : new THREE.Vector3(rng.range(-3, 3), 0, rng.range(-4, 4));
    const angle = cell.rampAngle + (rng.next() > 0.5 ? 0 : Math.PI);
    makeRamp(cell.position.x + sideOffset.x, cell.position.z + sideOffset.z, angle);
  }

  for (let i = 0; i < 54; i++) {
    const p = rng.pick(roadMap);
    const pickup = new THREE.Mesh(selectedRole === "cop" ? new THREE.TorusGeometry(1.45, 0.92, 12, 22) : new THREE.TorusGeometry(2.2, 0.55, 9, 18), selectedRole === "cop" ? mats.donut : mats.loot);
    pickup.position.set(p.x + rng.range(-7, 7), 2.2, p.z + rng.range(-7, 7));
    pickup.rotation.x = Math.PI / 2;
    pickup.castShadow = true;
    pickup.userData.spin = rng.range(-2.5, 2.5);
    pickups.push(pickup);
    world.add(pickup);
  }

  player = makeCar(selectedRole, true);
  placeCar(player, roadMap[0] || new THREE.Vector3());
  player.group.position.set(0, 0, 0);
  if (selectedRole === "criminal" && totalScore >= unlocks.doubleDecker) {
    rebuildAsBus(player);
    busUnlocked = true;
  }

  const enemyRole = selectedRole === "cop" ? "criminal" : "cop";
  const cpuRoles = selectedRole === "cop" ? ["criminal", "cop", "cop", "cop"] : ["cop", "cop", "cop", "cop"];
  for (const role of cpuRoles) {
    const car = makeCar(role, false);
    placeCar(car, rng.pick(roadMap));
    snapToStreetHeading(car);
    car.group.rotation.y = car.angle;
  }

  for (let i = 0; i < 30; i++) {
    const car = makeCar("traffic", false);
    placeCar(car, rng.pick(roadMap));
    snapToStreetHeading(car);
    car.group.rotation.y = car.angle;
    car.speed = rng.range(14, 28);
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

function placeCar(car, point) {
  car.group.position.set(point.x, 0, point.z);
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
  const accel = car.isBus ? (forward ? 76 : back ? -48 : 0) : forward ? 86 : back ? -56 : 0;
  const baseMax = car.isBus ? 68 : 72;
  const boostedMax = car.isBus ? 98 : 108;
  const maxSpeed = boost && car.nitro > 0 ? boostedMax : baseMax;
  car.speed += accel * dt;
  car.speed *= Math.pow(0.88, dt * 5);
  car.speed = THREE.MathUtils.clamp(car.speed, car.isBus ? -28 : -34, maxSpeed);
  if (boost && Math.abs(car.speed) > 18 && car.nitro > 0) {
    car.nitro = Math.max(0, car.nitro - dt * 0.34);
    addSpark(car.group.position, selectedRole === "cop" ? 0x36e7d4 : 0xff3c38);
  } else {
    car.nitro = Math.min(1, car.nitro + dt * 0.12);
  }
  const turn = (left ? 1 : 0) - (right ? 1 : 0);
  car.angle += turn * dt * (car.isBus ? 1.65 : 2.55) * THREE.MathUtils.clamp(Math.abs(car.speed) / 30, 0.2, 1);
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
  car.angle += THREE.MathUtils.clamp(delta, -dt * 0.85, dt * 0.85);
  car.speed += (rng.range(16, 30) - car.speed) * dt * 0.35;
  applyStreetDiscipline(car, dt);
  moveCar(car, dt);
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

  if (Math.abs(car.group.position.x) > mapLimit || Math.abs(car.group.position.z) > mapLimit) {
    car.group.position.copy(previous);
    car.angle += Math.PI * 0.65;
    car.speed *= -0.35;
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
    const dx = car.group.position.x - obstacle.position.x;
    const dz = car.group.position.z - obstacle.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < radius + car.radius) {
      car.group.position.copy(previous);
      car.speed *= -0.42;
      car.angle += rng.range(-0.55, 0.55);
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
  car.nitro = 1;
}

function findCriminalTarget() {
  return vehicles.find((car) => car.role === "criminal");
}

function addScore(points) {
  score += points;
  totalScore += points;
  localStorage.setItem("neon-badge-runner-total", String(Math.floor(totalScore)));
  if (selectedRole === "criminal" && totalScore >= unlocks.doubleDecker && !busUnlocked && !player.isBus) {
    rebuildAsBus(player);
    busUnlocked = true;
    announce("Total score 1000 reached. Double decker bus unlocked and deployed.");
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
  const cableLength = player.isBus ? 24 : 19;
  if (dist > cableLength) {
    delta.normalize();
    const pull = dist - cableLength;
    towedVehicle.group.position.addScaledVector(delta, -pull * 0.65);
    towedVehicle.speed = Math.max(towedVehicle.speed, Math.min(Math.abs(player.speed) * 0.72, player.isBus ? 70 : 58));
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

function bounceVehicles(a, b) {
  const delta = a.group.position.clone().sub(b.group.position);
  if (delta.lengthSq() < 0.01) delta.set(rng.range(-1, 1), 0, rng.range(-1, 1));
  delta.y = 0;
  delta.normalize();
  a.group.position.addScaledVector(delta, 2.2);
  b.group.position.addScaledVector(delta, -2.2);
  const aSpeed = a.speed;
  a.speed = Math.max(-30, -Math.abs(b.speed) * 0.45);
  b.speed = Math.max(-30, -Math.abs(aSpeed) * 0.45);
  a.angle += rng.range(-0.28, 0.28);
  b.angle += rng.range(-0.28, 0.28);
  a.cooldown = Math.max(a.cooldown, 0.45);
  b.cooldown = Math.max(b.cooldown, 0.45);
  const hitPoint = a.group.position.clone().add(b.group.position).multiplyScalar(0.5);
  for (let i = 0; i < 5; i++) addSpark(hitPoint, 0xf9c74f);
  if (a === player || b === player) {
    shake(0.45);
    announce("Traffic jam! Civilian drivers have entered the chase equation.");
  }
}

function captureCar(captor, target) {
  const targetWasPlayer = target === player;
  const targetWasLocalP2 = target === player2;
  const capturePoint = target.group.position.clone();

  if (captor.role === "cop" && target.role === "criminal") {
    target.busted += 1;
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
      addScore(selectedRole === "cop" ? 25 : 50);
      heat = selectedRole === "cop" ? Math.max(0, heat - 1) : Math.min(99, heat + 4);
      world.remove(pickup);
      pickups.splice(pickups.indexOf(pickup), 1);
      announce(selectedRole === "cop" ? "Donut secured. Morale has entered the chat." : "Loot scooped. The city budget felt that.");
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
        captureCar(a, b);
      } else if (a.role === "criminal" && b.role === "cop") {
        captureCar(b, a);
      }
    }
  }

  for (const spark of [...sparks]) {
    spark.userData.life -= dt;
    spark.position.addScaledVector(spark.userData.vel, dt);
    spark.userData.vel.y -= 22 * dt;
    spark.material.opacity = Math.max(0, spark.userData.life);
    if (spark.userData.life <= 0) {
      sparks.splice(sparks.indexOf(spark), 1);
      world.remove(spark);
    }
  }
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
  ui.roleLabel.textContent = selectedRole === "cop" ? "Cop" : "Criminal";
  ui.score.textContent = String(Math.floor(score));
  ui.totalScore.textContent = String(Math.floor(totalScore));
  ui.heat.textContent = String(Math.floor(heat));
  const min = Math.floor(remaining / 60).toString().padStart(2, "0");
  const sec = Math.floor(remaining % 60).toString().padStart(2, "0");
  ui.time.textContent = `${min}:${sec}`;
  ui.nitro.style.width = `${Math.floor(player.nitro * 100)}%`;
  if (selectedRole === "cop") {
    const criminal = findCriminalTarget();
    if (criminal) {
      const dx = criminal.group.position.x - player.group.position.x;
      const dz = criminal.group.position.z - player.group.position.z;
      const distance = Math.hypot(dx, dz);
      const worldAngle = Math.atan2(dx, dz);
      const relative = THREE.MathUtils.euclideanModulo(worldAngle - player.angle + Math.PI, Math.PI * 2) - Math.PI;
      const direction = Math.abs(relative) < 0.45 ? "AHEAD" : relative > 0 ? "RIGHT" : "LEFT";
      ui.tracker.textContent = `${direction} ${Math.floor(distance)}m`;
    } else {
      ui.tracker.textContent = "CLEAR";
    }
  } else {
    ui.tracker.textContent = "--";
  }
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
  remaining = 180;
  paused = false;
  ui.gameOver.classList.add("hidden");
  generateCity();
  updateUi();
  announce(selectedRole === "cop" ? "APB tracker is live. Press E near an NPC to tow it." : totalScore >= unlocks.doubleDecker ? "Double decker unlocked from total score. Press E to tow NPCs." : "Bank 1000 total score to unlock the double decker bus. E fires the tow cable.");
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
    updateTowCable(dt);
    handleInteractions(dt);
    updateCamera(dt);
    updateUi();
    sendMultiplayer();
    if (radioTimer > 0) {
      radioTimer -= dt;
      if (radioTimer <= 0) ui.radio.textContent = selectedRole === "cop" ? "WASD or arrows. Shift boosts. E tow-cables NPCs. APB tracks the criminal." : "WASD or arrows. Shift boosts. E tow-cables NPCs. 1000 total unlocks the bus.";
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
