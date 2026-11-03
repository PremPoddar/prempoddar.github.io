// Where everything sits on the homepage desk, in desk units (24 units = 1 cm on the rulers).
// Apps and work use their content ids. To put a new app on the desk, add it to `items`.

export type Zone = { id: string; label: string; x: number; y: number; w: number; h: number };
export type Placement = { id: string; x: number; y: number; w: number; rotate?: number };
export type Note = { id: string; text: string; x: number; y: number; rotate: number; desktopOnly?: boolean };

export const zones: Zone[] = [
  { id: 'apps', label: 'Phone apps', x: 0, y: 30, w: 640, h: 1020 },
  { id: 'toolbox', label: 'Toolbox', x: 1260, y: 30, w: 380, h: 490 },
  { id: 'writing', label: 'Writing', x: 1260, y: 560, w: 380, h: 420 },
  { id: 'mac', label: 'Mac apps', x: 1690, y: 30, w: 400, h: 950 },
  { id: 'work', label: 'Client work', x: 40, y: 1100, w: 1220, h: 460 },
  { id: 'about', label: 'About', x: 1300, y: 1100, w: 790, h: 460 },
];

// The part of the desk shown when the page opens, and after "Tidy up".
export const startBounds = { x: 0, y: 30, w: 1640, h: 900 };

export const items: Placement[] = [
  { id: 'name', x: 690, y: 100, w: 520 },
  { id: 'contact', x: 720, y: 500, w: 290, rotate: -1.5 },
  { id: 'librechat', x: 30, y: 90, w: 280, rotate: -1 },
  { id: 'duet', x: 340, y: 90, w: 260, rotate: 1.2 },
  { id: 'loadstone', x: 350, y: 500, w: 250, rotate: -0.8 },
  { id: 'oaf', x: 40, y: 470, w: 260, rotate: 0.8 },
  { id: 'campfire', x: 50, y: 780, w: 260, rotate: -1.2 },
  { id: 'toolbox-board', x: 1280, y: 90, w: 340 },
  { id: 'writing', x: 1300, y: 620, w: 300, rotate: 1 },
  { id: 'brewlight', x: 1710, y: 90, w: 350, rotate: 0.6 },
  { id: 'caffeinatecat', x: 1730, y: 520, w: 300, rotate: -1 },
  { id: 'ecg-engine', x: 80, y: 1170, w: 340, rotate: -1 },
  { id: 'ejercicioysalud', x: 470, y: 1190, w: 340, rotate: 0.7 },
  { id: 'underwater-acoustics', x: 860, y: 1160, w: 340, rotate: -0.5 },
  { id: 'about', x: 1340, y: 1160, w: 420, rotate: 0.4 },
];

export const notes: Note[] = [
  { id: 'note-offline', text: 'LibreChat, Loadstone and Campfire all work with no internet at all.', x: 360, y: 830, rotate: 3 },
  { id: 'note-help', text: 'Drag to move around the desk. Pinch, or hold Ctrl and scroll, to zoom.', x: 1040, y: 530, rotate: -3, desktopOnly: true },
  { id: 'note-caffeinate', text: 'Flip the switch. It really does keep this screen awake.', x: 1860, y: 810, rotate: 4 },
  { id: 'note-work', text: 'Two of these were for clients in Zaragoza, Spain.', x: 1010, y: 1420, rotate: -2 },
];

// Strings between related things. Links to anything not on the desk (like a draft post) are skipped.
export const links: [string, string][] = [
  ['librechat', 'campfire'],
  ['librechat', 'loadstone'],
  ['librechat', 'duet'],
  ['caffeinatecat', 'brewlight'],
  ['ecg-engine', 'ejercicioysalud'],
  ['name', 'contact'],
  ['caffeinatecat', 'caffeinatecat-lid-closed'],
  ['oaf', 'oaf-one-app-every-file'],
];
