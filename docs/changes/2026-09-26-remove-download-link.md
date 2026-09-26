# Title menu: remove the download / play offline link

- The title menu no longer shows DOWNLOAD / PLAY OFFLINE. It was already hidden inside the artifact and on file:// copies; players get the game from GitHub or the zip (`tools/build.py --zip`).
- Removed `#offlineCopy` from src/shell.html (and its CSS) and its hiding code from src/game-input.js.
