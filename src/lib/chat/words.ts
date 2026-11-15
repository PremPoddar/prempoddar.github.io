// Word lists for room codes and display names. All lowercase ASCII, 3 to 8 letters.

export const ADJECTIVES = [
  'amber', 'bold', 'calm', 'clever', 'crisp', 'dim', 'eager', 'faint', 'glad',
  'happy', 'ivory', 'jolly', 'keen', 'lively', 'mild', 'noble', 'quick', 'quiet',
  'rapid', 'sharp', 'swift', 'tidy', 'vivid', 'warm', 'zesty', 'agile', 'brisk',
  'sunny', 'misty', 'frosty', 'mellow', 'dusty', 'salty', 'windy', 'foggy',
  'rocky', 'sandy', 'silky', 'glossy', 'matte', 'rusty', 'golden', 'silver',
  'copper', 'jade', 'ruby', 'coral', 'olive', 'teal', 'navy', 'lime', 'plum',
  'rose', 'sage', 'mint', 'basil', 'cedar', 'maple', 'birch', 'aspen', 'rowan',
  'hazel', 'autumn', 'spring', 'summer', 'winter', 'early', 'late', 'first',
  'last', 'odd', 'even', 'tiny', 'huge', 'giant', 'minor', 'major', 'grand',
  'petite', 'long', 'short', 'wide', 'slim', 'dense', 'loose', 'tight', 'fresh',
  'stale', 'ripe', 'murky', 'hazy', 'clear', 'breezy', 'gentle', 'tender',
  'supple', 'sturdy', 'flimsy', 'ample', 'sleek',
];

export const ANIMALS = [
  'otter', 'fox', 'wolf', 'bear', 'deer', 'hare', 'mole', 'bat', 'rat', 'cat',
  'dog', 'pig', 'cow', 'hen', 'owl', 'crow', 'dove', 'duck', 'swan', 'goose',
  'hawk', 'falcon', 'eagle', 'robin', 'wren', 'finch', 'sparrow', 'raven',
  'heron', 'crane', 'stork', 'ibis', 'kiwi', 'emu', 'lynx', 'puma', 'tiger',
  'lion', 'zebra', 'horse', 'donkey', 'goat', 'sheep', 'llama', 'alpaca',
  'camel', 'rhino', 'hippo', 'bison', 'moose', 'elk', 'badger', 'beaver',
  'squirrel', 'rabbit', 'mouse', 'vole', 'shrew', 'hedgehog', 'skunk',
  'raccoon', 'panda', 'koala', 'kangaroo', 'wombat', 'platypus', 'sloth',
  'lemur', 'gibbon', 'macaque', 'baboon', 'gorilla', 'dolphin', 'whale',
  'shark', 'ray', 'eel', 'cod', 'tuna', 'trout', 'salmon', 'carp', 'pike',
  'perch', 'crab', 'lobster', 'shrimp', 'squid', 'octopus', 'nautilus',
  'gecko', 'iguana', 'viper', 'cobra', 'python', 'mamba', 'adder', 'toad',
  'newt', 'axolotl',
];

export const NOUNS = [
  'river', 'lake', 'ocean', 'island', 'valley', 'meadow', 'forest', 'desert',
  'canyon', 'cave', 'cliff', 'shore', 'beach', 'dune', 'reef', 'atoll',
  'marsh', 'swamp', 'glade', 'grove', 'orchard', 'garden', 'park', 'field',
  'farm', 'barn', 'mill', 'mine', 'well', 'brook', 'creek', 'stream', 'pond',
  'pool', 'bay', 'gulf', 'strait', 'harbor', 'pier', 'dock', 'port', 'wharf',
  'quay', 'tower', 'castle', 'fort', 'hall', 'manor', 'lodge', 'cabin', 'hut',
  'tent', 'camp', 'inn', 'pub', 'cafe', 'bakery', 'kitchen', 'pantry',
  'cellar', 'attic', 'roof', 'wall', 'gate', 'fence', 'path', 'lane', 'road',
  'track', 'trail', 'bridge', 'tunnel', 'stair', 'ramp', 'door', 'window',
  'bench', 'desk', 'table', 'chair', 'stool', 'sofa', 'cot', 'bunk', 'shelf',
  'crate', 'box', 'bin', 'sack', 'pouch', 'wallet', 'purse', 'coin', 'cash',
  'note', 'stamp', 'ticket', 'token', 'badge', 'banner', 'flag', 'sign',
  'post', 'pole', 'mast', 'sail', 'oar', 'raft', 'canoe', 'kayak', 'boat',
  'ship', 'ferry', 'barge', 'skiff', 'dinghy', 'wagon', 'cart', 'sled',
  'skate', 'ball', 'net', 'hoop', 'goal', 'club', 'board', 'dice', 'card',
  'chip', 'pawn', 'rook', 'knight', 'queen', 'ace', 'drum', 'bell', 'horn',
  'flute', 'harp', 'lute', 'lyre', 'piano', 'organ', 'choir', 'song', 'tune',
  'story', 'tale', 'myth', 'fable', 'poem', 'verse', 'prose', 'page', 'book',
  'leaf', 'root', 'stem', 'seed', 'bud', 'bloom', 'petal', 'thorn', 'vine',
  'moss', 'fern', 'pine', 'oak', 'elm', 'ash', 'yew', 'fir', 'palm', 'reed',
  'grass', 'wheat', 'corn', 'oats', 'barley', 'rye', 'hop', 'tea', 'honey',
  'jam', 'bread', 'toast', 'crumb', 'cake', 'pie', 'tart', 'scone', 'fudge',
  'toffee', 'butter', 'cream', 'milk', 'juice', 'cider', 'broth', 'soup',
  'stew', 'curry', 'rice', 'noodle', 'pasta', 'lemon', 'melon', 'peach',
  'pear', 'fig', 'berry', 'grape', 'apple', 'cherry', 'mango', 'guava',
];

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

export function roomCode(): string {
  return [pick(NOUNS), pick(NOUNS), pick(NOUNS)].join('-');
}

export function randomName(): string {
  return `${cap(pick(ADJECTIVES))} ${cap(pick(ANIMALS))}`;
}
