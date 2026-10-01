      // County roadside guide signs: a real-size board (sign() paints it) on two galvanised posts, standing
      // on the verge at the plan's spot (county-guide-signs.js), its bottom edge 2 m above the ground.
      const guidePostMaterial = staticMat('#8a8d8f', 0.55, 0.6);
      function roadsideSign(text, planX, planY, width, color, options = {}) {
        const at = signSpot(planX, planY, width);
        if (!at) return null;
        const { x, y } = at,
          ground = terrainHeight(x, y),
          board = sign(text, x, y, width, color, false, options),
          height = width / 4,
          centre = ground + 16 + height / 2,
          group = new Three.Group();
        board.position.y = centre;
        if (board.userData.backing) board.userData.backing.position.y = centre;
        scene.add(group);
        batchGroups.push(group);
        // Each post stands to the ground under it, so a board on a slope never floats on one leg.
        for (const d of [-0.3, 0.3]) {
          const foot = terrainHeight(x + d * width, y);
          box(group, x + d * width, (centre + foot) / 2 - 1, y - 2.4, 1.4, centre - foot + 2, 1.4, guidePostMaterial);
        }
        return board;
      }
