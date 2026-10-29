// The LARPED ONE OUT house band: original songs written for this game, released as CC0.
// They power Finish the Lyrics (rhyme-guessable, no prior knowledge needed), Name That Genre,
// and Guess the Album Cover (each cover's pixel motif matches its album title).

import type { Song } from '../../shared/content';

const ORIGINAL = { composition: 'ORIGINAL-CC0' as const, recording: 'ORIGINAL-CC0' as const, basis: 'Written for LARPED ONE OUT, dedicated to the public domain' };

const LILY = 'B4:0.5 A4 G4 A4 B4 B4 B4:1 | A4:0.5 A4:1 B4:0.5 A4 G4 E4:1 | D4:0.5 E4 G4 G4 A4 B4 A4:1 | G4:0.5 A4 G4 D4 G4:2 | E5:1 D5 C5:0.5 B4 A4 B4 | C5 B4 A4 G4 A4:2 | B4:0.5 B4 A4 G4 E4 G4 A4 B4 | A4 G4 A4 B4 A4 G4:1.5';
const CROAK = 'E4:0.5 E4 G4 E4 A4:1 G4:0.5 E4 | G4:0.5 A4 B4:1 A4:0.5 G4:1.5 | E4:0.5 E4 G4 G4 A4 B4 B4 A4 | G4 F#4 G4 A4 B4:2 | B4:1 B4:0.5 A4 B4:1 D5 | D5:0.5 D5 E5 D5 B4:2 | B4:1 B4:0.5 A4 B4:1 D5 | E5:0.5 D5 B4 A4 B4 G4 E4:1';
const FLY = 'E4:0.5 G4 G4 A4 G4 E4 D4 E4 | G4:1 G4:0.5 A4 B4 G4:1.5 | E4:0.5 G4 G4 A4 C5 A4 G4 E4 | D4 E4 F4 E4 D4:2 | C5:0.5 C5:1 A4:0.5 C5:1 D5:0.5 C5 | B4:0.5 C5 D5 C5 D5:2 | C5:1.5 A4:0.5 C5:1 D5:0.5 C5 | B4:0.5 C5 D5 E5 D5 C5 C5:1';
const BOSS = 'A3:1 F4:0.5 F4 F4 D4:1 r:0.5 | F4:0.5 F4 E4 D4 F4 D4:1 r:0.5 | F4:0.25 F4 F4:0.5 F4 G4 F4 D4 F4 F4 | F4:0.5 G4 A4:1 D4:1 r:1 | D4:0.5 D4 F4 F4 F4 G4:1 F4:0.5 | F4:0.5 G4 F4 D4 A3:2 | D4:0.5 D4 F4:1 F4:0.5 G4:1 F4:0.5 | F4:0.5 G4 A4 D4:2.5';
const NEON = 'A4:0.5 A4 C5 A4 E5 D5 C5:1 | C5:0.5 C5 D5 C5 A4 G4:1.5 | A4:0.25 A4 C5:0.5 C5 C5 D5 E5 D5 C5 | D5:0.5 E5 D5 C5 B4 G4:1.5 | E5:1 D5:0.5 C5 E5:2 | D5:0.5 C5 D5 C5 D5 E5 E5:1 | E5:1 D5:0.5 C5 E5:2 | D5:0.5 C5 D5 C5 B4 C5 A4:1';
const TADPOLE = 'F#4:0.5 F#4 A4 A4 A4 B4 A4 F#4 | E4 F#4 E4 D4 E4:2 | F#4:0.5 F#4 A4 A4 B4:1 A4 | A4:0.5 A4 B4 C#5 D5:2 | D5:0.5 D5 D5 C#5 B4 A4:1.5 | A4:0.5 B4 A4 F#4 E4 D4:1.5 | D5:0.5 D5 D5 C#5 B4 A4:1.5 | A4:0.5 B4 C#5 D5 E5 D5:1.5';
const RIBBIT = 'C5:0.5 G4 C5 G4 Eb5 C5 Eb5 C5 | F5:1 G5:1 r:2 | Eb5:0.5 Eb5 F5 G5:1 F5:0.5 r:1 | G5:0.5 r G5 r C6:2 | C5:1 Eb5 G5 F5:0.5 Eb5 | D5:1 r:0.5 D5:0.5 Eb5:2 | C5:0.5 C5 Eb5 Eb5 G5 G5 Bb5:1 | Bb5:0.5 Ab5 G5:1 C6:2';
const RISE = 'C#5:0.5 C#5 B4 C#5 E5 F#5:1 E5:0.5 | E5:0.5 F#5 E5 C#5 B4 A4:1.5 | A4:1 B4:0.5 C#5 D5 E5 F#5 E5 | D5:0.5 C#5 B4 C#5 D5 E5 E5:1 | A5:1.5 E5:0.5 F#5 E5 C#5 E5 | E5:0.5 F#5 G#5 A5 G#5 F#5 E5:1 | A5:1.5 E5:0.5 F#5 E5 C#5 E5 | E5:0.5 F#5 E5 D5 C#5 B4 A4:1';
const POND = 'C5:1.5 G4:0.5 C5:1 E5 | F5:1.5 E5:0.5 D5:1 C5 | E5:1.5 D5:0.5 C5:1 A4 | G4:2 B4:1 D5 | C5:1.5 G4:0.5 C5:1 E5 | A5:1.5 G5:0.5 F5:1 A5 | G5:1.5 F5:0.5 E5:1 D5 | C5:4';
const STREET = 'C5:0.5 C5 A4 C5 D5 C5 A4 F4 | G4 A4 Bb4 A4 G4:2 | D5:0.5 D5 C5 A4 C5 F5:1 A4:0.5 | Bb4:0.5 A4 G4 A4 G4 F4:1.5 | F5:1 D5:1 C5:0.5 D5 F5:1 | E5:1 D5:1 C5:2 | F5:1 D5:1 C5:0.5 D5 F5 F5 | G5:1 E5:1 F5:2';
const CROON = 'A4:1 C5:0.5 D5 F5:1 E5 | D5:2 B4:1 G4 | E5:1.5 D5:0.5 C5:1 B4 | A4:3 r:1 | A4:1 C5:0.5 D5 F5:1 A5 | G5:2 E5:1 C5 | D5:1.5 C5:0.5 B4:1 G4 | C5:4';
const DISCO = 'E5:0.5 E5 D5 C5 D5 E5 A4:1 | C5:0.5 D5 C5 D5 E5 G5:1.5 | E5:0.5 D5 C5 C5 D5 E5 E5:1 | D5:0.5 D5 E5 F5 E5 D5 B4:1 | A5:1 G5:0.5 E5 G5 E5:1.5 | D5:0.5 E5 G5 E5 D5:2 | A5:1 G5:0.5 E5 G5 E5:1.5 | D5:0.5 E5 D5 C5 B4 C5 A4:1';
const BLUES = 'G4:0.5 E4 G4:1 A4 G4 | E4:0.5 G4 A4:1 Bb4:0.5 A4 G4:1 | r:8 | G4:0.5 E4 G4:1 A4 G4 | E4:0.5 G4 A4:1 Bb4:0.5 A4 G4:1 | r:8 | B4:0.5 B4 A4 B4 A4 G4:1 E4:0.5 | G4:0.5 G4 A4 G4 E4 E4:1.5 | r:8';
const BLUES_FILL = 'E5:0.5 D5 B4 A4 G4 E4 G4:1 | E4:4';

const ROCK_BEAT = 'k+h:0.5 h s+h h k+h k+h s+h h';
const POP_BEAT = 'k+h:0.5 h k+c+h h k+h h k+c+h h';
const PUNK_BEAT = 'k+h:0.5 s+h k+h s+h k+h s+h k+h s+h';
const DISCO_BEAT = 'k:0.5 o k+c o k o k+c o';

export const HOUSE_BAND_SONGS: Song[] = [
  {
    id: 'hb_lily_pad_lullaby',
    title: 'Lily Pad Lullaby',
    artist: 'The Pondering Tadpoles',
    album: 'Moon Over the Lily Pads',
    genre: 'Indie Folk',
    categories: ['house_band', 'indie'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'lilypad_moon', bg: '#1d2b4f', fg: '#7cc46a', accent: '#fff1b0' },
    fact: 'The Pondering Tadpoles recorded it in one take, floating on an actual lily pad.',
    lyrics: [
      { beat: 8, text: 'Floating on a lily pad, the moon is in the sky' },
      { beat: 16, text: 'Every little firefly is blinking me goodbye' },
      { beat: 24, text: 'Hush now, little tadpole, close your sleepy eyes' },
      { beat: 32, text: 'The pond will rock you gently till the morning sun will rise' },
    ],
    gaps: [
      { line: 1, answer: 'goodbye', decoys: ['hello', 'good night', 'so long'], cut: 21.5 },
      { line: 3, answer: 'sun will rise', decoys: ['sun will shine', 'flies will fly', 'dew is dry'], cut: 37.5 },
    ],
    hook: [8, 24],
    score: {
      bpm: 92,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${LILY}` },
        { inst: 'flute', vol: 0.6, notes: `r:40 ${LILY}` },
        { inst: 'pluck', vol: 0.45, chords: 'G:4 C:4 (G:4 Em:4 C:4 G:4 C:4 G:2 D:2 Em:2 C:2 D:2 G:2)x2', style: 'arp8', oct: 3 },
        { inst: 'bass', vol: 0.45, chords: 'G:4 C:4 (G:4 Em:4 C:4 G:4 C:4 G:2 D:2 Em:2 C:2 D:2 G:2)x2', style: 'bass' },
        { inst: 'drums', vol: 0.3, notes: 'r:8 (k:1 h:0.5 h s:1? h:0.5 h)x16' },
      ],
    },
  },
  {
    id: 'hb_croak_like_you_mean_it',
    title: 'Croak Like You Mean It',
    artist: 'Mudslide Maniacs',
    album: 'Thunder Bog',
    genre: 'Rock',
    categories: ['house_band', 'rock'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'lightning_guitar', bg: '#2b0f0f', fg: '#e2483d', accent: '#ffe245' },
    fact: 'The Mudslide Maniacs once played so loud a heron dropped its lunch.',
    lyrics: [
      { beat: 8, text: 'Woke up in the mud with a thunder in my throat' },
      { beat: 16, text: 'Grabbed my little guitar and I hopped into my boat' },
      { beat: 24, text: 'Croak like you mean it, let the whole swamp shake' },
      { beat: 32, text: 'Croak like you mean it, every frog is wide awake' },
    ],
    gaps: [
      { line: 1, answer: 'into my boat', decoys: ['onto a goat', 'into my coat', 'over the moat'], cut: 20.5 },
      { line: 3, answer: 'wide awake', decoys: ['on the lake', 'eating cake', 'half a snake'], cut: 38 },
    ],
    hook: [24, 40],
    score: {
      bpm: 140,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${CROAK}` },
        { inst: 'saw', vol: 0.5, notes: `r:40 ${CROAK} E4:4`, transpose: 12 },
        { inst: 'dist', vol: 0.5, notes: 'E3:0.5 E3 G3 E3 A3 E3 G3 F#3 | E3 E3 G3 E3 B3:1 A3:1' },
        { inst: 'dist', vol: 0.45, chords: 'r:8 (Em:4 C:2 D:2 Em:4 D:2 B:2 C:4 G:2 D:2 C:4 D:2 Em:2)x2 Em:4', style: 'rock', oct: 3 },
        { inst: 'bass', vol: 0.55, chords: 'Em:8 (Em:4 C:2 D:2 Em:4 D:2 B:2 C:4 G:2 D:2 C:4 D:2 Em:2)x2 Em:4', style: 'bass8' },
        { inst: 'drums', vol: 0.55, notes: `(${ROCK_BEAT})x18 x+k:4` },
      ],
    },
  },
  {
    id: 'hb_fly_season',
    title: 'Fly Season',
    artist: 'Kiki Ribbit',
    album: 'Sticky Tongue Summer',
    genre: 'Pop',
    categories: ['house_band', 'pop', '2020s'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'sun_flies', bg: '#ffd04c', fg: '#ff6fb5', accent: '#2b2b38' },
    fact: 'Kiki Ribbit wrote Fly Season in 15 minutes and spent the rest of the day catching flies.',
    lyrics: [
      { beat: 8, text: 'Sunshine on the water and the flies are buzzing by' },
      { beat: 16, text: 'Got my tongue all ready, gonna catch one on the fly' },
      { beat: 24, text: 'It\'s fly season, baby, every day\'s a treat' },
      { beat: 32, text: 'Fly season, baby, got the swamp beneath my feet' },
    ],
    gaps: [
      { line: 1, answer: 'on the fly', decoys: ['in the sky', 'with a pie', 'by and by'], cut: 21 },
      { line: 3, answer: 'beneath my feet', decoys: ['upon my seat', 'out on the street', 'inside my sheet'], cut: 37.5 },
    ],
    hook: [24, 40],
    score: {
      bpm: 118,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${FLY}` },
        { inst: 'lead', vol: 0.45, notes: `r:40 ${FLY}` },
        { inst: 'epiano', vol: 0.45, chords: 'C:4 G:4 (C:4 G:4 Am:4 F:2 G:2 F:4 G:4 Am:4 G:2 C:2)x2', style: 'pop', oct: 4 },
        { inst: 'synthbass', vol: 0.55, chords: 'C:4 G:4 (C:4 G:4 Am:4 F:2 G:2 F:4 G:4 Am:4 G:2 C:2)x2', style: 'bass8' },
        { inst: 'drums', vol: 0.5, notes: `(${POP_BEAT})x18` },
      ],
    },
  },
  {
    id: 'hb_bog_boss',
    title: 'Bog Boss',
    artist: 'MC Hopscotch',
    album: 'Lily Pad Royalty',
    genre: 'Rap',
    categories: ['house_band', 'rap'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'crown_log', bg: '#1c1c22', fg: '#ffc531', accent: '#6fe05a' },
    fact: 'MC Hopscotch insists the log is real estate.',
    lyrics: [
      { beat: 8, text: 'Yo, I\'m the bog boss, sittin\' on a log, boss' },
      { beat: 16, text: 'Every single cricket knows I\'m number one frog, boss' },
      { beat: 24, text: 'Got a lily pad crib with a view of the moon' },
      { beat: 32, text: 'And I eat my flies with a silver spoon' },
    ],
    gaps: [
      { line: 1, answer: 'number one frog', decoys: ['number one hog', 'a big ol\' dog', 'lost in the fog'], cut: 19.5 },
      { line: 3, answer: 'silver spoon', decoys: ['wooden broom', 'big balloon', 'rusty tune'], cut: 36.5 },
    ],
    hook: [8, 24],
    score: {
      bpm: 90,
      swing: 0.15,
      parts: [
        { inst: 'voice', vol: 0.75, notes: `r:8 ${BOSS}` },
        { inst: 'epiano', vol: 0.4, chords: 'Dm:4 A:4 (Dm:4 Dm:4 Bb:4 A:4)x4', style: 'stabs', oct: 4 },
        { inst: 'synthbass', vol: 0.6, chords: 'Dm:4 A:4 (Dm:4 Dm:4 Bb:4 A:4)x4', style: 'bass' },
        { inst: 'drums', vol: 0.6, notes: '(k+h:0.5 h s+h h h k+h s+h h)x18' },
      ],
    },
  },
  {
    id: 'hb_neon_swamp',
    title: 'Neon Swamp Nights',
    artist: 'The Damp Decibels',
    album: 'Neon Swamp',
    genre: 'Synthwave',
    categories: ['house_band', 'alternative'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'neon_grid', bg: '#14062b', fg: '#ff2fa0', accent: '#4dffea' },
    fact: 'The Damp Decibels only perform after midnight, wearing sunglasses.',
    lyrics: [
      { beat: 16, text: 'Driving through the neon swamp at a quarter to three' },
      { beat: 24, text: 'All the dragonflies are glowing and they\'re glowing just for me' },
      { beat: 32, text: 'Neon swamp nights, nothing ever feels so right' },
      { beat: 40, text: 'Neon swamp nights, we\'ll be croaking through the night' },
    ],
    gaps: [
      { line: 1, answer: 'just for me', decoys: ['in the sea', 'up a tree', 'all for free'], cut: 29.5 },
      { line: 3, answer: 'through the night', decoys: ['out of sight', 'with delight', 'in a fight'], cut: 46 },
    ],
    hook: [32, 48],
    score: {
      bpm: 108,
      parts: [
        { inst: 'voice', vol: 0.65, notes: `r:16 ${NEON}` },
        { inst: 'saw', vol: 0.45, notes: `r:48 ${NEON}` },
        { inst: 'saw', vol: 0.3, chords: '(Am:4 F:4 C:4 G:4)x1 (Am:4 F:4 C:4 G:4 F:4 G:4 Am:4 G:2 Am:2)x2', style: 'arp8', oct: 4 },
        { inst: 'pad', vol: 0.35, chords: '(Am:4 F:4 C:4 G:4)x1 (Am:4 F:4 C:4 G:4 F:4 G:4 Am:4 G:2 Am:2)x2', style: 'sustain', oct: 3 },
        { inst: 'synthbass', vol: 0.55, chords: '(Am:4 F:4 C:4 G:4)x1 (Am:4 F:4 C:4 G:4 F:4 G:4 Am:4 G:2 Am:2)x2', style: 'bass8' },
        { inst: 'drums', vol: 0.5, notes: `r:8 (${ROCK_BEAT})x18` },
      ],
    },
  },
  {
    id: 'hb_tadpole_days',
    title: 'Tadpole Days',
    artist: 'Ribbit Riot',
    album: 'Skate Pond',
    genre: 'Pop Punk',
    categories: ['house_band', 'rock', '2000s'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'skateboard', bg: '#4aa3ff', fg: '#f4f4f4', accent: '#ff5d5d' },
    fact: 'Ribbit Riot\'s drummer has never once used a hi-hat quietly.',
    lyrics: [
      { beat: 8, text: 'Skipping class to skate around the pond behind the school' },
      { beat: 16, text: 'Mom said I\'m a tadpole but I\'m way too cool' },
      { beat: 24, text: 'These are our tadpole days, we\'re never growing up' },
      { beat: 32, text: 'These are our tadpole days, so raise your lily cup' },
    ],
    gaps: [
      { line: 1, answer: 'way too cool', decoys: ['in a pool', 'such a fool', 'breaking rules'], cut: 21 },
      { line: 3, answer: 'lily cup', decoys: ['paper cup', 'buttercup', 'hand right up'], cut: 37.5 },
    ],
    hook: [24, 40],
    score: {
      bpm: 165,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${TADPOLE}` },
        { inst: 'dist', vol: 0.4, notes: `r:40 ${TADPOLE}`, transpose: 12 },
        { inst: 'dist', vol: 0.45, chords: 'D:4 A:4 (D:4 A:4 Bm:4 G:2 A:2 G:4 D:2 A:2 G:4 A:2 D:2)x2', style: 'rock', oct: 3 },
        { inst: 'bass', vol: 0.55, chords: 'D:4 A:4 (D:4 A:4 Bm:4 G:2 A:2 G:4 D:2 A:2 G:4 A:2 D:2)x2', style: 'bass8' },
        { inst: 'drums', vol: 0.55, notes: `(${PUNK_BEAT})x18` },
      ],
    },
  },
  {
    id: 'hb_ribbit_remix',
    title: 'Ribbit Remix 3000',
    artist: 'DJ Lilypadd',
    album: 'Insert Coin',
    genre: 'Chiptune',
    categories: ['house_band', 'meme', 'games'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'gamepad', bg: '#0f2b1c', fg: '#6fe05a', accent: '#ff2fa0' },
    fact: 'Your host, DJ Lilypadd, made this on a calculator. Allegedly.',
    lyrics: [
      { beat: 8, text: 'Ribbit, ribbit, ribbit, ribbit, press start!' },
      { beat: 16, text: 'Insert a coin and hop, hop, hop!' },
      { beat: 24, text: 'High score frog, can\'t stop, won\'t stop' },
      { beat: 32, text: 'Ribbit remix three thousand, drop the beat... DROP!' },
    ],
    gaps: [
      { line: 1, answer: 'hop, hop, hop', decoys: ['stop, stop, stop', 'pop, pop, pop', 'mop, mop, mop'], cut: 20 },
      { line: 2, answer: 'won\'t stop', decoys: ['can\'t drop', 'will flop', 'gotta shop'], cut: 29.5 },
    ],
    hook: [8, 24],
    score: {
      bpm: 150,
      parts: [
        { inst: 'chip', vol: 0.6, notes: `r:8 ${RIBBIT} ${RIBBIT}` },
        { inst: 'chip', vol: 0.3, chords: 'Cm:4 Bb:4 (Cm:4 Ab:2 Bb:2 Ab:4 Bb:4 Cm:4 Ab:2 Bb:2 Ab:4 Bb:2 Cm:2)x2', style: 'arp8', oct: 4 },
        { inst: 'synthbass', vol: 0.55, chords: 'Cm:4 Bb:4 (Cm:4 Ab:2 Bb:2 Ab:4 Bb:4 Cm:4 Ab:2 Bb:2 Ab:4 Bb:2 Cm:2)x2', style: 'octave' },
        { inst: 'drums', vol: 0.5, notes: '(k:0.5 h s h k k s h)x18' },
      ],
    },
  },
  {
    id: 'hb_rise_amphibian_heart',
    title: 'Rise, Amphibian Heart!',
    artist: 'Kero Kero Rangers',
    album: 'Sakura Leap',
    genre: 'Anime Opening',
    categories: ['house_band', 'anime_op'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'sakura_frog', bg: '#ff9ec9', fg: '#e8383d', accent: '#ffffff' },
    fact: 'The Kero Kero Rangers do their own stunts. Mostly falling into ponds.',
    lyrics: [
      { beat: 8, text: 'Under the falling rain, I hear a thunder calling' },
      { beat: 16, text: 'Leap into tomorrow, even if the sky is falling' },
      { beat: 24, text: 'Rise! Amphibian heart, burning brighter than the sun' },
      { beat: 32, text: 'Rise! Amphibian heart, our adventure\'s just begun' },
    ],
    gaps: [
      { line: 1, answer: 'sky is falling', decoys: ['sky is calling', 'frogs are crawling', 'rain is stalling'], cut: 21.5 },
      { line: 3, answer: 'just begun', decoys: ['almost done', 'number one', 'on the run'], cut: 38 },
    ],
    hook: [24, 40],
    score: {
      bpm: 172,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${RISE}` },
        { inst: 'lead', vol: 0.45, notes: `r:40 ${RISE}` },
        { inst: 'dist', vol: 0.4, chords: 'D:4 E:4 (F#m:4 D:2 E:2 D:4 E:4 D:4 E:4 C#m:2 F#m:2 D:1 E:1 A:2)x2', style: 'rock', oct: 3 },
        { inst: 'strings', vol: 0.35, chords: 'D:4 E:4 (F#m:4 D:2 E:2 D:4 E:4 D:4 E:4 C#m:2 F#m:2 D:1 E:1 A:2)x2', style: 'sustain', oct: 4 },
        { inst: 'bass', vol: 0.55, chords: 'D:4 E:4 (F#m:4 D:2 E:2 D:4 E:4 D:4 E:4 C#m:2 F#m:2 D:1 E:1 A:2)x2', style: 'bass8' },
        { inst: 'drums', vol: 0.55, notes: '(k+h:0.5 h s+h h k+h k+h s+h k+s)x18' },
      ],
    },
  },
  {
    id: 'hb_great_pond_adventure',
    title: 'The Great Pond Adventure',
    artist: 'Swamp Symphony Orchestra',
    album: 'Mountain Pond Saga',
    genre: 'Movie Score',
    categories: ['house_band', 'movie_ost'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'mountain_pond', bg: '#2f5f3a', fg: '#c9a2ff', accent: '#ffe245' },
    fact: 'The Swamp Symphony Orchestra has 40 members, 38 of whom are frogs.',
    hook: [8, 40],
    score: {
      bpm: 100,
      parts: [
        { inst: 'brass', vol: 0.75, notes: `r:8 ${POND}` },
        { inst: 'strings', vol: 0.6, notes: `r:40 ${POND}` },
        { inst: 'strings', vol: 0.4, chords: 'C:4 G:4 (C:4 F:4 Am:4 G:4 C:4 F:4 G:4 C:4)x2', style: 'sustain', oct: 3 },
        { inst: 'bass', vol: 0.5, chords: 'C:4 G:4 (C:4 F:4 Am:4 G:4 C:4 F:4 G:4 C:4)x2', style: 'bass' },
        { inst: 'timpani', vol: 0.6, notes: '(G1:0.25)x28 C2:1 ((C2:1 r:3)x7 C2:0.25 C2 C2 C2 C2:3)x2' },
      ],
    },
  },
  {
    id: 'hb_swamp_street',
    title: 'Welcome to Swamp Street',
    artist: 'The Lily Pads',
    album: 'Swamp Street Sitcoms',
    genre: 'TV Sitcom Theme',
    categories: ['house_band', 'tv_themes'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'street_sign', bg: '#5ad1c8', fg: '#ffffff', accent: '#f25a5a' },
    fact: 'Swamp Street ran for 11 seasons. Nobody ever found out what was in the mysterious puddle.',
    lyrics: [
      { beat: 8, text: 'When your day is soggy and your hat is in the stream' },
      { beat: 16, text: 'Come on down to Swamp Street, where the neighbors are a dream' },
      { beat: 24, text: 'Swamp Street, every frog knows your name' },
      { beat: 32, text: 'Swamp Street, life is never quite the same' },
    ],
    gaps: [
      { line: 1, answer: 'are a dream', decoys: ['sell ice cream', 'lose their steam', 'start to scream'], cut: 21.5 },
      { line: 3, answer: 'quite the same', decoys: ['worth the fame', 'quite so tame', 'much to blame'], cut: 36 },
    ],
    hook: [24, 40],
    score: {
      bpm: 128,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${STREET}` },
        { inst: 'whistle', vol: 0.55, notes: `r:40 ${STREET}` },
        { inst: 'epiano', vol: 0.4, chords: 'F:4 C:4 (F:4 Bb:2 C:2 Dm:4 Gm:2 C:2 Bb:4 C:4 Bb:4 C:2 F:2)x2', style: 'pop', oct: 4 },
        { inst: 'brass', vol: 0.35, chords: 'F:4 C:4 (F:4 Bb:2 C:2 Dm:4 Gm:2 C:2 Bb:4 C:4 Bb:4 C:2 F:2)x2', style: 'stabs', oct: 4 },
        { inst: 'bass', vol: 0.55, chords: 'F:4 C:4 (F:4 Bb:2 C:2 Dm:4 Gm:2 C:2 Bb:4 C:4 Bb:4 C:2 F:2)x2', style: 'walking' },
        { inst: 'drums', vol: 0.45, notes: '(k+h:0.5 h s+h h k+h h s+h h)x18' },
      ],
    },
  },
  {
    id: 'hb_moonlit_croon',
    title: 'Moonlit Croon',
    artist: 'Lo-Fi Lilypadd',
    album: 'Moonlight Window Tapes',
    genre: 'Lo-Fi Hip Hop',
    categories: ['house_band', 'indie', '2020s'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'moon_window', bg: '#1c2450', fg: '#b8c6ff', accent: '#ffb13b' },
    fact: 'Beats to catch flies to. Recorded on a rainy night with the window open.',
    hook: [16, 48],
    score: {
      bpm: 78,
      swing: 0.2,
      parts: [
        { inst: 'epiano', vol: 0.5, chords: '(Dm7:4 G7:4 Cmaj7:4 Am7:4)x3', style: 'lofi', oct: 4 },
        { inst: 'epiano', vol: 0.6, notes: `r:16 ${CROON}` },
        { inst: 'bass', vol: 0.5, chords: '(Dm7:4 G7:4 Cmaj7:4 Am7:4)x3', style: 'oompah', oct: 2 },
        { inst: 'drums', vol: 0.45, notes: '(k:1 h:0.5 h:0.5? s:1 h:0.5 k:0.5)x12' },
      ],
    },
  },
  {
    id: 'hb_disco_dragonfly',
    title: 'Disco Dragonfly',
    artist: 'The Funky Flies',
    album: 'Mirror Ball Marsh',
    genre: 'Disco',
    categories: ['house_band', 'pop', 'throwback'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'disco_ball', bg: '#3b0f5a', fg: '#e8e8f0', accent: '#ff6fd8' },
    fact: 'The Funky Flies\' platform shoes are technically lily pads.',
    lyrics: [
      { beat: 8, text: 'Spinning on the lily pad under the mirror ball' },
      { beat: 16, text: 'Dragonfly, you shine so bright, you\'re the brightest bug of all' },
      { beat: 24, text: 'Disco dragonfly, take me to the sky' },
      { beat: 32, text: 'Disco dragonfly, don\'t you ever say goodbye' },
    ],
    gaps: [
      { line: 1, answer: 'brightest bug of all', decoys: ['tallest bug of all', 'smallest frog of all', 'loudest bird of all'], cut: 21 },
      { line: 3, answer: 'say goodbye', decoys: ['wonder why', 'eat a pie', 'touch the sky'], cut: 38 },
    ],
    hook: [24, 40],
    score: {
      bpm: 120,
      parts: [
        { inst: 'voice', vol: 0.7, notes: `r:8 ${DISCO}` },
        { inst: 'strings', vol: 0.5, notes: `r:40 ${DISCO}` },
        { inst: 'strings', vol: 0.35, chords: 'Am:8 (Am:4 Dm:2 G:2 C:2 F:2 Dm:2 E:2 F:4 G:4 F:4 E:2 Am:2)x2', style: 'stabs', oct: 4 },
        { inst: 'synthbass', vol: 0.55, chords: 'Am:8 (Am:4 Dm:2 G:2 C:2 F:2 Dm:2 E:2 F:4 G:4 F:4 E:2 Am:2)x2', style: 'octave' },
        { inst: 'drums', vol: 0.5, notes: `(${DISCO_BEAT})x18` },
      ],
    },
  },
  {
    id: 'hb_mud_blues',
    title: 'Mud Blues',
    artist: 'Big Toad Willie',
    album: 'Muddy Guitar Blues',
    genre: 'Blues',
    categories: ['house_band', 'throwback'],
    difficulty: 1,
    rights: ORIGINAL,
    cover: { motif: 'mud_guitar', bg: '#3b2414', fg: '#d98a3d', accent: '#4aa3ff' },
    fact: 'Big Toad Willie is the only toad allowed in the clubhouse. He earned it.',
    lyrics: [
      { beat: 0, text: 'Woke up this morning, my pond had turned to mud' },
      { beat: 16, text: 'Woke up this morning, my pond had turned to mud' },
      { beat: 32, text: 'Ain\'t got no lily pad, just a puddle and a bug' },
    ],
    gaps: [{ line: 2, answer: 'puddle and a bug', decoys: ['paddle and a jug', 'muddle and a rug', 'bubble and a hug'], cut: 36.5 }],
    hook: [0, 16],
    score: {
      bpm: 96,
      swing: 0.33,
      parts: [
        { inst: 'voice', vol: 0.7, notes: BLUES },
        { inst: 'pluck', vol: 0.55, notes: `r:8 ${BLUES_FILL} r:8 ${BLUES_FILL} r:8 ${BLUES_FILL}` },
        { inst: 'organ', vol: 0.3, chords: 'E7:16 A7:8 E7:8 B7:4 A7:4 E7:4 B7:4', style: 'stabs', oct: 3 },
        { inst: 'bass', vol: 0.55, chords: 'E7:16 A7:8 E7:8 B7:4 A7:4 E7:4 B7:4', style: 'walking' },
        { inst: 'drums', vol: 0.4, notes: '(k:1 h:0.5? h s:1 h:0.5? h)x12' },
      ],
    },
  },
];
