      /**
       * Media loader
       * Source: src/asset-loader.js
       * Scope: top level of the built page, after the media blocks.
       * Decodes the labelled Base64 blocks into images and audio buffers and then
       * calls startDeadEndCity(). Each reference below points to a non-executable
       * media block above it in the file.
       */
const embeddedAssetReferences = {
  "architecture": "media-architecture",
  "ground": "media-ground",
  "weapons": "media-weapons",
  "harbor": "media-harbor",
  "arsenal": "media-arsenal",
  "music": {
    "synth": {
      "title": "Retroracing One more round",
      "artist": "Bogart VGM",
      "src": "media-music-synth"
    },
    "rock": {
      "title": "Rock theme",
      "artist": "obscure music",
      "src": "media-music-rock"
    },
    "oddball": {
      "title": "Midnight Cruiser",
      "artist": "Zane Little Music",
      "src": "media-music-oddball"
    },
    "lounge-martini": {
      "title": "Martini Sunset",
      "artist": "Kevin MacLeod",
      "src": "media-music-lounge-martini"
    },
    "lounge-heists": {
      "title": "Patron Saint of Heists",
      "artist": "Bryan Teoh",
      "src": "media-music-lounge-heists"
    },
    "island-dub": {
      "title": "Sunday Dub",
      "artist": "Kevin MacLeod",
      "src": "media-music-island-dub"
    },
    "island-colada": {
      "title": "Piña Colada",
      "artist": "Alexander Nakarada",
      "src": "media-music-island-colada"
    },
    "lofi-hooptie": {
      "title": "Hooptie With The Windows Down",
      "artist": "HoliznaCC0",
      "src": "media-music-lofi-hooptie"
    },
    "lofi-freeway": {
      "title": "Lost On The Freeway",
      "artist": "HoliznaCC0",
      "src": "media-music-lofi-freeway"
    }
  },
  "audio": {
    "automatic": "media-audio-automatic",
    "crash-bump-1": "media-audio-crash-bump-1",
    "crash-bump-2": "media-audio-crash-bump-2",
    "crash-scrape": "media-audio-crash-scrape",
    "crash-medium-1": "media-audio-crash-medium-1",
    "crash-medium-2": "media-audio-crash-medium-2",
    "crash-medium-3": "media-audio-crash-medium-3",
    "crash-heavy-1": "media-audio-crash-heavy-1",
    "crash-heavy-2": "media-audio-crash-heavy-2",
    "crash-glass-1": "media-audio-crash-glass-1",
    "crash-glass-2": "media-audio-crash-glass-2",
    "crash-debris": "media-audio-crash-debris",
    "call-backup": "media-audio-call-backup",
    "civilian-scream-female-1": "media-audio-civilian-scream-female-1",
    "civilian-scream-female-2": "media-audio-civilian-scream-female-2",
    "civilian-scream-male-1": "media-audio-civilian-scream-male-1",
    "civilian-scream-male-2": "media-audio-civilian-scream-male-2",
    "explosion": "media-audio-explosion",
    "look-out": "media-audio-look-out",
    "mission-complete": "media-audio-mission-complete",
    "mission-failed": "media-audio-mission-failed",
    "pistol": "media-audio-pistol",
    "police-challenge": "media-audio-police-challenge",
    "police-drop-weapon": "media-audio-police-drop-weapon",
    "police-get-down": "media-audio-police-get-down",
    "police-hands-on-head": "media-audio-police-hands-on-head",
    "police-under-arrest": "media-audio-police-under-arrest",
    "rifle": "media-audio-rifle",
    "rotor-loop": "media-audio-rotor-loop",
    "shotgun": "media-audio-shotgun",
    "siren": "media-audio-siren",
    "target-engaged": "media-audio-target-engaged",
    "engine-start": "media-audio-engine-start",
    "engine-compact-idle": "media-audio-engine-compact-idle",
    "engine-compact-low": "media-audio-engine-compact-low",
    "engine-compact-mid": "media-audio-engine-compact-mid",
    "engine-compact-high": "media-audio-engine-compact-high",
    "engine-sport-idle": "media-audio-engine-sport-idle",
    "engine-sport-low": "media-audio-engine-sport-low",
    "engine-sport-mid": "media-audio-engine-sport-mid",
    "engine-sport-high": "media-audio-engine-sport-high",
    "engine-v8-idle": "media-audio-engine-v8-idle",
    "engine-v8-low": "media-audio-engine-v8-low",
    "engine-v8-mid": "media-audio-engine-v8-mid",
    "engine-diesel-idle": "media-audio-engine-diesel-idle",
    "engine-diesel-mid": "media-audio-engine-diesel-mid",
    "engine-diesel-high": "media-audio-engine-diesel-high",
    "engine-twin-idle": "media-audio-engine-twin-idle",
    "tank-tracks": "media-audio-tank-tracks",
    "boat-outboard-low": "media-audio-boat-outboard-low",
    "boat-outboard-high": "media-audio-boat-outboard-high",
    "boat-diesel": "media-audio-boat-diesel",
    "boat-jetski": "media-audio-boat-jetski",
    "tires": "media-audio-tires"
  }
};

function embeddedMediaDataUrl(identifier) {
  const payloadElement = document.getElementById(identifier);
  if (!payloadElement) throw new Error('Missing embedded media: ' + identifier);
  // Split builds (tools/build.py --split-media) leave large streamed media such as
  // the radio music out of the page; the block then names the file beside it.
  if (payloadElement.dataset.src) return payloadElement.dataset.src;
  const base64Bytes = payloadElement.textContent.replace(/\s+/g, '');
  return 'data:' + payloadElement.dataset.mime + ';base64,' + base64Bytes;
}

const gameAssets = {};
for (const name of ['architecture', 'ground', 'weapons', 'harbor', 'arsenal']) {
  gameAssets[name] = embeddedMediaDataUrl(embeddedAssetReferences[name]);
}
gameAssets.audio = {};
for (const [name, identifier] of Object.entries(embeddedAssetReferences.audio)) {
  gameAssets.audio[name] = embeddedMediaDataUrl(identifier);
}
gameAssets.music = {};
for (const [name, track] of Object.entries(embeddedAssetReferences.music)) {
  gameAssets.music[name] = { ...track, src: embeddedMediaDataUrl(track.src) };
}
document.getElementById('coverArt').style.backgroundImage =
  'url(' + embeddedMediaDataUrl('media-cover') + ')';
document.documentElement.style.setProperty(
  '--contact-portrait-image',
  'url(' + embeddedMediaDataUrl('media-contact-portraits') + ')',
);

// All code and media are present. Starting the game needs no network fetch.
startDeadEndCity(gameAssets);
