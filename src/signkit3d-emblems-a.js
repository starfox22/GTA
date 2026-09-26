            case 'wrench':
              g.rotate(-Math.PI / 4);
              line([
                [0, 0.62],
                [0, -0.3],
              ]);
              S(c1, 0.26);
              g.beginPath();
              g.arc(0, -0.52 * u, 0.3 * u, -Math.PI * 0.28, Math.PI * 1.28);
              S(c1, 0.2);
              circle(0, 0.7, 0.14);
              S(c1, 0.12);
              break;
            case 'wrenches':
              for (const r of [-1, 1]) {
                g.save();
                g.rotate((r * Math.PI) / 4);
                line([
                  [0, 0.7],
                  [0, -0.35],
                ]);
                S(c1, 0.2);
                g.beginPath();
                g.arc(0, -0.58 * u, 0.24 * u, -Math.PI * 0.28, Math.PI * 1.28);
                S(c1, 0.16);
                g.restore();
              }
              break;
            case 'martini':
              poly([
                [-0.7, -0.7],
                [0.7, -0.7],
                [0, 0.05],
              ]);
              F(c1);
              line([
                [0, 0.05],
                [0, 0.7],
              ]);
              S(c1, 0.1);
              line([
                [-0.35, 0.72],
                [0.35, 0.72],
              ]);
              S(c1, 0.12);
              circle(0.22, -0.45, 0.13);
              F(c2);
              line([
                [0.1, -0.2],
                [0.5, -0.9],
              ]);
              S(c2, 0.05);
              break;
            case 'cup':
              g.beginPath();
              g.moveTo(-0.6 * u, -0.25 * u);
              g.lineTo(0.4 * u, -0.25 * u);
              g.quadraticCurveTo(0.4 * u, 0.55 * u, -0.1 * u, 0.55 * u);
              g.quadraticCurveTo(-0.6 * u, 0.55 * u, -0.6 * u, -0.25 * u);
              g.closePath();
              F(c1);
              g.beginPath();
              g.arc(0.46 * u, 0.08 * u, 0.2 * u, -Math.PI / 2, Math.PI / 2);
              S(c1, 0.1);
              g.beginPath();
              g.ellipse(-0.1 * u, 0.66 * u, 0.75 * u, 0.12 * u, 0, 0, FULL);
              F(c1);
              for (const dx of [-0.35, -0.1, 0.15]) {
                line([
                  [dx, -0.4],
                  [dx + 0.1, -0.6],
                  [dx - 0.02, -0.8],
                ]);
                S(c2, 0.07);
              }
              break;
            case 'anchor':
              circle(0, -0.72, 0.16);
              S(c1, 0.1);
              line([
                [0, -0.56],
                [0, 0.8],
              ]);
              S(c1, 0.16);
              line([
                [-0.42, -0.36],
                [0.42, -0.36],
              ]);
              S(c1, 0.13);
              g.beginPath();
              g.arc(0, 0.2 * u, 0.62 * u, Math.PI * 0.1, Math.PI * 0.9);
              S(c1, 0.14);
              for (const side of [-1, 1]) {
                poly([
                  [side * 0.66, 0.2],
                  [side * 0.5, 0.42],
                  [side * 0.8, 0.44],
                ]);
                F(c1);
              }
              break;
            case 'cross':
              poly([
                [-0.24, -0.8],
                [0.24, -0.8],
                [0.24, -0.24],
                [0.8, -0.24],
                [0.8, 0.24],
                [0.24, 0.24],
                [0.24, 0.8],
                [-0.24, 0.8],
                [-0.24, 0.24],
                [-0.8, 0.24],
                [-0.8, -0.24],
                [-0.24, -0.24],
              ]);
              F(c1);
              break;
            case 'dice':
              for (const [dx, dy, r, pips] of [
                [-0.32, 0.12, -0.25, [[0, 0], [-0.2, -0.2], [0.2, 0.2]]],
                [0.36, -0.14, 0.3, [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, 0]]],
              ]) {
                g.save();
                g.translate(dx * u, dy * u);
                g.rotate(r);
                g.beginPath();
                g.roundRect(-0.36 * u, -0.36 * u, 0.72 * u, 0.72 * u, 0.12 * u);
                F(c1);
                if (!tube)
                  for (const [px, py] of pips) {
                    g.beginPath();
                    g.arc(px * u, py * u, 0.07 * u, 0, FULL);
                    g.fillStyle = c2;
                    g.fill();
                  }
                g.restore();
              }
              break;
            case 'reel':
              circle(0, 0, 0.82);
              F(c1);
              if (!tube) {
                for (let k = 0; k < 5; k++) {
                  const a = (k * FULL) / 5 - Math.PI / 2;
                  circle(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.19);
                  F(c2);
                }
                circle(0, 0, 0.1);
                F(c2);
              } else {
                circle(0, 0, 0.3);
                g.stroke();
              }
              break;
            case 'crown':
              poly([
                [-0.8, 0.45],
                [-0.8, -0.35],
                [-0.4, 0.05],
                [0, -0.6],
                [0.4, 0.05],
                [0.8, -0.35],
                [0.8, 0.45],
              ]);
              F(c1);
              for (const [px, py] of [
                [-0.8, -0.45],
                [0, -0.72],
                [0.8, -0.45],
              ]) {
                circle(px, py, 0.12);
                F(c2);
              }
              g.beginPath();
              g.rect(-0.8 * u, 0.5 * u, 1.6 * u, 0.2 * u);
              F(c1);
              break;
            case 'palm':
              g.beginPath();
              g.moveTo(-0.05 * u, 0.9 * u);
              g.quadraticCurveTo(0.1 * u, 0.2 * u, 0.02 * u, -0.45 * u);
              S(c2, 0.14);
              for (const [a, len] of [
                [-2.7, 0.8],
                [-2.1, 0.85],
                [-1.5, 0.6],
                [-0.9, 0.85],
                [-0.35, 0.8],
              ]) {
                const ex = Math.cos(a) * len,
                  ey = -0.45 + Math.sin(a) * len * 0.7 + 0.35;
                g.beginPath();
                g.moveTo(0.02 * u, -0.45 * u);
                g.quadraticCurveTo(((0.02 + ex) / 2) * u, (-0.45 - 0.35) * u, ex * u, ey * u);
                g.quadraticCurveTo(((0.02 + ex) / 2) * u, (-0.45 - 0.12) * u, 0.02 * u, -0.4 * u);
                F(c1);
              }
              break;
            case 'car':
              g.beginPath();
              g.moveTo(-0.95 * u, 0.25 * u);
              g.lineTo(-0.9 * u, -0.05 * u);
              g.lineTo(-0.45 * u, -0.12 * u);
              g.lineTo(-0.22 * u, -0.42 * u);
              g.lineTo(0.3 * u, -0.42 * u);
              g.lineTo(0.55 * u, -0.1 * u);
              g.lineTo(0.95 * u, -0.02 * u);
              g.lineTo(0.95 * u, 0.25 * u);
              g.closePath();
              F(c1);
              for (const dx of [-0.52, 0.55]) {
                circle(dx, 0.27, 0.18);
                F(c2);
              }
              break;
            case 'pistols':
              for (const side of [-1, 1]) {
                g.save();
                g.scale(side, 1);
                g.rotate(-0.6);
                poly([
                  [-0.75, -0.14],
                  [0.45, -0.14],
                  [0.45, 0.02],
                  [0.1, 0.02],
                  [0.02, 0.1],
                  [0.12, 0.48],
                  [-0.12, 0.5],
                  [-0.22, 0.04],
                  [-0.75, 0.02],
                ]);
                F(c1);
                g.restore();
              }
              break;
            case 'target':
              for (const [r, c] of [
                [0.82, c1],
                [0.6, c2],
                [0.4, c1],
                [0.2, c2],
              ]) {
                circle(0, 0, r);
                tube ? g.stroke() : F(c);
              }
              line([
                [-1, 0],
                [1, 0],
              ]);
              S(c1, 0.05);
              line([
                [0, -1],
                [0, 1],
              ]);
              S(c1, 0.05);
              break;
            case 'star':
              star(0, 0.05, 0.85);
              F(c1);
              break;
            case 'badge':
              star(0, 0, 0.85, 6, 0.55);
              F(c1);
              if (!tube) {
                circle(0, 0, 0.32);
                F(c2);
                for (let k = 0; k < 6; k++) {
                  const a = (k * Math.PI) / 3 - Math.PI / 2;
                  circle(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.09);
                  F(c1);
                }
              }
              break;
            case 'shield':
              g.beginPath();
              g.moveTo(-0.7 * u, -0.8 * u);
              g.lineTo(0.7 * u, -0.8 * u);
              g.lineTo(0.7 * u, 0);
              g.quadraticCurveTo(0.65 * u, 0.6 * u, 0, 0.9 * u);
              g.quadraticCurveTo(-0.65 * u, 0.6 * u, -0.7 * u, 0);
              g.closePath();
              F(c1);
              if (!tube) {
                line([
                  [-0.7, 0.25],
                  [0, -0.25],
                  [0.7, 0.25],
                ]);
                S(c2, 0.14);
                // An open book on the crest.
                poly([
                  [-0.4, -0.6],
                  [0, -0.5],
                  [0.4, -0.6],
                  [0.4, -0.3],
                  [0, -0.22],
                  [-0.4, -0.3],
                ]);
                F(c2);
                star(0, 0.42, 0.16);
                F(c2);
              }
              break;
            case 'sunset':
              g.beginPath();
              g.arc(0, 0.25 * u, 0.62 * u, Math.PI, 0);
              g.closePath();
              F(c1);
              for (let k = 0; k < 7; k++) {
                const a = Math.PI + (k + 0.5) * (Math.PI / 7);
                line([
                  [Math.cos(a) * 0.72, 0.25 + Math.sin(a) * 0.72],
                  [Math.cos(a) * 0.98, 0.25 + Math.sin(a) * 0.98],
                ]);
                S(c1, 0.08);
              }
              if (!tube)
                for (let k = 0; k < 3; k++) {
                  g.fillStyle = c2;
                  g.fillRect(-0.7 * u, (0.34 + k * 0.14) * u, 1.4 * u, 0.06 * u);
                }
              break;
            case 'sun':
              circle(0, 0, 0.42);
              F(c1);
              for (let k = 0; k < 12; k++) {
                const a = (k * FULL) / 12;
                line([
                  [Math.cos(a) * 0.55, Math.sin(a) * 0.55],
                  [Math.cos(a) * 0.85, Math.sin(a) * 0.85],
                ]);
                S(c1, 0.09);
              }
              break;
            case 'moon': {
              const R = 0.78 * u,
                d = 0.42 * u,
                q = 0.66 * u,
                ix = (R * R - q * q + d * d) / (2 * d),
                iy = Math.sqrt(Math.max(0, R * R - ix * ix)),
                A = Math.atan2(iy, ix),
                B = Math.atan2(iy, ix - d);
              g.beginPath();
              g.arc(0, 0, R, A, FULL - A, false);
              g.arc(d, 0, q, -B, B, true);
              g.closePath();
              F(c1);
              break;
            }
