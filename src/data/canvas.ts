// Where everything sits on the homepage desk, in desk units (24 units = 1 cm on the rulers).
// Apps and work use their content ids. To put a new app on the desk, add it to `items`.

export type Zone = { id: string; label: string; x: number; y: number; w: number; h: number };
export type Placement = { id: string; x: number; y: number; w: number; rotate?: number };
export type Note = { id: string; text: string; x: number; y: number; rotate: number; desktopOnly?: boolean };

export const zones: Zone[] = [
  { id: 'apps', label: 'Apps', x: 0, y: 30, w: 640, h: 830 },
  { id: 'toolbox', label: 'Toolbox', x: 1260, y: 30, w: 380, h: 490 },
  { id: 'writing', label: 'Writing', x: 1260, y: 560, w: 380, h: 420 },
  { id: 'more', label: 'More apps', x: 1680, y: 30, w: 500, h: 1040 },
  { id: 'work', label: 'Client work', x: 80, y: 1110, w: 1600, h: 420 },
  { id: 'about', label: 'About', x: 680, y: 790, w: 560, h: 300 },
];

// The whole desk. Panning stops at its edges and zooming out stops once all of it fits.
export const deskBounds = { x: 0, y: 0, w: 2200, h: 1600 };

// The part of the desk shown when the page opens, and after "Tidy up".
export const startBounds = { x: 0, y: 30, w: 1640, h: 840 };

export const items: Placement[] = [
  { id: 'name', x: 690, y: 100, w: 520 },
  { id: 'contact', x: 720, y: 540, w: 290, rotate: -1.5 },
  { id: 'caffeinatecat', x: 30, y: 90, w: 290, rotate: -1 },
  { id: 'oaf', x: 345, y: 90, w: 260, rotate: 1.2 },
  { id: 'loadstone', x: 350, y: 340, w: 250, rotate: -0.8 },
  { id: 'brewlight', x: 20, y: 470, w: 310, rotate: 0.8 },
  { id: 'duet', x: 1700, y: 90, w: 260, rotate: 1.2 },
  { id: 'toolbox-board', x: 1280, y: 90, w: 340 },
  { id: 'writing', x: 1300, y: 620, w: 300, rotate: 1 },
  { id: 'librechat', x: 1710, y: 590, w: 270, rotate: -1 },
  { id: 'campfire', x: 1720, y: 820, w: 260, rotate: -1.2 },
  { id: 'ecg-engine', x: 140, y: 1170, w: 340, rotate: -1 },
  { id: 'ejercicioysalud', x: 700, y: 1190, w: 340, rotate: 0.7 },
  { id: 'underwater-acoustics', x: 1260, y: 1160, w: 340, rotate: -0.5 },
  { id: 'about', x: 720, y: 830, w: 460, rotate: 0.4 },
];

export const notes: Note[] = [
  { id: 'note-offline', text: 'LibreChat, Loadstone and Campfire all work with no internet at all.', x: 1980, y: 600, rotate: 3 },
  { id: 'note-help', text: 'Drag to move around the desk. Pinch, or hold Ctrl and scroll, to zoom.', x: 1040, y: 570, rotate: -3, desktopOnly: true },
  { id: 'note-caffeinate', text: 'Flip the switch. It really does keep this screen awake.', x: 380, y: 720, rotate: 4 },
];

// Strings between related things. Links to anything not on the desk (like a draft post) are skipped.
export const links: [string, string][] = [
  ['librechat', 'campfire'],
  ['librechat', 'duet'],
  ['caffeinatecat', 'brewlight'],
  ['ecg-engine', 'ejercicioysalud'],
  ['name', 'contact'],
  ['caffeinatecat', 'caffeinatecat-lid-closed'],
  ['oaf', 'oaf-one-app-every-file'],
];
