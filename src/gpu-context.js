    // GPU context loss: when the browser takes the 3D canvas's WebGL context away (GPU memory, a driver reset), the
    // game pauses, says so, skips drawing, and once the context is back reloads the page (progress is saved).
    /**
     * GPU CONTEXT
     * Without this a lost context left a frozen black canvas and a game still running blind behind it. three.js
     * already calls preventDefault on 'webglcontextlost' (so the browser may restore it) and re-creates its own GL
     * state on 'webglcontextrestored'; what it cannot bring back are the canvas textures whose bitmaps were freed
     * after their upload (render3d-resources.js BAKED CANVAS RELEASE: signs, ground sheets). So on the way back the
     * page reloads, after a save, which rebuilds the renderer whole; a job under way is offered again by RESTART
     * CURRENT JOB (`retryJobIndex`). A dev or test page (DEV_BOOT_FLAGS) does not reload: tests read the state.
     * Normal frames only test `gpuContext.lost`.
     */
    const GPU_CONTEXT_RELOAD_MS = 1500,
      // No restore by then: the player is told to reload by hand.
      GPU_CONTEXT_WAIT_MS = 8000;
    const gpuContext = { watched: false, lost: false, lostAt: 0, losses: 0, restores: 0, reloadPending: false, waitTold: false };
    function watchGpuContext(canvas) {
      if (gpuContext.watched || !canvas) return;
      gpuContext.watched = true;
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        gpuContextLost();
      });
      canvas.addEventListener('webglcontextrestored', () => gpuContextRestored());
    }
    function gpuContextLost() {
      if (gpuContext.lost) return;
      gpuContext.lost = true;
      gpuContext.lostAt = performance.now();
      gpuContext.losses++;
      gpuContext.waitTold = false;
      // Pausing saves (game-menus.js togglePause).
      if (gameMode === 'play') togglePause();
      const info = getElement('pauseInfo');
      if (gameMode === 'pause' && info) info.textContent = 'The graphics card reset and dropped the picture. Waiting for it to come back · your progress is saved.';
      getElement('renderBadge').textContent = 'GRAPHICS RESET';
      tell('THE GRAPHICS CARD DROPPED THE PICTURE · waiting for it to come back · progress saved', 10, { id: 'gpu-context' });
    }
    function gpuContextRestored() {
      if (!gpuContext.lost) return;
      gpuContext.lost = false;
      gpuContext.restores++;
      getElement('renderBadge').textContent = 'SOUTH COAST · DUSK';
      tell('PICTURE BACK · reloading the city · progress saved', 4, { id: 'gpu-context' });
      if (gameMode === 'play' || gameMode === 'pause') save();
      gpuContext.reloadPending = true;
      if (!DEV_BOOT_FLAGS) setTimeout(() => location.reload(), GPU_CONTEXT_RELOAD_MS);
    }
    // Called by drawWorld while the context is gone, in place of the draw.
    function gpuContextWaiting() {
      if (gpuContext.waitTold || performance.now() - gpuContext.lostAt < GPU_CONTEXT_WAIT_MS) return;
      gpuContext.waitTold = true;
      const info = getElement('pauseInfo');
      if (gameMode === 'pause' && info) info.textContent = 'The graphics card has not come back. Reload the page: your progress is saved.';
      tell('THE PICTURE HAS NOT COME BACK · reload the page · progress saved', 12, { id: 'gpu-context' });
    }
    function gpuContextReport() {
      return {
        watched: gpuContext.watched,
        lost: gpuContext.lost,
        losses: gpuContext.losses,
        restores: gpuContext.restores,
        reloadPending: gpuContext.reloadPending,
        lostSeconds: gpuContext.lost ? +((performance.now() - gpuContext.lostAt) / 1000).toFixed(1) : 0,
      };
    }
