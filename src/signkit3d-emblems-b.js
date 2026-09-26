            // SignKit.icon() emblem cases part 2 (from 'stars' to 'warn').
            case 'stars':
              for (const [sx, sy, r] of [
                [-0.5, -0.3, 0.3],
                [0.35, -0.55, 0.2],
                [0.45, 0.35, 0.26],
              ]) {
                star(sx, sy, r, 4, 0.3);
                F(c1);
              }
              break;
            case 'plane':
              g.rotate(-0.5);
              poly([
                [0.9, 0],
                [0.7, -0.08],
                [0.15, -0.08],
                [-0.2, -0.75],
                [-0.36, -0.75],
                [-0.18, -0.08],
                [-0.62, -0.08],
                [-0.78, -0.32],
                [-0.9, -0.32],
                [-0.8, 0],
                [-0.9, 0.32],
                [-0.78, 0.32],
                [-0.62, 0.08],
                [-0.18, 0.08],
                [-0.36, 0.75],
                [-0.2, 0.75],
                [0.15, 0.08],
                [0.7, 0.08],
              ]);
              F(c1);
              break;
            case 'fish':
              g.beginPath();
              g.ellipse(0.1 * u, 0, 0.6 * u, 0.32 * u, 0, 0, FULL);
              F(c1);
              poly([
                [-0.45, 0],
                [-0.9, -0.35],
                [-0.9, 0.35],
              ]);
              F(c1);
              if (!tube) {
                circle(0.45, -0.06, 0.06);
                F(c2);
              }
              break;
            case 'pizza':
              poly([
                [0, 0.85],
                [-0.62, -0.55],
                [0.62, -0.55],
              ]);
              F(c1);
              g.beginPath();
              g.moveTo(-0.66 * u, -0.55 * u);
              g.quadraticCurveTo(0, -0.95 * u, 0.66 * u, -0.55 * u);
              S(c2, 0.16);
              if (!tube)
                for (const [px, py] of [
                  [-0.2, -0.3],
                  [0.22, -0.25],
                  [0, 0.15],
                ]) {
                  circle(px, py, 0.12);
                  F('#b3202a');
                }
              break;
            case 'pole':
              g.beginPath();
              g.roundRect(-0.25 * u, -0.8 * u, 0.5 * u, 1.6 * u, 0.25 * u);
              F('#f4f1ea');
              if (!tube) {
                g.save();
                g.clip();
                for (let k = -4; k < 6; k++) {
                  poly([
                    [-0.3, k * 0.4 - 0.2],
                    [0.3, k * 0.4 - 0.5],
                    [0.3, k * 0.4 - 0.36],
                    [-0.3, k * 0.4 - 0.06],
                  ]);
                  F(k % 2 ? c1 : c2);
                }
                g.restore();
              }
              break;
            case 'balls':
              line([
                [-0.7, -0.8],
                [0.7, -0.8],
              ]);
              S(c2, 0.08);
              for (const [px, py] of [
                [-0.42, 0.05],
                [0.42, 0.05],
                [0, 0.55],
              ]) {
                line([
                  [px, -0.8],
                  [px, py],
                ]);
                S(c2, 0.05);
                circle(px, py, 0.3);
                F(c1);
              }
              break;
            case 'dumbbell':
              line([
                [-0.6, 0],
                [0.6, 0],
              ]);
              S(c1, 0.14);
              for (const side of [-1, 1]) {
                g.beginPath();
                g.roundRect((side > 0 ? 0.45 : -0.75) * u, -0.45 * u, 0.3 * u, 0.9 * u, 0.06 * u);
                F(c1);
                g.beginPath();
                g.roundRect((side > 0 ? 0.78 : -0.92) * u, -0.28 * u, 0.14 * u, 0.56 * u, 0.04 * u);
                F(c1);
              }
              break;
            case 'camera':
              g.beginPath();
              g.roundRect(-0.85 * u, -0.4 * u, 1.7 * u, 1.05 * u, 0.12 * u);
              F(c1);
              g.beginPath();
              g.rect(-0.3 * u, -0.62 * u, 0.6 * u, 0.24 * u);
              F(c1);
              circle(0, 0.12, 0.36);
              tube ? g.stroke() : F(c2);
              circle(0, 0.12, 0.18);
              tube ? g.stroke() : F(c1);
              break;
            case 'bolt':
              poly([
                [0.2, -0.9],
                [-0.5, 0.1],
                [-0.05, 0.1],
                [-0.25, 0.9],
                [0.5, -0.2],
                [0.05, -0.2],
              ]);
              F(c1);
              break;
            case 'helm':
              circle(0, 0, 0.55);
              S(c1, 0.14);
              circle(0, 0, 0.14);
              F(c1);
              for (let k = 0; k < 8; k++) {
                const a = (k * FULL) / 8;
                line([
                  [Math.cos(a) * 0.1, Math.sin(a) * 0.1],
                  [Math.cos(a) * 0.9, Math.sin(a) * 0.9],
                ]);
                S(c1, 0.1);
              }
              break;
            case 'mug':
              g.beginPath();
              g.roundRect(-0.55 * u, -0.45 * u, 0.8 * u, 1.2 * u, 0.08 * u);
              F(c1);
              g.beginPath();
              g.roundRect(0.2 * u, -0.2 * u, 0.4 * u, 0.6 * u, 0.2 * u);
              S(c1, 0.12);
              for (const [px, r] of [
                [-0.4, 0.22],
                [-0.12, 0.26],
                [0.14, 0.2],
              ]) {
                circle(px, -0.5, r);
                F(c2);
              }
              break;
            case 'spray':
              // A spray gun side on: paint cup on top, body, nozzle and trigger grip, a mist.
              g.beginPath();
              g.roundRect(-0.75 * u, -0.28 * u, 1.05 * u, 0.3 * u, 0.12 * u);
              F(c1);
              poly([
                [0.28, -0.24],
                [0.5, -0.18],
                [0.5, -0.06],
                [0.28, 0],
              ]);
              F(c1);
              g.beginPath();
              g.roundRect(-0.42 * u, -0.78 * u, 0.36 * u, 0.44 * u, 0.12 * u);
              F(c2);
              poly([
                [-0.55, 0],
                [-0.3, 0],
                [-0.42, 0.72],
                [-0.68, 0.72],
              ]);
              F(c1);
              for (let k = 0; k < 7; k++) {
                circle(0.62 + (k % 3) * 0.13, -0.12 + ((k * 5) % 7 - 3) * 0.06, 0.04 + (k % 2) * 0.02);
                F(c1);
              }
              break;
            case 'piston':
              g.beginPath();
              g.roundRect(-0.45 * u, -0.85 * u, 0.9 * u, 0.7 * u, 0.1 * u);
              F(c1);
              if (!tube)
                for (let k = 0; k < 3; k++) {
                  g.fillStyle = c2;
                  g.fillRect(-0.45 * u, (-0.75 + k * 0.16) * u, 0.9 * u, 0.05 * u);
                }
              line([
                [0, -0.2],
                [0, 0.55],
              ]);
              S(c1, 0.22);
              circle(0, 0.65, 0.2);
              S(c1, 0.1);
              break;
            case 'ball':
              circle(0, 0, 0.82);
              F(c1);
              if (!tube) {
                g.beginPath();
                for (let k = 0; k < 5; k++) {
                  const a = (k * FULL) / 5 - Math.PI / 2;
                  g.lineTo(Math.cos(a) * 0.3 * u, Math.sin(a) * 0.3 * u);
                }
                g.closePath();
                F(c2);
                for (let k = 0; k < 5; k++) {
                  const a = (k * FULL) / 5 - Math.PI / 2;
                  line([
                    [Math.cos(a) * 0.3, Math.sin(a) * 0.3],
                    [Math.cos(a) * 0.82, Math.sin(a) * 0.82],
                  ]);
                  S(c2, 0.06);
                }
              }
              break;
            case 'bowl':
              g.beginPath();
              g.moveTo(-0.85 * u, -0.05 * u);
              g.lineTo(0.85 * u, -0.05 * u);
              g.quadraticCurveTo(0.8 * u, 0.75 * u, 0, 0.75 * u);
              g.quadraticCurveTo(-0.8 * u, 0.75 * u, -0.85 * u, -0.05 * u);
              F(c1);
              for (const dx of [0.1, 0.35]) {
                line([
                  [dx, -0.1],
                  [dx + 0.45, -0.9],
                ]);
                S(c2, 0.07);
              }
              for (const dx of [-0.45, -0.2]) {
                line([
                  [dx, -0.15],
                  [dx + 0.05, -0.45],
                  [dx - 0.05, -0.65],
                ]);
                S(c2, 0.05);
              }
              break;
            case 'record':
              circle(0, 0, 0.85);
              F(c1);
              if (!tube) {
                g.strokeStyle = 'rgba(255,255,255,0.18)';
                g.lineWidth = Math.max(1, u * 0.02);
                for (const r of [0.72, 0.6, 0.5]) {
                  circle(0, 0, r);
                  g.stroke();
                }
              }
              circle(0, 0, 0.3);
              tube ? g.stroke() : F(c2);
              break;
            case 'heart':
              g.beginPath();
              g.moveTo(0, 0.8 * u);
              g.bezierCurveTo(-1.1 * u, 0, -0.7 * u, -0.95 * u, 0, -0.4 * u);
              g.bezierCurveTo(0.7 * u, -0.95 * u, 1.1 * u, 0, 0, 0.8 * u);
              F(c1);
              break;
            case 'flower':
              for (let k = 0; k < 5; k++) {
                const a = (k * FULL) / 5;
                g.beginPath();
                g.ellipse(Math.cos(a) * 0.42 * u, Math.sin(a) * 0.42 * u, 0.32 * u, 0.22 * u, a, 0, FULL);
                F(c1);
              }
              circle(0, 0, 0.22);
              F(c2);
              break;
            case 'book':
              poly([
                [-0.9, -0.5],
                [-0.1, -0.35],
                [0, -0.3],
                [0.1, -0.35],
                [0.9, -0.5],
                [0.9, 0.55],
                [0.05, 0.7],
                [-0.05, 0.7],
                [-0.9, 0.55],
              ]);
              F(c1);
              line([
                [0, -0.3],
                [0, 0.7],
              ]);
              S(c2, 0.06);
              break;
            case 'scissors':
              for (const side of [-1, 1]) {
                circle(side * 0.35, 0.55, 0.22);
                S(c1, 0.1);
                line([
                  [side * 0.25, 0.35],
                  [-side * 0.25, -0.85],
                ]);
                S(c1, 0.13);
              }
              break;
            case 'tyre':
              circle(0, 0, 0.62);
              S(c1, 0.3);
              circle(0, 0, 0.22);
              F(c2);
              break;
            case 'note':
              g.beginPath();
              g.ellipse(-0.3 * u, 0.55 * u, 0.26 * u, 0.2 * u, -0.4, 0, FULL);
              F(c1);
              g.beginPath();
              g.ellipse(0.5 * u, 0.4 * u, 0.26 * u, 0.2 * u, -0.4, 0, FULL);
              F(c1);
              line([
                [-0.08, 0.5],
                [-0.08, -0.7],
                [0.72, -0.85],
                [0.72, 0.35],
              ]);
              S(c1, 0.1);
              break;
            case 'wheat':
              line([
                [0, 0.9],
                [0, -0.8],
              ]);
              S(c1, 0.08);
              for (let k = 0; k < 4; k++)
                for (const side of [-1, 1]) {
                  g.beginPath();
                  g.ellipse(side * 0.16 * u, (-0.6 + k * 0.28) * u, 0.1 * u, 0.2 * u, side * 0.5, 0, FULL);
                  F(c1);
                }
              break;
            case 'tape':
              g.beginPath();
              g.roundRect(-0.9 * u, -0.55 * u, 1.8 * u, 1.1 * u, 0.08 * u);
              F(c1);
              for (const dx of [-0.4, 0.4]) {
                circle(dx, -0.05, 0.2);
                tube ? g.stroke() : F(c2);
              }
              g.beginPath();
              g.rect(-0.6 * u, 0.25 * u, 1.2 * u, 0.2 * u);
              tube ? g.stroke() : F(c2);
              break;
            case 'joystick':
              g.beginPath();
              g.roundRect(-0.7 * u, 0.35 * u, 1.4 * u, 0.45 * u, 0.1 * u);
              F(c1);
              line([
                [0, 0.4],
                [0.15, -0.35],
              ]);
              S(c1, 0.12);
              circle(0.17, -0.5, 0.24);
              F(c2);
              break;
            case 'bubbles':
              for (const [bx, by, r] of [
                [-0.4, 0.3, 0.38],
                [0.3, -0.1, 0.3],
                [0.1, 0.6, 0.18],
                [-0.2, -0.55, 0.22],
                [0.62, 0.45, 0.14],
              ]) {
                circle(bx, by, r);
                S(c1, 0.08);
              }
              break;
            case 'leaf':
              g.beginPath();
              g.moveTo(-0.7 * u, 0.7 * u);
              g.quadraticCurveTo(-0.6 * u, -0.7 * u, 0.8 * u, -0.8 * u);
              g.quadraticCurveTo(0.7 * u, 0.6 * u, -0.7 * u, 0.7 * u);
              F(c1);
              line([
                [-0.8, 0.8],
                [0.5, -0.5],
              ]);
              S(c2, 0.06);
              break;
            case 'tree':
              for (let k = 0; k < 3; k++) {
                poly([
                  [0, -0.95 + k * 0.4],
                  [-0.45 - k * 0.14, -0.3 + k * 0.4],
                  [0.45 + k * 0.14, -0.3 + k * 0.4],
                ]);
                F(c1);
              }
              g.beginPath();
              g.rect(-0.1 * u, 0.5 * u, 0.2 * u, 0.4 * u);
              F(c2);
              break;
            case 'mountain':
              poly([
                [-0.95, 0.6],
                [-0.3, -0.5],
                [0.05, 0.05],
                [0.35, -0.3],
                [0.95, 0.6],
              ]);
              F(c1);
              if (!tube) {
                poly([
                  [-0.3, -0.5],
                  [-0.12, -0.2],
                  [-0.3, -0.12],
                  [-0.46, -0.24],
                ]);
                F(c2);
              }
              break;
            case 'hanger':
              line([
                [0, -0.3],
                [0, -0.5],
              ]);
              S(c1, 0.08);
              g.beginPath();
              g.arc(0.12 * u, -0.6 * u, 0.13 * u, Math.PI, Math.PI * 2.2);
              S(c1, 0.08);
              poly([
                [0, -0.3],
                [0.85, 0.35],
                [-0.85, 0.35],
              ]);
              S(c1, 0.09);
              break;
            case 'flame':
              g.beginPath();
              g.moveTo(0, 0.85 * u);
              g.bezierCurveTo(-0.8 * u, 0.7 * u, -0.5 * u, -0.1 * u, -0.1 * u, -0.9 * u);
              g.bezierCurveTo(0, -0.3 * u, 0.5 * u, -0.4 * u, 0.3 * u, -0.7 * u);
              g.bezierCurveTo(0.9 * u, 0, 0.7 * u, 0.7 * u, 0, 0.85 * u);
              F(c1);
              break;
            case 'wing':
              for (let k = 0; k < 4; k++) {
                g.beginPath();
                g.moveTo(-0.8 * u, (0.1 + k * 0.12) * u);
                g.quadraticCurveTo(0, (-0.7 + k * 0.22) * u, (0.9 - k * 0.15) * u, (-0.6 + k * 0.28) * u);
                g.quadraticCurveTo(0, (-0.3 + k * 0.25) * u, -0.8 * u, (0.3 + k * 0.12) * u);
                F(c1);
              }
              break;
            case 'cigar':
              g.save();
              g.rotate(-0.35);
              g.beginPath();
              g.roundRect(-0.9 * u, -0.14 * u, 1.6 * u, 0.28 * u, 0.14 * u);
              F(c1);
              g.beginPath();
              g.rect(-0.35 * u, -0.15 * u, 0.2 * u, 0.3 * u);
              F(c2);
              g.restore();
              for (const dx of [0.75, 0.9]) {
                line([
                  [dx, -0.35],
                  [dx - 0.06, -0.6],
                  [dx + 0.04, -0.85],
                ]);
                S(c2, 0.05);
              }
              break;
            case 'taco':
              g.beginPath();
              g.arc(0, 0.35 * u, 0.8 * u, Math.PI, 0);
              g.closePath();
              F(c1);
              for (const [px, c] of [
                [-0.35, '#5fae3a'],
                [0.05, '#d8412f'],
                [0.4, '#5fae3a'],
              ]) {
                circle(px, -0.3, 0.2);
                F(tube ? c1 : c);
              }
              break;
            case 'ship':
              poly([
                [-0.9, 0.1],
                [0.9, 0.1],
                [0.65, 0.5],
                [-0.75, 0.5],
              ]);
              F(c1);
              g.beginPath();
              g.rect(-0.45 * u, -0.25 * u, 0.9 * u, 0.35 * u);
              F(c1);
              g.beginPath();
              g.rect(0.05 * u, -0.6 * u, 0.2 * u, 0.35 * u);
              F(c2);
              break;
            case 'm':
              circle(0, 0, 0.9);
              F(c1);
              if (!tube) {
                const run = strokeText('M', { cx: 0, cy: 0, maxW: u * 1.1, maxH: u * 0.95 });
                blockLetters(g, run.lines, u * 0.22, { fill: c2, cap: 'butt' });
              }
              break;
            case 'warn':
              poly([
                [0, -0.85],
                [0.9, 0.7],
                [-0.9, 0.7],
              ]);
              F(c1);
              if (!tube) {
                line([
                  [0, -0.35],
                  [0, 0.2],
                ]);
                S(c2, 0.16);
                circle(0, 0.45, 0.09);
                F(c2);
              }
              break;
            default:
              star(0, 0.05, 0.8);
              F(c1);
