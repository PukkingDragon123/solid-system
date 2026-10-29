// Bot frogs: fill empty seats, star in the tutorial, and keep solo players company.

import { COSMETICS, DEFAULT_OUTFIT, type Outfit } from '../cosmetics';
import { pick, type Rng } from '../rng';

export const BOT_NAMES = [
  'Ribbert', 'Croakley', 'Hopsworth', 'Lily Pad Larry', 'Sir Hops', 'Toadette', 'Bubbles', 'Fly Guy',
  'Mossimo', 'Puddles', 'Kermitten', 'Gloria Gulp', 'Chirpy', 'Duckweed', 'Leapy', 'Bog Dylan',
  'Frogger Jr', 'Polly Wog', 'Sludge', 'Tadpolly',
];

export interface BotBrain {
  skill: number; // 0..1 chance of knowing the answer
  speed: number; // 0..1, higher = faster
  chaos: number; // emote frequency
}

export function randomBotOutfit(rng: Rng): Outfit {
  const bySlot = (slot: string) => COSMETICS.filter((c) => c.slot === slot);
  const maybe = (slot: string, p: number) => (rng() < p ? pick(rng, bySlot(slot)).id : (DEFAULT_OUTFIT as unknown as Record<string, string>)[slot]);
  return {
    ...DEFAULT_OUTFIT,
    skin: pick(rng, bySlot('skin')).id,
    pattern: maybe('pattern', 0.5),
    eyes: maybe('eyes', 0.5),
    mouth: maybe('mouth', 0.5),
    hat: maybe('hat', 0.75),
    clothes: maybe('clothes', 0.55),
    neck: maybe('neck', 0.4),
    face: maybe('face', 0.35),
    idle: maybe('idle', 0.5),
  };
}

export function randomBrain(rng: Rng): BotBrain {
  return { skill: 0.35 + rng() * 0.45, speed: 0.2 + rng() * 0.7, chaos: rng() };
}
