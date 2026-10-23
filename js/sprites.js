// ============================================================================
// TEAM HAT TRICK (1985 Bally Sente) - Dual Mode Sprite & Rink Renderer
// Supports:
//   1. 'classic' (1985 Bally Sente faithful pixel art matching screenshots)
//   2. 'modern'  (Updated HD vector/shaded graphics toggleable anytime)
// ============================================================================

import { ArcadeFont } from './font.js';

export const PALETTE = {
  TITLE_BG: '#4DD4D4',
  SELECT_BG: '#C5C5C5',
  ICE_BG: '#C8C8C8',
  ICE_SCAR_1: '#B0B0B0',
  ICE_SCAR_2: '#A0A0A0',
  OUTER_BLUE: '#1870D8',
  BLUE_TEAM: '#1868D8',
  BLUE_LIGHT: '#58A8FF',
  BLUE_DARK: '#0C3888',
  RED_TEAM: '#E03C20',
  RED_LIGHT: '#FF7858',
  RED_DARK: '#901808',
  PURPLE_BOARD: '#8830A8',
  PURPLE_LIGHT: '#B058D0',
  PURPLE_DARK: '#581870',
  PURPLE_TEXT: '#8828B0',
  YELLOW_GOLD: '#F0B828',
  YELLOW_BRIGHT: '#FFE048',
  STICK_BROWN: '#984818',
  WHITE: '#FFFFFF',
  BLACK: '#000000'
};

// 1985 Pixel Sprite for Goalie (facing right; flipped horizontally for Red Goalie)
// Legend:
// . = transparent, K = black, B = team primary, L = team light, V = visor stripe, W = visor edge
const GOALIE_PIXEL_GRID = [
  "..KKKKKK..",
  ".KBBBBBBK.",
  "KBLLLLBBBK",
  "KBLBBBBBBK",
  "KBKWWWWKBK",
  "KBKVVVVKBK",
  "KBKWWWWKBK",
  "KBLBBBBBBK",
  "KBLLLLBBBK",
  ".KBBBBBBK.",
  "..KKKKKK.."
];

// 1985 Pixel Sprite for Skater (facing Right, matching Screenshot 2 & 3)
// 20 cols x 18 rows
// K = Black outline, B = Team body, L = Team highlight, D = Team dark
// V = Helmet visor stripe, W = Visor secondary, S = Stick brown, T = Stick tape (team color)
const SKATER_PIXEL_GRID = [
  "....KKK.............",
  "...KBBBK............",
  "...KBLLBK...........",
  "...KBBBBKK..........",
  "..KKKKKKKKK.........",
  ".KKWWWWWWWKK........",
  ".KWVVVVVVVWK.KK.....",
  ".KKWWWWWWWKKKBBK....",
  "..KKKKKKKKKKBBLBK...",
  "..KBBBBBBBBBBBLBK...",
  "..KBLLLLBBBBBBBK....",
  "...KBBBBBBBBBBKSS...",
  "....KKKKKKKKKK..SS..",
  ".................SS.",
  "..................SS",
  "..................TT",
  "..................SS",
  "..................KK"
];

// Trophy icon (Screenshot 4 GAME STATS)
const TROPHY_PIXEL_GRID = [
  ".YYYYYYYY.",
  "KYYYYYYYYK",
  "KYWYYYYYYK",
  ".KYYYYYYK.",
  "..KYYYYK..",
  "...KYYK...",
  "...KYYK...",
  "..KYYYYK..",
  ".KKKKKKKK.",
  ".KYYYYYYK.",
  ".KKKKKKKK."
];

// Zamboni 1985 Pixel Sprite (Square boxy design matching Screenshot 4!)
// 24 cols x 22 rows (nearly square with circular turret ring, red cockpit & driver)
// Y = Yellow body, O = Orange/gold shade, K = Black outline/ticks,
// R = Red cockpit, B = Blue driver uniform, W = Light blue helmet/trim, P = Peach face
const ZAMBONI_PIXEL_GRID = [
  "..KKKKKKKKKKKKKKKKKKKK..",
  ".KYYYYYYYYYYYYYYYYYYYYK.",
  "KYYOOOOOOOOOOOOOOOOOOYYK",
  "KYOKKKKKKKYYYYKKKKKKKOYK",
  "KYOKYYYYYKKKKKKYYYYYKOYY",
  "KYOKYYYKKYYKKYYKKYYYKOYY",
  "KYOKYYKYYKKKKKKYYKYYKOYY",
  "KYOKYKYKKRRRRRRKKYKYKOYY",
  "KYOKYKYKRRRRRRRRKYKYKOYY",
  "KYOKYKKRRKBBBBKRRKKYKOYY",
  "KYOKYKKRKBPPPPWBKRKYKOYY",
  "KYOKYKKRKBPPPPWBKRKYKOYY",
  "KYOKYKKRRKBBBBKRRKKYKOYY",
  "KYOKYKYKRRRRRRRRKYKYKOYY",
  "KYOKYKYKKRRRRRRKKYKYKOYY",
  "KYOKYYKYYKKKKKKYYKYYKOYY",
  "KYOKYYYKKYYKKYYKKYYYKOYY",
  "KYOKYYYYYKKKKKKYYYYYKOYY",
  "KYOKKKKKKKYYYYKKKKKKKOYK",
  "KYYOOOOOOOOOOOOOOOOOOYYK",
  ".KYYYYYYYYYYYYYYYYYYYYK.",
  "..KKKKKKKKKKKKKKKKKKKK.."
];

export class SpriteRenderer {
  /**
   * Draw the Title Screen Logo ("TEAM HAT TRICK")
   */
  static drawTitleLogo(ctx, centerX, topY, mode = 'classic') {
    if (mode === 'modern') {
      this.drawModernTitleLogo(ctx, centerX, topY);
      return;
    }

    ctx.save();
    // 1. Golden pill oval at top for "TEAM"
    const pillW = 390;
    const pillH = 66;
    const pillX = centerX - pillW / 2 + 12;
    const pillY = topY;

    // Outer gold border
    this.drawPixelRoundedRect(ctx, pillX, pillY, pillW, pillH, 33, '#F8B828', '#FFE068', 5);
    // White specular curved gleams on left and right of pill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pillX + 16, pillY + 14, 6, 6);
    ctx.fillRect(pillX + 22, pillY + 10, 8, 5);
    ctx.fillRect(pillX + pillW - 26, pillY + 14, 6, 6);
    ctx.fillRect(pillX + pillW - 20, pillY + 18, 5, 6);

    // Subtle orange horizontal speed lines inside pill
    ctx.fillStyle = '#E08818';
    ctx.fillRect(pillX + 35, pillY + 48, pillW - 70, 3);

    // 2. Draw "TEAM" in 3D striped block font inside the pill
    this.drawStripedBlockWord(ctx, 'TEAM', centerX + 8, pillY + 8, {
      charW: 66,
      charH: 50,
      slant: 0.38,
      depthX: 10,
      depthY: 6,
      stripeMode: 'team' // Red & white stripes
    });

    // 3. Draw "HAT" shifted left
    this.drawStripedBlockWord(ctx, 'HAT', centerX - 140, pillY + 66, {
      charW: 88,
      charH: 66,
      slant: 0.42,
      depthX: 14,
      depthY: 8,
      stripeMode: 'hattrick' // Red/white top, blue/white bottom
    });

    // 4. Draw "TRICK" shifted right below HAT
    this.drawStripedBlockWord(ctx, 'TRICK', centerX + 55, pillY + 134, {
      charW: 88,
      charH: 66,
      slant: 0.42,
      depthX: 14,
      depthY: 8,
      stripeMode: 'hattrick'
    });

    ctx.restore();
  }

  static drawPixelRoundedRect(ctx, x, y, w, h, r, fill, border, borderW = 4) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = border;
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + borderW, y + borderW, w - borderW * 2, h - borderW * 2, Math.max(4, r - borderW));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Renders the iconic 1985 Bally Sente striped 3D slanted block letters
   * for TEAM, HAT, TRICK
   */
  static drawStripedBlockWord(ctx, word, centerX, topY, opts) {
    const { charW, charH, slant, depthX, depthY, stripeMode } = opts;
    const spacing = charW * 0.94;
    const totalW = word.length * spacing;
    const startX = centerX - totalW / 2;

    // Define vector polygon strokes for blocky serif arcade letters (normalized 0..1)
    const LETTER_POLYS = {
      T: [
        [[0.0, 0.0], [1.0, 0.0], [1.0, 0.26], [0.66, 0.26], [0.66, 0.85], [0.74, 0.85], [0.74, 1.0], [0.26, 1.0], [0.26, 0.85], [0.34, 0.85], [0.34, 0.26], [0.0, 0.26]]
      ],
      E: [
        [[0.02, 0.0], [0.98, 0.0], [0.98, 0.24], [0.38, 0.24], [0.38, 0.40], [0.84, 0.40], [0.84, 0.60], [0.38, 0.60], [0.38, 0.76], [0.98, 0.76], [0.98, 1.0], [0.02, 1.0]]
      ],
      A: [
        [[0.25, 0.0], [0.82, 0.0], [1.0, 0.85], [1.04, 1.0], [0.62, 1.0], [0.58, 0.76], [0.32, 0.76], [0.26, 1.0], [-0.04, 1.0], [0.0, 0.85]],
        // Cutout hole
        [[0.38, 0.26], [0.56, 0.26], [0.58, 0.54], [0.34, 0.54]]
      ],
      M: [
        [[0.0, 0.0], [0.34, 0.0], [0.50, 0.44], [0.66, 0.0], [1.0, 0.0], [1.0, 1.0], [0.68, 1.0], [0.68, 0.42], [0.50, 0.82], [0.32, 0.42], [0.32, 1.0], [0.0, 1.0]]
      ],
      H: [
        [[0.0, 0.0], [0.40, 0.0], [0.40, 0.38], [0.60, 0.38], [0.60, 0.0], [1.0, 0.0], [1.0, 1.0], [0.60, 1.0], [0.60, 0.62], [0.40, 0.62], [0.40, 1.0], [0.0, 1.0]]
      ],
      R: [
        [[0.0, 0.0], [0.86, 0.0], [0.98, 0.16], [0.98, 0.44], [0.80, 0.56], [1.0, 1.0], [0.62, 1.0], [0.46, 0.62], [0.36, 0.62], [0.36, 1.0], [0.0, 1.0]],
        [[0.36, 0.22], [0.62, 0.22], [0.62, 0.42], [0.36, 0.42]]
      ],
      I: [
        [[0.12, 0.0], [0.88, 0.0], [0.88, 0.22], [0.68, 0.22], [0.68, 0.78], [0.88, 0.78], [0.88, 1.0], [0.12, 1.0], [0.12, 0.78], [0.32, 0.78], [0.32, 0.22], [0.12, 0.22]]
      ],
      C: [
        [[0.18, 0.0], [0.96, 0.0], [0.96, 0.32], [0.62, 0.32], [0.40, 0.24], [0.40, 0.76], [0.62, 0.68], [0.96, 0.68], [0.96, 1.0], [0.18, 1.0], [0.0, 0.80], [0.0, 0.20]]
      ],
      K: [
        [[0.0, 0.0], [0.38, 0.0], [0.38, 0.38], [0.66, 0.0], [1.0, 0.0], [0.66, 0.46], [1.02, 1.0], [0.62, 1.0], [0.38, 0.62], [0.38, 1.0], [0.0, 1.0]]
      ]
    };

    const traceLetter = (lx, ly, letter) => {
      const polys = LETTER_POLYS[letter];
      if (!polys) return;
      ctx.beginPath();
      polys.forEach((ring, idx) => {
        ring.forEach(([nx, ny], pIdx) => {
          const sx = lx + nx * charW + (1 - ny) * charH * slant;
          const sy = ly + ny * charH;
          if (pIdx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
      });
    };

    // Pass 1: Draw 3D black drop extrusion for all letters
    ctx.fillStyle = '#000000';
    for (let i = 0; i < word.length; i++) {
      const lx = startX + i * spacing;
      for (let d = Math.max(depthX, depthY); d >= 1; d--) {
        const dx = (d / Math.max(depthX, depthY)) * depthX;
        const dy = (d / Math.max(depthX, depthY)) * depthY;
        traceLetter(lx + dx, topY + dy, word[i]);
        ctx.fill('evenodd');
      }
    }

    // Pass 2: Draw striped interior clipped to each letter
    for (let i = 0; i < word.length; i++) {
      const lx = startX + i * spacing;
      ctx.save();
      traceLetter(lx, topY, word[i]);
      ctx.clip('evenodd');

      const bandH = 3.5;
      const numBands = Math.ceil(charH / bandH);
      for (let b = 0; b < numBands; b++) {
        const by = topY + b * bandH;
        const frac = b / numBands;
        if (stripeMode === 'team') {
          // Red, white, black horizontal scanlines
          if (b % 3 === 0) ctx.fillStyle = '#E03018';
          else if (b % 3 === 1) ctx.fillStyle = '#FFFFFF';
          else ctx.fillStyle = '#901808';
        } else {
          // HAT TRICK: top/middle has red & white stripes, bottom has blue & white stripes
          const isBlueZone = (frac > 0.25 && frac < 0.42) || frac > 0.62;
          if (b % 3 === 0) {
            ctx.fillStyle = isBlueZone ? '#1838D8' : '#E03018';
          } else if (b % 3 === 1) {
            ctx.fillStyle = '#FFFFFF';
          } else {
            ctx.fillStyle = isBlueZone ? '#0C1888' : '#000000';
          }
        }
        ctx.fillRect(lx - 20, by, charW + charH * slant + 40, bandH + 0.5);
      }

      // Crisp black outline around letter face
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      traceLetter(lx, topY, word[i]);
      ctx.stroke();
      ctx.restore();
    }
  }

  static drawModernTitleLogo(ctx, centerX, topY) {
    ctx.save();
    // Sleek glowing pill badge for TEAM
    const pillW = 390;
    const pillH = 66;
    const pillX = centerX - pillW / 2 + 12;
    const pillY = topY;

    const grad = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
    grad.addColorStop(0, '#FFE878');
    grad.addColorStop(0.5, '#F8B020');
    grad.addColorStop(1, '#C87800');

    ctx.shadowColor = 'rgba(255, 200, 40, 0.6)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 33);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.shadowBlur = 0;

    this.drawStripedBlockWord(ctx, 'TEAM', centerX + 8, pillY + 8, {
      charW: 66,
      charH: 50,
      slant: 0.38,
      depthX: 10,
      depthY: 6,
      stripeMode: 'team'
    });
    this.drawStripedBlockWord(ctx, 'HAT', centerX - 140, pillY + 66, {
      charW: 88,
      charH: 66,
      slant: 0.42,
      depthX: 14,
      depthY: 8,
      stripeMode: 'hattrick'
    });
    this.drawStripedBlockWord(ctx, 'TRICK', centerX + 55, pillY + 134, {
      charW: 88,
      charH: 66,
      slant: 0.42,
      depthX: 14,
      depthY: 8,
      stripeMode: 'hattrick'
    });
    ctx.restore();
  }

  /**
   * Draw Goalie Sprite
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - center X
   * @param {number} y - center Y
   * @param {'blue'|'red'} team
   * @param {string} mode - 'classic' | 'modern'
   * @param {number} scale
   */
  static drawGoalie(ctx, x, y, team, mode = 'classic', scale = 2.4) {
    if (mode === 'modern') {
      this.drawModernGoalie(ctx, x, y, team, scale);
      return;
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (team === 'red') {
      ctx.scale(-1, 1); // Red goalie faces left
    }

    const rows = GOALIE_PIXEL_GRID.length;
    const cols = GOALIE_PIXEL_GRID[0].length;
    const startX = -(cols * scale) / 2;
    const startY = -(rows * scale) / 2;

    const colorMap = team === 'blue' ? {
      K: '#000000',
      B: '#1868D8',
      L: '#58B0FF',
      V: '#FFFFFF',
      W: '#58B0FF'
    } : {
      K: '#000000',
      B: '#E03C20',
      L: '#FF7858',
      V: '#F8D020',
      W: '#901808'
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = GOALIE_PIXEL_GRID[r][c];
        if (ch !== '.' && colorMap[ch]) {
          ctx.fillStyle = colorMap[ch];
          ctx.fillRect(
            Math.round(startX + c * scale),
            Math.round(startY + r * scale),
            Math.ceil(scale),
            Math.ceil(scale)
          );
        }
      }
    }
    ctx.restore();
  }

  static drawModernGoalie(ctx, x, y, team, scale = 2.4) {
    ctx.save();
    ctx.translate(x, y);
    if (team === 'red') ctx.scale(-1, 1);

    const primary = team === 'blue' ? '#1868D8' : '#E03C20';
    const light = team === 'blue' ? '#68B8FF' : '#FF8868';
    const visor = team === 'blue' ? '#FFFFFF' : '#FFE040';

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Goalie leg pads
    ctx.fillStyle = primary;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-10, -14, 18, 28, 6);
    ctx.fill();
    ctx.stroke();

    // Inner highlight pad
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.roundRect(-6, -11, 8, 22, 3);
    ctx.fill();

    // Goalie helmet & mask
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Visor slit
    ctx.fillStyle = visor;
    ctx.fillRect(-3, -3, 7, 6);
    ctx.strokeRect(-3, -3, 7, 6);

    ctx.restore();
  }

  /**
   * Compute the exact world (x, y) of a skater's hockey stick blade where the puck sits.
   * Matches the exact rotation/snapping and pixel coordinates of both Classic and Modern modes!
   */
  static getStickBladePosition(skater, mode = 'classic', scale = 2.35) {
    const swing = skater.swingTimer > 0 ? -0.45 : 0;

    if (mode === 'modern') {
      const rot = skater.angle + swing;
      const localX = 24.5;
      const localY = 15.0;
      return {
        x: skater.x + localX * Math.cos(rot) - localY * Math.sin(rot),
        y: skater.y + localX * Math.sin(rot) + localY * Math.cos(rot)
      };
    }

    // In 1985 Classic mode, rotation is quantized to 8 directions (multiples of PI/4)
    // Note: in drawSkater, facing pure Left (±PI) uses scale(-1, -1) + rotate(swing),
    // which is mathematically identical to rotating by PI + swing!
    const snappedAngle = Math.round(skater.angle / (Math.PI / 4)) * (Math.PI / 4);
    const rot = snappedAngle + swing;

    // In SKATER_PIXEL_GRID, torso origin is (col 8, row 8) and the stick blade/tape is at (col 18.8, row 15.5)
    const localX = (18.8 - 8) * scale;
    const localY = (15.5 - 8) * scale;

    return {
      x: skater.x + localX * Math.cos(rot) - localY * Math.sin(rot),
      y: skater.y + localX * Math.sin(rot) + localY * Math.cos(rot)
    };
  }

  /**
   * Draw Skater Sprite
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - center X
   * @param {number} y - center Y
   * @param {'blue'|'red'} team
   * @param {'defense'|'offense'} role
   * @param {number} angle - facing angle in radians (0 = Right, PI = Left)
   * @param {string} mode - 'classic' | 'modern'
   * @param {object} extra - { scale, swingOffset, stunned, humanLabel }
   */
  static drawSkater(ctx, x, y, team, role, angle = 0, mode = 'classic', extra = {}) {
    const scale = extra.scale || 2.35;
    if (mode === 'modern') {
      this.drawModernSkater(ctx, x, y, team, role, angle, scale, extra);
      return;
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    // In 1985 Classic mode, quantize angle to 8 arcade directions (or exact horizontal in Select screen)
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const swing = extra.swingOffset || 0;

    // Notice in Screenshot 2 & 3:
    // Blue faces Right (0 rad) naturally; Red faces Left (PI rad) naturally (which is flipped X & Y or mirrored X)
    if (Math.abs(snappedAngle - Math.PI) < 0.01 || Math.abs(snappedAngle + Math.PI) < 0.01) {
      // Facing pure Left: mirror horizontally and vertically like Screenshot 2 & 3 Red Skaters!
      ctx.scale(-1, -1);
      ctx.rotate(swing);
    } else {
      ctx.rotate(snappedAngle + swing);
    }

    // Exact helmet visor colors from Screenshots 2 & 3:
    // Blue Defense: White visor stripe (#FFFFFF) with cyan/blue border
    // Blue Offense: Yellow visor stripe (#F8D020) with black inner visor
    // Red Defense: Yellow visor stripe (#F8D020) with dark/black border
    // Red Offense: White/Yellow visor stripe
    let visorColor = '#FFFFFF';
    let visorBorder = '#1868D8';
    if (team === 'blue' && role === 'defense') {
      visorColor = '#FFFFFF';
      visorBorder = '#48A8FF';
    } else if (team === 'blue' && role === 'offense') {
      visorColor = '#000000';
      visorBorder = '#F8D020';
    } else if (team === 'red' && role === 'defense') {
      visorColor = '#F8D020';
      visorBorder = '#000000';
    } else if (team === 'red' && role === 'offense') {
      visorColor = '#FFFFFF';
      visorBorder = '#F8D020';
    }

    const colorMap = {
      K: '#000000',
      B: team === 'blue' ? '#1868D8' : '#E03C20',
      L: team === 'blue' ? '#58B0FF' : '#FF8060',
      V: visorColor,
      W: visorBorder,
      S: '#984818',
      T: team === 'blue' ? '#1868D8' : '#E03C20'
    };

    const rows = SKATER_PIXEL_GRID.length;
    const cols = SKATER_PIXEL_GRID[0].length;
    // Center around skater torso (col 8, row 8)
    const offsetX = -8 * scale;
    const offsetY = -8 * scale;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = SKATER_PIXEL_GRID[r][c];
        if (ch !== '.' && colorMap[ch]) {
          ctx.fillStyle = colorMap[ch];
          ctx.fillRect(
            Math.round(offsetX + c * scale),
            Math.round(offsetY + r * scale),
            Math.ceil(scale),
            Math.ceil(scale)
          );
        }
      }
    }

    ctx.restore();

    // Optional subtle P1/P2 indicator badge if enabled and during gameplay
    if (extra.humanLabel) {
      ArcadeFont.drawText(ctx, extra.humanLabel, x, y - 28, {
        color: team === 'blue' ? '#58B0FF' : '#FF8060',
        shadowColor: '#000000',
        scale: 1.2,
        align: 'center'
      });
    }
  }

  static drawModernSkater(ctx, x, y, team, role, angle, scale = 2.35, extra = {}) {
    ctx.save();
    ctx.translate(x, y);

    // Subtle glowing team ring under human-controlled players
    if (extra.humanLabel) {
      ctx.strokeStyle = team === 'blue' ? 'rgba(88, 176, 255, 0.7)' : 'rgba(255, 120, 88, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(angle + (extra.swingOffset || 0));

    const primary = team === 'blue' ? '#1868D8' : '#E03C20';
    const light = team === 'blue' ? '#58B0FF' : '#FF8060';
    const visor = role === 'defense' ? '#FFFFFF' : '#FFE040';

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hockey Stick extending forward-right
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(24, 18);
    ctx.lineTo(28, 12);
    ctx.stroke();

    // Team tape on stick blade
    ctx.strokeStyle = primary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(22, 16.5);
    ctx.lineTo(26, 15);
    ctx.stroke();

    // Shoulders / Jersey
    ctx.fillStyle = primary;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 13, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shoulder highlight stripe
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(2, -3, 5, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(-2, -1, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Helmet visor stripe
    ctx.fillStyle = visor;
    ctx.fillRect(-1, -6, 5, 10);
    ctx.strokeRect(-1, -6, 5, 10);

    ctx.restore();

    if (extra.humanLabel) {
      ArcadeFont.drawText(ctx, extra.humanLabel, x, y - 28, {
        color: '#FFFFFF',
        shadowColor: '#000000',
        scale: 1.2,
        align: 'center'
      });
    }
  }

  /**
   * Draw diagonal corner arrows on the SELECT PLAYERS NOW screen (Screenshot 2)
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {'ul'|'dl'|'ur'|'dr'} dir - up-left, down-left, up-right, down-right
   * @param {string} color
   */
  static drawDiagonalArrow(ctx, x, y, dir, color) {
    ctx.save();
    ctx.translate(x, y);
    if (dir === 'ur') ctx.scale(-1, 1);
    else if (dir === 'dl') ctx.scale(1, -1);
    else if (dir === 'dr') ctx.scale(-1, -1);

    // Pixelated arrow pointing Up-Left (↖)
    const grid = [
      "######...",
      "#####....",
      "######...",
      "##.####..",
      "#...####.",
      ".....####",
      "......##."
    ];
    const s = 3;
    ctx.fillStyle = color;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === '#') {
          ctx.fillRect((c - 4) * s, (r - 3) * s, s, s);
        }
      }
    }
    ctx.restore();
  }

  /**
   * Draw Golden Trophy on GAME STATS screen (Screenshot 4)
   */
  static drawTrophy(ctx, x, y, scale = 2.2) {
    const colorMap = {
      K: '#784800',
      Y: '#F8C828',
      W: '#FFF8A8'
    };
    const rows = TROPHY_PIXEL_GRID.length;
    const cols = TROPHY_PIXEL_GRID[0].length;
    const startX = x - (cols * scale) / 2;
    const startY = y - (rows * scale) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = TROPHY_PIXEL_GRID[r][c];
        if (ch !== '.' && colorMap[ch]) {
          ctx.fillStyle = colorMap[ch];
          ctx.fillRect(
            Math.round(startX + c * scale),
            Math.round(startY + r * scale),
            Math.ceil(scale),
            Math.ceil(scale)
          );
        }
      }
    }
  }

  /**
   * Draw the iconic square-proportioned Zamboni (Screenshot 4)
   */
  static drawZamboni(ctx, x, y, facingLeft = true, mode = 'classic', scale = 2.8) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (!facingLeft) {
      ctx.scale(-1, 1);
    }

    if (mode === 'modern') {
      // HD Square-proportioned Classic Arcade Zamboni
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-32, -29, 68, 62);

      // Left & right 6 conditioner prongs sticking out of the square body
      ctx.fillStyle = '#A03818';
      for (let i = 0; i < 6; i++) {
        const py = -22 + i * 8.2;
        ctx.fillRect(-39, py, 8, 4);
        ctx.fillRect(31, py, 8, 4);
      }

      const grad = ctx.createLinearGradient(0, -30, 0, 30);
      grad.addColorStop(0, '#FFE048');
      grad.addColorStop(0.5, '#F8B820');
      grad.addColorStop(1, '#D88010');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-33, -30, 66, 60, 5);
      ctx.fill();
      ctx.stroke();

      // Circular turret dial inside the square box
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();

      // Red oval cockpit inside turret
      ctx.fillStyle = '#E03C20';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Blue driver shoulders & peach head
      ctx.fillStyle = '#1868D8';
      ctx.beginPath();
      ctx.ellipse(2, 0, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFAA90';
      ctx.beginPath();
      ctx.arc(-2, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      return;
    }

    const colorMap = {
      K: '#000000',
      Y: '#F8C820',
      O: '#E88018',
      R: '#D83020',
      B: '#1868D8',
      W: '#78C8FF',
      P: '#FFAA90'
    };

    const rows = ZAMBONI_PIXEL_GRID.length;
    const cols = ZAMBONI_PIXEL_GRID[0].length;
    const startX = -(cols * scale) / 2;
    const startY = -(rows * scale) / 2;

    // 6 serrated conditioner prongs on left & right edges as seen in Screenshot 4
    ctx.fillStyle = '#A03818';
    for (let i = 0; i < 6; i++) {
      const py = startY + (2.5 + i * 3.1) * scale;
      ctx.fillRect(Math.round(startX - scale * 2.2), Math.round(py), Math.ceil(scale * 2.2), Math.ceil(scale * 1.4));
      ctx.fillRect(Math.round(-startX), Math.round(py), Math.ceil(scale * 2.2), Math.ceil(scale * 1.4));
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = ZAMBONI_PIXEL_GRID[r][c];
        if (ch !== '.' && colorMap[ch]) {
          ctx.fillStyle = colorMap[ch];
          ctx.fillRect(
            Math.round(startX + c * scale),
            Math.round(startY + r * scale),
            Math.ceil(scale),
            Math.ceil(scale)
          );
        }
      }
    }

    ctx.restore();
  }
}
