// Gobble-Getaway — every tunable number, hazard recipe and colour in one place.
// The play field is a fixed 1280x720 logical area; the renderer scales it to
// the window, so nothing below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };
/** The line every ground thing stands on (feet of Mabel, base of obstacles). */
export const GROUND_Y = 606;
/** Fixed simulation step in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;
/** Pixels per metre, for the farmer's gap and the distance maths. */
export const PPM = 8;

/** Metres to run to slip out the farmhouse back window and be free. */
export const GOAL_M = 900;
export const LIVES = 3;

// The three stages, farmyard to kitchen. `run` is the base ground speed in
// metres per second (it ramps +25% across the whole run), `creep` how fast
// the farmer gains in m/s, `lungeEvery` the telegraphed lunge window in
// seconds, and `obstacles` what may spawn on this stage.
export const STAGES = [
  {
    name: 'THE FARMYARD', from: 0, to: 300, run: 18.0, creep: 1.1,
    lungeEvery: [7.5, 10.5], rest: [80, 2.2], obstacles: ['hay', 'fence', 'dog'],
  },
  {
    name: 'THE CORN MAZE', from: 300, to: 600, run: 21.0, creep: 1.7,
    lungeEvery: [6, 8.5], rest: [90, 2.4], obstacles: ['corn', 'scarecrow', 'pumpkin'],
  },
  {
    name: 'THE KITCHEN', from: 600, to: 900, run: 24.0, creep: 2.3,
    lungeEvery: [5, 7], rest: [100, 2.6], obstacles: ['oven', 'kniferoll'],
  },
];

// Mabel, the turkey.
export const MABEL = {
  xMin: 110, xMax: 1170,
  width: 52, height: 58, duckHeight: 32, airHeight: 50,
  walkSpeed: 330,
  jumpV: 880, flapV: 660, gravity: 2800,
  /** How long she blinks after a hit, in seconds. */
  invulnSeconds: 1.4,
  /** The stumble after a hit, in seconds: she is helpless while it runs. */
  stumbleSeconds: 0.55,
};

// Farmer Brindle, the chaser.
export const FARMER = {
  /** Metres behind Mabel when the run starts. */
  startGap: 46,
  maxGap: 150,
  lungeTelegraph: 0.7,
  lungeSeconds: 1.15,
  /** Extra metres per second he gains while lunging. */
  lungeCreep: 7.0,
  /** When the gap opens past rest[0] he stops to search for rest[1] seconds. */
  rest: [90, 2.4],
  /** Metres the gap widens when Mabel stumbles (the farmer whoops and slips). */
  mercyOnHit: 12,
};

// Hazards, by id. `kind` says how to dodge them: jump over, or duck under the
// bar. Sizes are forgiving hit boxes (a little smaller than the art).
export const HAZARD = {
  hay: { w: 44, h: 52, kind: 'jump', artW: 76 },
  fence: { w: 24, h: 82, kind: 'jump' },
  dog: { w: 48, h: 40, kind: 'jump', speed: 130 },
  corn: { w: 56, h: 104, kind: 'jump' },
  scarecrow: { w: 150, h: 18, barY: 46, kind: 'duck' },
  pumpkin: { w: 40, h: 48, kind: 'jump', fallFrom: 330, fallSeconds: 0.8, windowPx: 230 },
  oven: {
    w: 64, h: 64, kind: 'jump', artW: 100,
    flame: { len: 150, h: 26, idle: 1.3, warn: 0.45, active: 1.5 },
  },
  kniferoll: { w: 46, h: 30, kind: 'jump', speed: 175 },
};

// What is worth points.
export const SCORE = { meter: 1, corn: 25, nearMiss: 15, stageBonus: 100 };
/** Passing a hazard this close (in pixels) pays the near-miss bonus. */
export const NEAR_MISS_PX = 34;

// How far ahead of the camera hazards and corn spawn, and how far apart.
export const SPAWN = {
  lead: 1500,
  minGap: 300,
  extraGap: 240,
  cornArcEvery: [520, 1000],
  cornCount: [3, 5],
  cornGap: 48,
};

// The autumn Thanksgiving palette.
export const PALETTE = {
  // skies
  skyTop: '#ffe3ae', skyBottom: '#f5a44f',
  skyTopGold: '#ffd98f', skyBottomGold: '#e88f3c',
  // farmyard
  field: '#9db34f', fieldDark: '#86a03e',
  hill: '#b7c96a',
  barn: '#a8402f', barnRoof: '#5f3323', barnDoor: '#f0e0bd',
  silo: '#c8b89a', siloTop: '#8f5c38',
  fenceWood: '#8a5a34', fenceWoodDark: '#6f4527',
  pumpkin: '#e8842c', pumpkinDark: '#c05f14', pumpkinStem: '#5d7a2e',
  hay: '#e8c355', hayDark: '#c9a233',
  grassTuft: '#7d9c3f',
  leaf: ['#e8842c', '#d95f2b', '#c93f2f', '#e8b02c'],
  // corn maze
  cornGold: '#e8b02c', cornGoldDark: '#c98f1f', cornLeaf: '#9db34f',
  sun: '#fff2c2',
  scarecrowPole: '#8a5a34', scarecrowShirt: '#b5651d', scarecrowHead: '#f0e0bd',
  // kitchen
  wall: '#a05a35', wallDark: '#8a4a2a', wainscot: '#6f381f',
  floorA: '#e8c890', floorB: '#b5763f',
  windowSky: '#f2a65a',
  ovenBody: '#8d949c', ovenDark: '#5d646c', ovenGlow: '#ff9d3c',
  flame: '#ffd24c', flameCore: '#ff7b2c',
  steel: '#c9d1d9', steelDark: '#8d949c',
  // the characters
  turkeyBody: '#a4623c', turkeyBodyDark: '#8a4e2e', turkeyWing: '#7d4527',
  turkeyNeck: '#c98a6a', turkeyHead: '#b5543c', turkeyComb: '#e5534b',
  turkeyWattle: '#e5534b', turkeyBeak: '#e8b02c',
  turkeyTail: ['#f5efe4', '#e8dcc8', '#d9c9ae'],
  farmerShirt: '#c94030', farmerOveralls: '#4a6b3a', farmerHat: '#e8c355',
  farmerHatBand: '#a8402f', farmerSkin: '#f2c79b', farmerHair: '#8a5a34',
  farmerPan: '#5d646c', farmerPanHandle: '#3d3128',
  // ui
  panel: 'rgba(34, 21, 12, 0.82)',
  panelEdge: 'rgba(255, 226, 178, 0.5)',
  text: '#fff3dd',
  textWarm: '#ffd98f',
  textGold: '#ffd24c',
  textRed: '#ff6b4a',
  textGreen: '#9ddb6a',
  drumstick: '#e8842c',
  drumstickBone: '#fff3dd',
  heartLost: 'rgba(255, 243, 221, 0.28)',
  bar: '#fff3dd',
  barFill: '#ffd24c',
  barLow: '#ff6b4a',
  white: '#fff3dd',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-getaway.best';

/** Game name, for the title sign and the page. */
export const TITLE = "Mabel's Gobble-Getaway";
export const SUBTITLE = 'A Thanksgiving escape in three stages';
