// Sunfall City — shared tuning: world size, the road grid, colours and balance numbers.
// Everything else reads its constants from here so the city's shape is described once.

export const WORLD = { width: 3200, height: 2400 };

// Centre lines of the vertical and horizontal avenues. Roads are ROAD_W wide.
export const ROADS_X = [260, 860, 1460, 2060, 2660];
export const ROADS_Y = [240, 820, 1400, 1980];
export const ROAD_W = 124;
export const LANE_OFF = 31;

// The shore: sand starts at SAND_Y, open water at WATER_Y, the pier reaches into it.
export const SAND_Y = 2160;
export const WATER_Y = 2296;
export const PIER = { x: 1408, w: 104, y0: 2150, y1: 2392 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 268,
  accel: 1500,
  maxHealth: 100,
  startCash: 40,
  start: { x: 500, y: 1895 },
};

export const GUN = {
  name: 'Pistol',
  damage: 34,
  fireInterval: 0.145,
  bulletSpeed: 940,
  range: 600,
  spread: 0.028,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 8,        // seconds unseen before heat cools
  decayRate: 0.075,     // heat per second while cooling
  sightRange: 470,      // police spot the player inside this, with line of sight
  bustRange: 118,       // on foot, this close to a stopped officer fills the bust meter
  bustFill: 2.4,        // seconds of exposure to be busted
};

export const HEAT = {
  stealDriven: 1.0,
  stealParked: 0.5,
  shotFired: 0.3,
  pedHit: 1.0,
  pedDown: 2.0,
  carRam: 0.6,
  policeHit: 2.0,
  policeDown: 3.0,
};

export const CAR_COLORS = [
  '#e74c3c', '#f39c12', '#f7dc6f', '#2ecc71', '#1abc9c', '#3498db',
  '#9b59b6', '#fd79a8', '#e67e22', '#ecf0f1', '#95a5a6', '#34495e',
  '#ff6b81', '#7ed6df', '#e77f67', '#f8a5c2', '#3dc1d3', '#786fa6',
];

export const BUILDING_COLORS = [
  '#f6d8b3', '#f2b8c6', '#bfe3dd', '#f9e79f', '#d6eaf8', '#fadbd8',
  '#fdebd0', '#d5f5e3', '#e8daef', '#fcf3cf', '#f5cba7', '#aed6f1',
];

export const PED_COLORS = [
  '#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#fd79a8', '#a29bfe',
  '#fdcb6e', '#e17055', '#00b894', '#e84393', '#6c5ce7', '#00cec9',
];

export const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a9746e'];
