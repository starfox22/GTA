      // Each reference points to a non-executable media block above.
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
    }
  },
  "audio": {
    "automatic": "media-audio-automatic",
    "call-backup": "media-audio-call-backup",
    "civilian-scream-female-1": "media-audio-civilian-scream-female-1",
    "civilian-scream-female-2": "media-audio-civilian-scream-female-2",
    "civilian-scream-male-1": "media-audio-civilian-scream-male-1",
    "civilian-scream-male-2": "media-audio-civilian-scream-male-2",
    "engine": "media-audio-engine",
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
    "tires": "media-audio-tires"
  }
};

function embeddedMediaDataUrl(identifier) {
  const payloadElement = document.getElementById(identifier);
  if (!payloadElement) throw new Error('Missing embedded media: ' + identifier);
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
