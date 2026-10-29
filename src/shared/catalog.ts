// Static game catalogs: categories, minigames, maps, emotes, player colours.

export type CategoryId =
  | 'rap' | 'rock' | 'pop' | 'indie' | 'alternative'
  | 'throwback' | '2000s' | '2010s' | '2020s'
  | 'meme' | 'anime_op' | 'movie_ost' | 'tv_themes'
  | 'classical' | 'singalong'
  | 'movies' | 'tv' | 'anime' | 'games'
  | 'house_band' | 'playlist' | 'mixed';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  short: string;
  blurb: string;
  color: string;
  /** Card illustration motif drawn by the client. */
  art: string;
  group: 'genre' | 'decade' | 'music' | 'popculture' | 'mixed';
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'rap', name: 'Rap', short: 'RAP', blurb: 'Bars, beats and big chains', color: '#f2b233', art: 'mic', group: 'genre' },
  { id: 'rock', name: 'Rock', short: 'ROCK', blurb: 'Loud guitars, louder frogs', color: '#e2483d', art: 'guitar', group: 'genre' },
  { id: 'pop', name: 'Pop', short: 'POP', blurb: 'Chart-toppers and earworms', color: '#ff6fb5', art: 'star', group: 'genre' },
  { id: 'indie', name: 'Indie', short: 'INDIE', blurb: 'You probably haven\'t heard of it', color: '#6fc2a1', art: 'cassette', group: 'genre' },
  { id: 'alternative', name: 'Alternative', short: 'ALT', blurb: 'Flannel energy only', color: '#7b6cf2', art: 'lightning', group: 'genre' },
  { id: 'throwback', name: 'Throwbacks', short: 'RETRO', blurb: 'Before the year 2000', color: '#d98a3d', art: 'boombox', group: 'decade' },
  { id: '2000s', name: '2000s', short: '2000s', blurb: 'Flip phones and frosted tips', color: '#4cc3ff', art: 'flipphone', group: 'decade' },
  { id: '2010s', name: '2010s', short: '2010s', blurb: 'Vines, vibes and viral hits', color: '#ffd04c', art: 'phone', group: 'decade' },
  { id: '2020s', name: '2020s', short: '2020s', blurb: 'The algorithm era', color: '#b0f25a', art: 'headphones', group: 'decade' },
  { id: 'meme', name: 'Meme Music', short: 'MEME', blurb: 'Rickrolls, ringtones and chaos', color: '#ff8a3d', art: 'skull', group: 'music' },
  { id: 'anime_op', name: 'Anime Openings', short: 'ANIME OP', blurb: 'Dramatic sakura energy', color: '#ff7a9c', art: 'sakura', group: 'music' },
  { id: 'movie_ost', name: 'Movie Soundtracks', short: 'FILM OST', blurb: 'Music from the big screen', color: '#e8c25a', art: 'clapper', group: 'music' },
  { id: 'tv_themes', name: 'TV Themes', short: 'TV THEMES', blurb: 'Don\'t touch that dial', color: '#5ad1c8', art: 'tv', group: 'music' },
  { id: 'classical', name: 'Classical Bangers', short: 'CLASSICAL', blurb: 'Public domain certified hits', color: '#c9a2ff', art: 'violin', group: 'music' },
  { id: 'singalong', name: 'Sing-Alongs', short: 'SING-ALONG', blurb: 'Campfire and nursery classics', color: '#9be36b', art: 'campfire', group: 'music' },
  { id: 'movies', name: 'Movies', short: 'MOVIES', blurb: 'Popcorn trivia', color: '#f25a5a', art: 'popcorn', group: 'popculture' },
  { id: 'tv', name: 'TV Shows', short: 'TV', blurb: 'Binge-watch brain', color: '#5a8cf2', art: 'remote', group: 'popculture' },
  { id: 'anime', name: 'Anime', short: 'ANIME', blurb: 'Power of friendship', color: '#f25ab8', art: 'scroll', group: 'popculture' },
  { id: 'games', name: 'Video Games', short: 'GAMES', blurb: 'Press start to croak', color: '#5af29a', art: 'gamepad', group: 'popculture' },
  { id: 'house_band', name: 'House Band', short: 'HOUSE BAND', blurb: 'Original swamp bangers', color: '#3fbf6a', art: 'lilypad', group: 'music' },
  { id: 'playlist', name: 'Your Playlist', short: 'PLAYLIST', blurb: 'Imported by the host', color: '#1ed760', art: 'vinyl', group: 'mixed' },
  { id: 'mixed', name: 'Mixed Bag', short: 'MIXED', blurb: 'A little bit of everything', color: '#ffffff', art: 'dice', group: 'mixed' },
];

export const CATEGORY_BY_ID: Record<string, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export type MinigameId =
  | 'guess_song' | 'finish_lyrics' | 'guess_artist' | 'guess_album' | 'album_cover' | 'emoji_song'
  | 'reverse_song' | 'speed_song' | 'guess_intro' | 'guess_outro' | 'release_year' | 'which_first'
  | 'finish_quote' | 'tv_theme' | 'movie_sound' | 'guess_character' | 'higher_lower' | 'guess_genre'
  | 'trivia';

export type SocialId = 'duel' | 'wager' | 'predict' | 'sabotage';

export type BoardStyle = 'lilypads' | 'sleeves' | 'cards' | 'tv' | 'mushrooms' | 'arrows' | 'chalk' | 'cassettes';

export interface MinigameDef {
  id: MinigameId;
  name: string;
  blurb: string;
  howTo: string;
  audio: 'required' | 'optional' | 'none';
  board: BoardStyle;
  /** DJ intro line. */
  dj: string;
  /** Where the camera looks while the question is live. */
  stage: 'board' | 'chalkboard' | 'tv' | 'dj';
}

export const MINIGAMES: MinigameDef[] = [
  { id: 'guess_song', name: 'Guess the Song', blurb: 'Clips grow from 0.5s to 8s', howTo: 'Lock in a title early for more points!', audio: 'required', board: 'lilypads', dj: 'Half a second. That\'s all you get. Then I get generous.', stage: 'board' },
  { id: 'finish_lyrics', name: 'Finish the Lyrics', blurb: 'The music stops... you finish it', howTo: 'Pick the missing words before the timer runs out.', audio: 'required', board: 'lilypads', dj: 'I\'ll play it, you sing it. When I cut the music, fill the gap!', stage: 'board' },
  { id: 'guess_artist', name: 'Guess the Artist', blurb: 'Who made this?', howTo: 'Name the composer, band or artist.', audio: 'optional', board: 'sleeves', dj: 'Who\'s behind the music? Point that glove!', stage: 'board' },
  { id: 'guess_album', name: 'Guess the Album', blurb: 'The record sleeve slides out...', howTo: 'Tracks appear one by one. Name the album fast!', audio: 'none', board: 'sleeves', dj: 'Liner notes time. Read the tracklist and name the record.', stage: 'board' },
  { id: 'album_cover', name: 'Guess the Album Cover', blurb: 'Pixels... more pixels... AH!', howTo: 'The cover sharpens over time. Match it to its title.', audio: 'none', board: 'sleeves', dj: 'My cover art got all pixelated. Help me figure out which record this is!', stage: 'board' },
  { id: 'emoji_song', name: 'Song from Emojis', blurb: 'Decode the emoji', howTo: 'Which song or title do the emojis spell?', audio: 'none', board: 'cards', dj: 'I texted my mom the song name in emojis. She is confused. Are you?', stage: 'board' },
  { id: 'reverse_song', name: 'Reverse the Song', blurb: 'Played backwards!', howTo: 'Identify the song playing in reverse.', audio: 'required', board: 'lilypads', dj: 'I put the record on backwards. Totally on purpose.', stage: 'dj' },
  { id: 'speed_song', name: 'Speed Up Song', blurb: 'Chipmunk mode', howTo: 'Identify the sped-up song.', audio: 'required', board: 'lilypads', dj: 'Too much coffee. Everything is FAST now.', stage: 'dj' },
  { id: 'guess_intro', name: 'Guess the Intro', blurb: 'Just the opening notes', howTo: 'Name the song from its first few seconds.', audio: 'required', board: 'cassettes', dj: 'First notes only. No second chances!', stage: 'board' },
  { id: 'guess_outro', name: 'Guess the Outro', blurb: 'How does it end?', howTo: 'Name the song from its final notes.', audio: 'required', board: 'cassettes', dj: 'Let\'s start at the end. Rock-and-roll logic.', stage: 'board' },
  { id: 'release_year', name: 'Guess the Release Year', blurb: 'Closer = more points', howTo: 'Slide the year dial. Exact year = jackpot.', audio: 'optional', board: 'chalk', dj: 'When did this drop? Closest guesses win big.', stage: 'chalkboard' },
  { id: 'which_first', name: 'Which Came First?', blurb: 'Pick the older one', howTo: 'Choose whichever was released first.', audio: 'none', board: 'cards', dj: 'Two releases enter. Only the elder survives.', stage: 'board' },
  { id: 'finish_quote', name: 'Finish the Quote', blurb: 'Famous words, missing ending', howTo: 'Choose the words that complete the quote.', audio: 'none', board: 'cards', dj: 'A wise frog once said... uh... you finish it.', stage: 'chalkboard' },
  { id: 'tv_theme', name: 'Guess the TV Theme', blurb: 'The big frog brings the telly', howTo: 'Which show is this theme from?', audio: 'optional', board: 'tv', dj: 'Somebody wheel in the TV! It\'s theme song time!', stage: 'tv' },
  { id: 'movie_sound', name: 'Guess the Movie Sound', blurb: 'Lights, camera, ribbit', howTo: 'Which film made this music famous?', audio: 'optional', board: 'tv', dj: 'Grab your popcorn. Name the movie!', stage: 'tv' },
  { id: 'guess_character', name: 'Guess the Character', blurb: 'Clues get easier over time', howTo: 'Answer early for more points.', audio: 'none', board: 'cards', dj: 'Mystery guest! I\'ll drop clues until somebody croaks the answer.', stage: 'chalkboard' },
  { id: 'higher_lower', name: 'Higher or Lower', blurb: 'Older or newer?', howTo: 'Was it released before or after the reference year?', audio: 'none', board: 'arrows', dj: 'Higher or lower? Trust your gut. Your gut is a frog.', stage: 'board' },
  { id: 'guess_genre', name: 'Name That Genre', blurb: 'What vibe is this?', howTo: 'Listen to the house band and name the genre.', audio: 'required', board: 'mushrooms', dj: 'My band can play ANYTHING. Name the genre!', stage: 'dj' },
  { id: 'trivia', name: 'Pond Trivia', blurb: 'Classic quiz showdown', howTo: 'Pick the right answer quickly.', audio: 'none', board: 'cards', dj: 'Good old trivia. Fastest correct frog wins.', stage: 'board' },
];

export const MINIGAME_BY_ID: Record<string, MinigameDef> = Object.fromEntries(MINIGAMES.map((m) => [m.id, m]));

export interface SocialDef { id: SocialId; name: string; blurb: string; dj: string }

export const SOCIAL_ROUNDS: SocialDef[] = [
  { id: 'duel', name: 'Frog Duel', blurb: 'Challenge a frog. Fastest correct answer steals points!', dj: 'DUEL! The challenger picks a victim... I mean, opponent.' },
  { id: 'wager', name: 'Lily Pad Wager', blurb: 'Bet your points on the next question', dj: 'Feeling lucky? Wager your points. Right doubles down, wrong... ribbit.' },
  { id: 'predict', name: 'Who Will Flop?', blurb: 'Predict who answers wrong', dj: 'Point your glove at the frog who\'ll get this WRONG. Rude? Yes. Fun? Also yes.' },
  { id: 'sabotage', name: 'Secret Sabotage', blurb: 'Secretly send flies to a rival\'s screen', dj: 'Pick a frog to sabotage. Secretly. I saw nothing.' },
];

export const SOCIAL_BY_ID: Record<string, SocialDef> = Object.fromEntries(SOCIAL_ROUNDS.map((s) => [s.id, s]));

export type MapId = 'swamp_clubhouse' | 'mushroom_tavern' | 'rainy_cabin' | 'lilypad_disco' | 'frog_arcade' | 'moonlit_pond';

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  color: string;
  djOutfit: string;
}

export const MAPS: MapDef[] = [
  { id: 'swamp_clubhouse', name: 'Swamp Clubhouse', blurb: 'Cozy logs, lanterns and a pond view', color: '#7cc46a', djOutfit: 'cap' },
  { id: 'mushroom_tavern', name: 'Mushroom Tavern', blurb: 'Glowing caps and bubbling mugs', color: '#c77dff', djOutfit: 'mushroom' },
  { id: 'rainy_cabin', name: 'Rainy Forest Cabin', blurb: 'Thunder outside, warm inside', color: '#6fa8dc', djOutfit: 'raincoat' },
  { id: 'lilypad_disco', name: 'Floating Lily Pad Disco', blurb: 'Disco ball over the water', color: '#ff6fd8', djOutfit: 'disco' },
  { id: 'frog_arcade', name: 'Frog Arcade', blurb: 'Neon cabinets and 8-bit beeps', color: '#4dffea', djOutfit: 'visor' },
  { id: 'moonlit_pond', name: 'Moonlit Pond', blurb: 'Fireflies under a giant moon', color: '#b8c6ff', djOutfit: 'wizard' },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export interface EmoteDef { id: string; name: string; icon: string; price: number; anim: string; sfx: string }

export const EMOTES: EmoteDef[] = [
  { id: 'wave', name: 'Wave', icon: '👋', price: 0, anim: 'wave', sfx: 'pop' },
  { id: 'laugh', name: 'LOL', icon: '😂', price: 0, anim: 'laugh', sfx: 'laugh' },
  { id: 'ribbit', name: 'Ribbit', icon: '🐸', price: 0, anim: 'hop', sfx: 'ribbit' },
  { id: 'clap', name: 'Clap', icon: '👏', price: 0, anim: 'clap', sfx: 'clap' },
  { id: 'shock', name: 'Shook', icon: '😱', price: 0, anim: 'shock', sfx: 'gasp' },
  { id: 'cry', name: 'Cry', icon: '😭', price: 0, anim: 'cry', sfx: 'sob' },
  { id: 'love', name: 'Love', icon: '💚', price: 0, anim: 'love', sfx: 'aww' },
  { id: 'angry', name: 'Angry', icon: '💢', price: 0, anim: 'angry', sfx: 'grumble' },
  { id: 'dance', name: 'Dance', icon: '🕺', price: 80, anim: 'dance', sfx: 'beat' },
  { id: 'burp', name: 'Burp', icon: '🫧', price: 60, anim: 'burp', sfx: 'burp' },
  { id: 'flex', name: 'Flex', icon: '💪', price: 100, anim: 'flex', sfx: 'whoosh' },
  { id: 'facepalm', name: 'Facepalm', icon: '🤦', price: 100, anim: 'facepalm', sfx: 'slap' },
  { id: 'skull', name: 'I\'m Dead', icon: '💀', price: 120, anim: 'faint', sfx: 'thud' },
  { id: 'shrug', name: 'Shrug', icon: '🤷', price: 80, anim: 'shrug', sfx: 'boing' },
  { id: 'think', name: 'Hmm', icon: '🤔', price: 80, anim: 'think', sfx: 'hmm' },
  { id: 'party', name: 'Party', icon: '🎉', price: 150, anim: 'party', sfx: 'party' },
  { id: 'gg', name: 'GG', icon: '🤝', price: 60, anim: 'bow', sfx: 'ding' },
  { id: 'sleep', name: 'Snooze', icon: '💤', price: 60, anim: 'sleep', sfx: 'snore' },
  { id: 'sus', name: 'Sus', icon: '👀', price: 150, anim: 'sus', sfx: 'sus' },
  { id: 'airguitar', name: 'Air Guitar', icon: '🎸', price: 200, anim: 'airguitar', sfx: 'riff' },
  { id: 'backflip', name: 'Backflip', icon: '🤸', price: 250, anim: 'backflip', sfx: 'whoosh' },
];

export const EMOTE_BY_ID: Record<string, EmoteDef> = Object.fromEntries(EMOTES.map((e) => [e.id, e]));
export const DEFAULT_EMOTES = EMOTES.filter((e) => e.price === 0).map((e) => e.id);

/** Distinct, colour-blind-friendlier palette for player cursors/name tags. */
export const PLAYER_COLORS = [
  '#ff5d5d', '#ffb13b', '#ffe245', '#6fe05a', '#33d6c3', '#4aa3ff',
  '#a37bff', '#ff7ad1', '#f4f4f4', '#ff8a5c', '#b6f24a', '#5ae3ff',
];

export const RANDOM_EVENTS = ['giant_fly', 'mic_swallow', 'mushroom_pop', 'chair_fall', 'dj_zap', 'mosquito'] as const;
export type RandomEventId = (typeof RANDOM_EVENTS)[number];
