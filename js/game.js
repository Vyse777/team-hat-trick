// ============================================================================
// TEAM HAT TRICK (1985 Bally Sente) - Core Game Engine, Physics & Renderer
// ============================================================================

import { ArcadeFont } from './font.js';
import { SpriteRenderer, PALETTE } from './sprites.js';
import { HockeyAI } from './ai.js';

export const STATE = {
  TITLE: 'TITLE',
  SELECT: 'SELECT',
  FACEOFF: 'FACEOFF',
  PLAYING: 'PLAYING',
  GOAL_CELEBRATION: 'GOAL_CELEBRATION',
  OVERTIME_INTRO: 'OVERTIME_INTRO',
  GAME_OVER: 'GAME_OVER'
};

// Slot definitions matching Screenshot 2
export const SLOTS = [
  { id: 0, team: 'blue', role: 'defense', label: 'BLUE DEFENSE', boxX: 88, boxY: 170, boxW: 236, boxH: 92 },
  { id: 1, team: 'blue', role: 'offense', label: 'BLUE OFFENSE', boxX: 88, boxY: 308, boxW: 236, boxH: 92 },
  { id: 2, team: 'red',  role: 'defense', label: 'RED DEFENSE',  boxX: 486, boxY: 170, boxW: 236, boxH: 92 },
  { id: 3, team: 'red',  role: 'offense', label: 'RED OFFENSE',  boxX: 486, boxY: 308, boxW: 236, boxH: 92 }
];

export class TeamHatTrickGame {
  constructor(canvas, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.audio = audio;

    // Graphics mode: 'classic' (1985 Bally Sente faithful) or 'modern' (HD updated graphics)
    this.graphicsMode = 'classic';
    this.crtEnabled = true;
    this.matchDurationSeconds = 105; // 1:45 authentic regulation clock from Screenshot 3
    this.aiDifficultyFactor = 0.92;  // Normal difficulty

    // Offscreen canvas for persistent skate marks on the ice (cleared by the Zamboni!)
    this.skateCanvas = document.createElement('canvas');
    this.skateCanvas.width = 800;
    this.skateCanvas.height = 520;
    this.skateCtx = this.skateCanvas.getContext('2d');

    // Rink geometry matching Screenshot 3 & 4
    this.rink = {
      left: 56,
      right: 744,
      top: 82,
      bottom: 478,
      centerX: 400,
      centerY: 280,
      blueLineLeft: 282,
      blueLineRight: 516,
      goalTopY: 218,
      goalBottomY: 342,
      leftGoalX: 56,
      rightGoalX: 744,
      leftCreaseX: 94,
      rightCreaseX: 706,
      cornerRadius: 28
    };

    this.credits = 2;
    this.state = STATE.TITLE;
    this.stateTimer = 0;

    // Slot assignments for the 4 boxes: null = CPU, 0 = P1, 1 = P2, 2 = P3, 3 = P4
    // Default setup when entering Select screen: P1 on Blue Defense, P2 can join any slot
    this.slotAssignments = [0, null, null, null];
    // Per-controller cursor on the Select Players screen (0..3)
    this.playerCursors = [0, 2, 1, 3];
    this.playerJoined = [true, false, false, false];
    this.selectCountdown = 9;
    this.selectTickAccum = 0;

    this.resetMatchData();
  }

  setGraphicsMode(mode) {
    this.graphicsMode = mode === 'modern' ? 'modern' : 'classic';
    if (this.onSettingsChange) this.onSettingsChange();
  }

  toggleGraphicsMode() {
    this.setGraphicsMode(this.graphicsMode === 'classic' ? 'modern' : 'classic');
    return this.graphicsMode;
  }

  insertCoin() {
    this.credits = Math.min(99, this.credits + 1);
    this.audio.playCoin();
  }

  resetMatchData() {
    this.timeRemaining = this.matchDurationSeconds;
    this.isOvertime = false;
    this.faceoffPending = true;
    this.lastScorerTeam = null;
    this.goalLightTimer = 0;

    this.score = { blue: 0, red: 0 };
    this.saves = { blue: 0, red: 0 };
    this.shotsOnGoal = { blue: 0, red: 0 };
    this.possessionSeconds = { blue: 0, red: 0 };
    this.lastTouchSkater = { blue: null, red: null };
    this.assistCandidate = { blue: null, red: null };

    // Create the 2 Goalies (controlled vertically in tandem by each team's Defense controller!)
    this.blueGoalie = {
      team: 'blue',
      x: this.rink.leftCreaseX - 18,
      y: this.rink.centerY,
      vy: 0,
      radius: 15
    };
    this.redGoalie = {
      team: 'red',
      x: this.rink.rightCreaseX + 18,
      y: this.rink.centerY,
      vy: 0,
      radius: 15
    };

    // Create the 4 Skaters (Blue Def, Blue Off, Red Def, Red Off) with individual stats
    this.skaters = [
      this.createSkater(0, 'blue', 'defense', 172, 280, 0),
      this.createSkater(1, 'blue', 'offense', 322, 280, 0),
      this.createSkater(2, 'red',  'defense', 628, 280, Math.PI),
      this.createSkater(3, 'red',  'offense', 478, 280, Math.PI)
    ];

    this.puck = {
      x: this.rink.centerX,
      y: this.rink.centerY,
      vx: 0,
      vy: 0,
      radius: 5,
      owner: null,
      shotByTeam: null,
      shotCountedAsSOG: false,
      pickupCooldown: 0,
      lastCarrier: null
    };

    // Zamboni state for post-game ice resurfacing (Screenshot 4)
    this.zamboni = {
      active: false,
      x: 700,
      y: 162,
      vx: -115,
      facingLeft: true,
      rowIndex: 0,
      passYs: [115, 165, 215, 265, 315, 365, 415, 452]
    };
  }

  createSkater(id, team, role, startX, startY, startAngle) {
    return {
      id,
      team,
      role,
      startX,
      startY,
      startAngle,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      angle: startAngle,
      radius: 15,
      humanPlayer: this.slotAssignments[id], // null for CPU, or 0..3 for P1..P4
      possessionTime: 0,
      swingTimer: 0,
      stunTimer: 0,
      checkCooldown: 0,
      stats: {
        goals: 0,
        assists: 0,
        faceoffsWon: 0,
        viciousChecks: 0
      }
    };
  }

  clearIceMarks() {
    this.skateCtx.clearRect(0, 0, this.skateCanvas.width, this.skateCanvas.height);
  }

  addSkateMark(x, y, angle, intensity = 1) {
    if (x < this.rink.left + 8 || x > this.rink.right - 8 || y < this.rink.top + 8 || y > this.rink.bottom - 8) {
      return;
    }
    this.skateCtx.fillStyle = Math.random() < 0.5 ? PALETTE.ICE_SCAR_1 : PALETTE.ICE_SCAR_2;
    const perpX = -Math.sin(angle) * 5;
    const perpY = Math.cos(angle) * 5;
    // Two skate blade tracks
    this.skateCtx.fillRect(Math.round(x + perpX), Math.round(y + perpY), 2 * intensity, 2);
    this.skateCtx.fillRect(Math.round(x - perpX), Math.round(y - perpY), 2 * intensity, 2);
  }

  // ==========================================================================
  // STATE TRANSITIONS
  // ==========================================================================

  goToSelectScreen() {
    this.audio.stopZamboniTune();
    if (this.credits <= 0) {
      this.credits = 1;
    }
    this.state = STATE.SELECT;
    this.selectCountdown = 9;
    this.selectTickAccum = 0;

    // Ensure P1 is active on whatever slot was previously chosen (or Slot 0 Blue Defense)
    if (!this.slotAssignments.some(a => a !== null)) {
      this.slotAssignments = [0, null, null, null];
      this.playerJoined = [true, false, false, false];
      this.playerCursors = [0, 2, 1, 3];
    }
    this.audio.playSelect();
  }

  startMatch() {
    this.audio.stopZamboniTune();
    if (this.credits > 0) {
      this.credits--;
    }
    this.clearIceMarks();
    this.resetMatchData();
    // Apply chosen human/CPU slot assignments
    for (let i = 0; i < 4; i++) {
      this.skaters[i].humanPlayer = this.slotAssignments[i];
    }
    this.beginFaceoff();
  }

  beginFaceoff() {
    this.state = STATE.FACEOFF;
    this.stateTimer = 1.15;
    this.faceoffPending = true;

    for (const s of this.skaters) {
      s.x = s.startX;
      s.y = s.startY;
      s.vx = 0;
      s.vy = 0;
      s.angle = s.startAngle;
      s.stunTimer = 0;
      s.swingTimer = 0;
      s.possessionTime = 0;
    }
    this.blueGoalie.y = this.rink.centerY;
    this.redGoalie.y = this.rink.centerY;

    this.puck.x = this.rink.centerX;
    this.puck.y = this.rink.centerY;
    this.puck.vx = 0;
    this.puck.vy = 0;
    this.puck.owner = null;
    this.puck.shotByTeam = null;
    this.puck.shotCountedAsSOG = false;
    this.puck.pickupCooldown = 0;

    this.audio.playWhistle();
  }

  triggerGoal(scoringTeam) {
    this.score[scoringTeam]++;
    this.lastScorerTeam = scoringTeam;
    this.goalLightTimer = 2.4;

    // Count as a Shot on Goal if not already counted
    if (!this.puck.shotCountedAsSOG) {
      this.shotsOnGoal[scoringTeam]++;
      this.puck.shotCountedAsSOG = true;
    }

    // Credit Goal & Assist to the individual skaters
    const scorer = this.lastTouchSkater[scoringTeam] ||
      this.skaters.find(s => s.team === scoringTeam && s.role === 'offense');
    if (scorer) {
      scorer.stats.goals++;
    }
    const assister = this.assistCandidate[scoringTeam];
    if (assister && scorer && assister.id !== scorer.id) {
      assister.stats.assists++;
    }

    this.puck.owner = null;
    this.puck.vx *= 0.25;
    this.puck.vy *= 0.25;

    this.audio.playGoalFanfare();

    // If scored in sudden-death Overtime, game ends immediately!
    if (this.isOvertime) {
      this.state = STATE.GOAL_CELEBRATION;
      this.stateTimer = 2.2;
      this.endAfterCelebration = true;
    } else {
      this.state = STATE.GOAL_CELEBRATION;
      this.stateTimer = 2.2;
      this.endAfterCelebration = false;
    }
  }

  enterGameOver() {
    this.state = STATE.GAME_OVER;
    this.stateTimer = 0;
    this.puck.owner = null;
    this.audio.playBuzzer();

    // Start the Zamboni at row 1 (matching Screenshot 4 where it sweeps across the ice!)
    this.zamboni.active = true;
    this.zamboni.rowIndex = 1;
    this.zamboni.x = this.rink.right - 25;
    this.zamboni.y = this.zamboni.passYs[1];
    this.zamboni.facingLeft = true;
    this.zamboni.vx = -110;

    // Clear the top strip already passed (so it looks just like Screenshot 4 as it sweeps!)
    this.skateCtx.clearRect(this.rink.left, this.rink.top, this.rink.right - this.rink.left, 58);

    setTimeout(() => {
      if (this.state === STATE.GAME_OVER) {
        this.audio.startZamboniTune();
      }
    }, 900);
  }

  // ==========================================================================
  // UPDATE LOOP
  // ==========================================================================

  update(dt) {
    // Global hotkeys
    if (this.input.wasKeyJustPressed('KeyC') || this.input.wasKeyJustPressed('Digit5')) {
      this.insertCoin();
    }
    if (this.input.wasKeyJustPressed('KeyG')) {
      this.toggleGraphicsMode();
    }

    switch (this.state) {
      case STATE.TITLE:
        this.updateTitle(dt);
        break;
      case STATE.SELECT:
        this.updateSelect(dt);
        break;
      case STATE.FACEOFF:
        this.updateFaceoff(dt);
        break;
      case STATE.PLAYING:
        this.updatePlaying(dt);
        break;
      case STATE.GOAL_CELEBRATION:
        this.updateGoalCelebration(dt);
        break;
      case STATE.OVERTIME_INTRO:
        this.updateOvertimeIntro(dt);
        break;
      case STATE.GAME_OVER:
        this.updateGameOver(dt);
        break;
    }

    this.input.clearFrame();
  }

  updateTitle(dt) {
    this.stateTimer += dt;
    const clicks = this.input.consumeClicks();
    let startTriggered = clicks.length > 0;

    for (let p = 0; p < 4; p++) {
      if (this.input.getControllerState(p).shootJustPressed) {
        startTriggered = true;
      }
    }
    if (this.input.wasKeyJustPressed('Digit1') || this.input.wasKeyJustPressed('Digit2')) {
      startTriggered = true;
    }

    if (startTriggered) {
      this.goToSelectScreen();
    }
  }

  updateSelect(dt) {
    // Allow number keys 1, 2, 3, 4 to directly cycle the 4 boxes (CPU -> P1 -> P2 -> P3 -> P4 -> CPU)
    const digitKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    digitKeys.forEach((code, slotIdx) => {
      if (this.input.wasKeyJustPressed(code)) {
        this.cycleSlotAssignment(slotIdx);
      }
    });

    // Mouse clicks on any of the 4 boxes or Start button
    const clicks = this.input.consumeClicks();
    for (const click of clicks) {
      let hitBox = false;
      for (const slot of SLOTS) {
        if (
          click.x >= slot.boxX &&
          click.x <= slot.boxX + slot.boxW &&
          click.y >= slot.boxY &&
          click.y <= slot.boxY + slot.boxH
        ) {
          this.cycleSlotAssignment(slot.id);
          hitBox = true;
          break;
        }
      }
      // Click center countdown / bottom area to start immediately
      if (!hitBox && click.y > 430 && click.x > 260 && click.x < 540) {
        this.startMatch();
        return;
      }
    }

    // Handle P1..P4 controller navigation between the 4 boxes:
    // Top-left (0: Blue Def), Bottom-left (1: Blue Off), Top-right (2: Red Def), Bottom-right (3: Red Off)
    for (let p = 0; p < 4; p++) {
      const ctrl = this.input.getControllerState(p);
      const currentSlot = this.slotAssignments.indexOf(p);

      if (ctrl.upJust || ctrl.downJust || ctrl.leftJust || ctrl.rightJust) {
        let targetSlot = currentSlot !== -1 ? currentSlot : this.playerCursors[p];
        const isRight = targetSlot >= 2;
        const isBottom = targetSlot % 2 === 1;

        let newRight = isRight;
        let newBottom = isBottom;
        if (ctrl.leftJust) newRight = false;
        if (ctrl.rightJust) newRight = true;
        if (ctrl.upJust) newBottom = false;
        if (ctrl.downJust) newBottom = true;

        const nextSlot = (newRight ? 2 : 0) + (newBottom ? 1 : 0);
        this.playerCursors[p] = nextSlot;

        // Move this player's assignment to the target box if it's free (or swap)
        this.assignPlayerToSlot(p, nextSlot);
        this.audio.playSelect();
        // Reset countdown slightly so players have time when actively choosing
        this.selectCountdown = Math.max(this.selectCountdown, 5);
      } else if (ctrl.shootJustPressed) {
        if (currentSlot === -1) {
          // Join into cursor slot (or first free slot)
          let target = this.playerCursors[p];
          if (this.slotAssignments[target] !== null && this.slotAssignments[target] !== p) {
            const freeIdx = this.slotAssignments.findIndex(a => a === null);
            if (freeIdx !== -1) target = freeIdx;
          }
          this.assignPlayerToSlot(p, target);
          this.audio.playSelect();
          this.selectCountdown = Math.max(this.selectCountdown, 5);
        } else {
          // Pressing Shoot when already assigned speeds up countdown or starts if held/pressed
          if (this.selectCountdown <= 7) {
            this.startMatch();
            return;
          }
        }
      }
    }

    // Countdown timer 9..0
    this.selectTickAccum += dt;
    if (this.selectTickAccum >= 1.0) {
      this.selectTickAccum -= 1.0;
      this.selectCountdown--;
      if (this.selectCountdown >= 0) {
        this.audio.playTick();
      }
      if (this.selectCountdown < 0) {
        this.startMatch();
      }
    }
  }

  assignPlayerToSlot(playerIdx, slotIdx) {
    // Remove playerIdx from any existing slot
    for (let i = 0; i < 4; i++) {
      if (this.slotAssignments[i] === playerIdx) {
        this.slotAssignments[i] = null;
      }
    }
    this.slotAssignments[slotIdx] = playerIdx;
    this.playerJoined[playerIdx] = true;
  }

  cycleSlotAssignment(slotIdx) {
    const current = this.slotAssignments[slotIdx];
    // Cycle: null (CPU) -> 0 (P1) -> 1 (P2) -> 2 (P3) -> 3 (P4) -> null (CPU)
    const order = [null, 0, 1, 2, 3];
    const curPos = order.indexOf(current);
    for (let step = 1; step <= order.length; step++) {
      const candidate = order[(curPos + step) % order.length];
      if (candidate === null) {
        this.slotAssignments[slotIdx] = null;
        break;
      }
      // If candidate is not yet assigned to another slot, assign it here
      if (!this.slotAssignments.includes(candidate)) {
        this.slotAssignments[slotIdx] = candidate;
        break;
      }
    }
    this.audio.playSelect();
    this.selectCountdown = Math.max(this.selectCountdown, 6);
  }

  updateFaceoff(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = STATE.PLAYING;
      // Small random jitter on center puck drop
      this.puck.vx = (Math.random() - 0.5) * 28;
      this.puck.vy = (Math.random() - 0.5) * 45;
    }
  }

  updateGoalCelebration(dt) {
    this.stateTimer -= dt;
    this.goalLightTimer = Math.max(0, this.goalLightTimer - dt);
    // Keep puck moving slightly in net
    this.puck.x += this.puck.vx * dt;
    this.puck.y += this.puck.vy * dt;
    this.puck.vx *= 0.92;
    this.puck.vy *= 0.92;

    if (this.stateTimer <= 0) {
      if (this.endAfterCelebration) {
        this.enterGameOver();
      } else {
        this.beginFaceoff();
      }
    }
  }

  updateOvertimeIntro(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.isOvertime = true;
      this.timeRemaining = 20; // Authentic 20-second sudden-death overtime!
      this.beginFaceoff();
    }
  }

  updateGameOver(dt) {
    this.stateTimer += dt;

    // Move the Zamboni across the ice to erase skate marks!
    if (this.zamboni.active) {
      const prevX = this.zamboni.x;
      this.zamboni.x += this.zamboni.vx * dt;

      // Clear skate marks under the Zamboni conditioner blade
      const clearW = Math.abs(this.zamboni.x - prevX) + 56;
      const clearX = Math.min(prevX, this.zamboni.x) - 28;
      this.skateCtx.clearRect(clearX, this.zamboni.y - 32, clearW, 64);

      if (this.zamboni.facingLeft && this.zamboni.x <= this.rink.left + 48) {
        this.zamboni.rowIndex++;
        if (this.zamboni.rowIndex < this.zamboni.passYs.length) {
          this.zamboni.y = this.zamboni.passYs[this.zamboni.rowIndex];
          this.zamboni.facingLeft = false;
          this.zamboni.vx = 125;
        } else {
          this.zamboni.active = false;
          this.clearIceMarks();
          this.audio.stopZamboniTune();
        }
      } else if (!this.zamboni.facingLeft && this.zamboni.x >= this.rink.right - 48) {
        this.zamboni.rowIndex++;
        if (this.zamboni.rowIndex < this.zamboni.passYs.length) {
          this.zamboni.y = this.zamboni.passYs[this.zamboni.rowIndex];
          this.zamboni.facingLeft = true;
          this.zamboni.vx = -125;
        } else {
          this.zamboni.active = false;
          this.clearIceMarks();
          this.audio.stopZamboniTune();
        }
      }
    }

    // Allow pressing Shoot or clicking after 1.5s to play again or return to Title
    if (this.stateTimer > 1.5) {
      const clicks = this.input.consumeClicks();
      let restartPressed = clicks.length > 0;
      for (let p = 0; p < 4; p++) {
        if (this.input.getControllerState(p).shootJustPressed) {
          restartPressed = true;
        }
      }
      if (restartPressed) {
        this.audio.stopZamboniTune();
        this.goToSelectScreen();
      }
    }
  }

  // ==========================================================================
  // ACTIVE HOCKEY GAMEPLAY & PHYSICS
  // ==========================================================================

  updatePlaying(dt) {
    // 1. Update Game Clock
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      if (this.score.blue === this.score.red && !this.isOvertime) {
        // Trigger Sudden Death Overtime!
        this.audio.playBuzzer();
        this.state = STATE.OVERTIME_INTRO;
        this.stateTimer = 2.0;
        return;
      } else {
        this.enterGameOver();
        return;
      }
    }

    // 2. Track Time of Possession
    if (this.puck.owner) {
      this.possessionSeconds[this.puck.owner.team] += dt;
    }

    // 3. Update Skaters & Tandem Goalies
    const maxSpeed = 195;
    const accel = 680;
    const iceFriction = 0.965;

    for (const s of this.skaters) {
      if (s.swingTimer > 0) s.swingTimer = Math.max(0, s.swingTimer - dt);
      if (s.checkCooldown > 0) s.checkCooldown = Math.max(0, s.checkCooldown - dt);

      if (s.stunTimer > 0) {
        s.stunTimer = Math.max(0, s.stunTimer - dt);
        s.angle += 9 * dt; // Spin briefly when body-checked!
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.92;
        s.vy *= 0.92;
        this.constrainSkaterToRink(s);
        this.addSkateMark(s.x, s.y, s.angle, 2);
        continue;
      }

      // Get input from assigned Human controller OR CPU AI
      const ctrl = s.humanPlayer !== null
        ? this.input.getControllerState(s.humanPlayer)
        : HockeyAI.computeInput(s, this);

      // TANDEM GOALIE CONTROL:
      // In Team Hat Trick, the Defense controller also moves that team's Goalie vertically!
      if (s.role === 'defense') {
        const goalie = s.team === 'blue' ? this.blueGoalie : this.redGoalie;
        const goalieSpeed = 175;
        goalie.vy = ctrl.dy * goalieSpeed;
        goalie.y += goalie.vy * dt;
        goalie.y = Math.max(
          this.rink.goalTopY + 18,
          Math.min(this.rink.goalBottomY - 18, goalie.y)
        );
      }

      // Skater acceleration & facing angle
      if (Math.hypot(ctrl.dx, ctrl.dy) > 0.1) {
        s.vx += ctrl.dx * accel * dt;
        s.vy += ctrl.dy * accel * dt;

        const targetAngle = Math.atan2(ctrl.dy, ctrl.dx);
        const diff = Math.atan2(Math.sin(targetAngle - s.angle), Math.cos(targetAngle - s.angle));
        s.angle += diff * Math.min(1, dt * 14);

        if (Math.random() < 0.65) {
          this.addSkateMark(s.x, s.y, s.angle, 1);
        }
      }

      // Clamp skater speed (slightly slower when carrying the puck)
      const speedLimit = this.puck.owner === s ? maxSpeed * 0.93 : maxSpeed;
      const spd = Math.hypot(s.vx, s.vy);
      if (spd > speedLimit) {
        s.vx = (s.vx / spd) * speedLimit;
        s.vy = (s.vy / spd) * speedLimit;
      }

      s.vx *= Math.pow(iceFriction, dt * 60);
      s.vy *= Math.pow(iceFriction, dt * 60);

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      this.constrainSkaterToRink(s);

      // Shoot / Pass / Body Check button action
      if (ctrl.shootJustPressed) {
        if (this.puck.owner === s) {
          this.shootOrPassPuck(s, ctrl);
        } else if (s.checkCooldown <= 0) {
          this.performBodyCheckLunge(s);
        }
      }

      if (this.puck.owner === s) {
        s.possessionTime += dt;
      } else {
        s.possessionTime = 0;
      }
    }

    // 4. Skater-vs-Skater Collisions & Vicious Checks
    this.handleSkaterCollisions();

    // 5. Update Puck Physics, Goalie Saves & Goal Detection
    this.updatePuck(dt);
  }

  shootOrPassPuck(skater, ctrl) {
    skater.swingTimer = 0.22;
    this.puck.owner = null;
    this.puck.pickupCooldown = 0.18;
    this.puck.lastCarrier = skater;
    this.puck.shotByTeam = skater.team;
    this.puck.shotCountedAsSOG = false;

    // Determine shoot direction: blend skater facing angle with controller direction
    let aimAngle = skater.angle;
    if (Math.hypot(ctrl.dx, ctrl.dy) > 0.2) {
      const stickAngle = Math.atan2(ctrl.dy, ctrl.dx);
      const diff = Math.atan2(Math.sin(stickAngle - aimAngle), Math.cos(stickAngle - aimAngle));
      if (Math.abs(diff) < 0.9) {
        aimAngle += diff * 0.5;
      }
    }

    // Smart subtle pass-assist if aimed roughly toward teammate
    const mate = this.skaters.find(m => m.team === skater.team && m.id !== skater.id);
    if (mate) {
      const toMateAngle = Math.atan2(mate.y - skater.y, mate.x - skater.x);
      const angleDiff = Math.atan2(Math.sin(toMateAngle - aimAngle), Math.cos(toMateAngle - aimAngle));
      if (Math.abs(angleDiff) < 0.36) {
        aimAngle = toMateAngle;
      }
    }

    const shotSpeed = 430;
    this.puck.vx = Math.cos(aimAngle) * shotSpeed + skater.vx * 0.35;
    this.puck.vy = Math.sin(aimAngle) * shotSpeed + skater.vy * 0.35;

    // Record potential assist if teammate receives this pass
    this.assistCandidate[skater.team] = skater;
    this.lastTouchSkater[skater.team] = skater;

    this.audio.playShoot();
  }

  performBodyCheckLunge(skater) {
    skater.swingTimer = 0.2;
    skater.checkCooldown = 0.45;
    // Burst of speed in facing direction to deliver a body check
    skater.vx += Math.cos(skater.angle) * 145;
    skater.vy += Math.sin(skater.angle) * 145;
    this.addSkateMark(skater.x, skater.y, skater.angle, 2);
  }

  handleSkaterCollisions() {
    for (let i = 0; i < this.skaters.length; i++) {
      for (let j = i + 1; j < this.skaters.length; j++) {
        const a = this.skaters[i];
        const b = this.skaters[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Check if opposing teams collided fast enough for a "VICIOUS CHECK"!
          if (a.team !== b.team) {
            const speedA = Math.hypot(a.vx, a.vy) + (a.swingTimer > 0 ? 90 : 0);
            const speedB = Math.hypot(b.vx, b.vy) + (b.swingTimer > 0 ? 90 : 0);

            if ((speedA > 145 || speedB > 145) && a.stunTimer <= 0 && b.stunTimer <= 0) {
              const hitter = speedA >= speedB ? a : b;
              const victim = hitter === a ? b : a;

              if (Math.hypot(hitter.vx, hitter.vy) > 125 || hitter.swingTimer > 0) {
                hitter.stats.viciousChecks++;
                victim.stunTimer = 0.65;
                const hitSign = hitter === a ? 1 : -1;
                victim.vx = nx * hitSign * 220;
                victim.vy = ny * hitSign * 220;

                if (this.puck.owner === victim) {
                  this.puck.owner = null;
                  this.puck.pickupCooldown = 0.25;
                  this.puck.vx = nx * hitSign * 160 + (Math.random() - 0.5) * 80;
                  this.puck.vy = ny * hitSign * 160 + (Math.random() - 0.5) * 80;
                }
                this.audio.playCheck();
              }
            }
          }

          // Elastic velocity exchange
          const kx = a.vx - b.vx;
          const ky = a.vy - b.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;
          if (p > 0) {
            a.vx -= p * nx * 0.6;
            a.vy -= p * ny * 0.6;
            b.vx += p * nx * 0.6;
            b.vy += p * ny * 0.6;
          }
        }
      }
    }
  }

  constrainSkaterToRink(s) {
    const pad = s.radius + 4;
    if (s.x < this.rink.left + pad) { s.x = this.rink.left + pad; s.vx = Math.max(0, s.vx); }
    if (s.x > this.rink.right - pad) { s.x = this.rink.right - pad; s.vx = Math.min(0, s.vx); }
    if (s.y < this.rink.top + pad) { s.y = this.rink.top + pad; s.vy = Math.max(0, s.vy); }
    if (s.y > this.rink.bottom - pad) { s.y = this.rink.bottom - pad; s.vy = Math.min(0, s.vy); }

    // Keep skaters out of the goal crease interior so goalies have room
    if (s.y > this.rink.goalTopY - 8 && s.y < this.rink.goalBottomY + 8) {
      if (s.x < this.rink.leftCreaseX + 8) {
        s.x = this.rink.leftCreaseX + 8;
        s.vx = Math.max(0, s.vx);
      }
      if (s.x > this.rink.rightCreaseX - 8) {
        s.x = this.rink.rightCreaseX - 8;
        s.vx = Math.min(0, s.vx);
      }
    }
  }

  updatePuck(dt) {
    const p = this.puck;
    if (p.pickupCooldown > 0) {
      p.pickupCooldown = Math.max(0, p.pickupCooldown - dt);
    }

    if (p.owner) {
      // Position puck on the blade of the carrier's hockey stick
      const stickDist = 23;
      const stickAngle = p.owner.angle + 0.35;
      p.x = p.owner.x + Math.cos(stickAngle) * stickDist;
      p.y = p.owner.y + Math.sin(stickAngle) * stickDist;
      p.vx = p.owner.vx;
      p.vy = p.owner.vy;
      return;
    }

    // Sub-step puck movement to prevent tunneling on fast slapshots
    const steps = 3;
    const subDt = dt / steps;
    for (let step = 0; step < steps; step++) {
      p.x += p.vx * subDt;
      p.y += p.vy * subDt;

      // Check Goal Scoring before clamping to side walls!
      const inGoalMouthY = p.y > this.rink.goalTopY + 6 && p.y < this.rink.goalBottomY - 6;

      if (inGoalMouthY && p.x <= this.rink.leftGoalX - 2) {
        // RED SCORES ON BLUE NET!
        this.triggerGoal('red');
        return;
      }
      if (inGoalMouthY && p.x >= this.rink.rightGoalX + 2) {
        // BLUE SCORES ON RED NET!
        this.triggerGoal('blue');
        return;
      }

      // Bounce off top & bottom rink boards
      if (p.y < this.rink.top + p.radius) {
        p.y = this.rink.top + p.radius;
        p.vy = Math.abs(p.vy) * 0.85;
        this.audio.playBounce();
      } else if (p.y > this.rink.bottom - p.radius) {
        p.y = this.rink.bottom - p.radius;
        p.vy = -Math.abs(p.vy) * 0.85;
        this.audio.playBounce();
      }

      // Bounce off left & right rink boards (outside goal mouth)
      if (!inGoalMouthY) {
        if (p.x < this.rink.left + p.radius) {
          p.x = this.rink.left + p.radius;
          p.vx = Math.abs(p.vx) * 0.85;
          this.audio.playBounce();
        } else if (p.x > this.rink.right - p.radius) {
          p.x = this.rink.right - p.radius;
          p.vx = -Math.abs(p.vx) * 0.85;
          this.audio.playBounce();
        }
      }

      // Check Goalie Saves!
      this.checkGoalieSave(this.blueGoalie);
      this.checkGoalieSave(this.redGoalie);
    }

    // Gentle ice friction on loose puck
    p.vx *= Math.pow(0.991, dt * 60);
    p.vy *= Math.pow(0.991, dt * 60);

    // Check Skater Puck Pickup
    for (const s of this.skaters) {
      if (s.stunTimer > 0) continue;
      if (p.pickupCooldown > 0 && p.lastCarrier === s) continue;

      const stickX = s.x + Math.cos(s.angle + 0.3) * 16;
      const stickY = s.y + Math.sin(s.angle + 0.3) * 16;
      const distBody = Math.hypot(p.x - s.x, p.y - s.y);
      const distStick = Math.hypot(p.x - stickX, p.y - stickY);

      if (distBody < s.radius + p.radius + 4 || distStick < 16) {
        // Claim possession!
        if (this.faceoffPending) {
          s.stats.faceoffsWon++;
          this.faceoffPending = false;
        }

        // If opposing team intercepted the puck, clear the other team's assist candidate
        const oppTeam = s.team === 'blue' ? 'red' : 'blue';
        this.assistCandidate[oppTeam] = null;

        p.owner = s;
        p.shotByTeam = null;
        p.shotCountedAsSOG = false;
        this.lastTouchSkater[s.team] = s;
        break;
      }
    }
  }

  checkGoalieSave(goalie) {
    const p = this.puck;
    const dx = p.x - goalie.x;
    const dy = p.y - goalie.y;
    const dist = Math.hypot(dx, dy);

    if (dist < goalie.radius + p.radius + 2) {
      const isBlueGoalie = goalie.team === 'blue';
      // Credit a Save & Shot on Goal if the puck was moving toward this net
      const movingTowardNet = isBlueGoalie ? p.vx < -25 : p.vx > 25;
      const shootingTeam = isBlueGoalie ? 'red' : 'blue';

      if (movingTowardNet) {
        this.saves[goalie.team]++;
        if (!p.shotCountedAsSOG) {
          this.shotsOnGoal[shootingTeam]++;
          p.shotCountedAsSOG = true;
        }
      }

      // Rebound puck outward away from net
      const reboundDirX = isBlueGoalie ? 1 : -1;
      const speed = Math.max(190, Math.hypot(p.vx, p.vy) * 0.75);
      const spreadY = (dy / goalie.radius) * 160 + (Math.random() - 0.5) * 60;
      p.vx = reboundDirX * speed;
      p.vy = spreadY;
      p.x = goalie.x + reboundDirX * (goalie.radius + p.radius + 4);
      this.audio.playSave();
    }
  }

  // ==========================================================================
  // RENDERING PIPELINE (Matches All 4 Screenshots + Modern HD Toggle)
  // ==========================================================================

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = this.graphicsMode === 'modern';

    switch (this.state) {
      case STATE.TITLE:
        this.renderTitleScreen(ctx);
        break;
      case STATE.SELECT:
        this.renderSelectScreen(ctx);
        break;
      case STATE.FACEOFF:
      case STATE.PLAYING:
      case STATE.GOAL_CELEBRATION:
      case STATE.OVERTIME_INTRO:
        this.renderGameplayScreen(ctx);
        break;
      case STATE.GAME_OVER:
        this.renderGameOverScreen(ctx);
        break;
    }

    ctx.restore();
  }

  /**
   * SCREENSHOT 1: Title Screen ("TEAM HAT TRICK © 1985 BALLY SENTE")
   */
  renderTitleScreen(ctx) {
    // 1. Cyan background matching Screenshot 1
    if (this.graphicsMode === 'modern') {
      const grad = ctx.createRadialGradient(400, 220, 50, 400, 260, 480);
      grad.addColorStop(0, '#68ECEC');
      grad.addColorStop(1, '#32B4B4');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = PALETTE.TITLE_BG;
    }
    ctx.fillRect(0, 0, 800, 520);

    // 2. Main Logo: TEAM HAT TRICK
    SpriteRenderer.drawTitleLogo(ctx, 400, 74, this.graphicsMode);

    // 3. Copyright & Credit text matching Screenshot 1
    ArcadeFont.drawText(ctx, '@ 1985 BALLY SENTE', 400, 326, {
      color: '#FFFFFF',
      scale: 2.25,
      align: 'center',
      spacing: 19
    });

    ArcadeFont.drawText(ctx, '1 COIN   1 CREDIT', 400, 392, {
      color: '#1838D8',
      scale: 2.1,
      align: 'center',
      spacing: 18
    });

    ArcadeFont.drawText(ctx, '1, 2, 3, OR 4 MAY PLAY', 400, 420, {
      color: '#1838D8',
      scale: 2.1,
      align: 'center',
      spacing: 18
    });

    // Flashing interactive prompt at very bottom
    if (Math.floor(this.stateTimer * 2.5) % 2 === 0) {
      ArcadeFont.drawText(ctx, 'PRESS SHOOT OR CLICK TO PLAY', 400, 476, {
        color: '#FFFFFF',
        shadowColor: '#1838D8',
        scale: 1.6,
        align: 'center'
      });
    }
  }

  /**
   * SCREENSHOT 2: Select Players Now Screen
   */
  renderSelectScreen(ctx) {
    // 1. Light grey background
    ctx.fillStyle = PALETTE.SELECT_BG;
    ctx.fillRect(0, 0, 800, 520);

    // 2. Top Header: "SELECT PLAYERS NOW" in purple
    ArcadeFont.drawText(ctx, 'SELECT PLAYERS NOW', 400, 35, {
      color: PALETTE.PURPLE_TEXT,
      scale: 2.35,
      align: 'center',
      spacing: 20
    });

    // 3. Center Countdown Number (White)
    ArcadeFont.drawText(ctx, String(Math.max(0, this.selectCountdown)), 400, 265, {
      color: '#FFFFFF',
      scale: 2.35,
      align: 'center'
    });

    // 4. Vertical corner "PRESS SHOOT BUTTON" prompts
    ArcadeFont.drawVerticalText(ctx, 'PRESS SHOOT BUTTON', 18, 96, 'cw', {
      color: PALETTE.BLUE_TEAM,
      scale: 1.45,
      spacing: 10.2
    });
    ArcadeFont.drawVerticalText(ctx, 'PRESS SHOOT BUTTON', 18, 430, 'cw', {
      color: PALETTE.BLUE_TEAM,
      scale: 1.45,
      spacing: 10.2
    });
    ArcadeFont.drawVerticalText(ctx, 'PRESS SHOOT BUTTON', 782, 96, 'ccw', {
      color: PALETTE.RED_TEAM,
      scale: 1.45,
      spacing: 10.2
    });
    ArcadeFont.drawVerticalText(ctx, 'PRESS SHOOT BUTTON', 782, 430, 'ccw', {
      color: PALETTE.RED_TEAM,
      scale: 1.45,
      spacing: 10.2
    });

    // 5. Diagonal arrows outside the 4 boxes matching Screenshot 2
    SpriteRenderer.drawDiagonalArrow(ctx, 162, 145, 'ul', PALETTE.BLUE_TEAM);
    SpriteRenderer.drawDiagonalArrow(ctx, 162, 424, 'dl', PALETTE.BLUE_TEAM);
    SpriteRenderer.drawDiagonalArrow(ctx, 636, 145, 'ur', PALETTE.RED_TEAM);
    SpriteRenderer.drawDiagonalArrow(ctx, 636, 424, 'dr', PALETTE.RED_TEAM);

    // 6. The 4 Selection Boxes (BLUE DEFENSE, BLUE OFFENSE, RED DEFENSE, RED OFFENSE)
    for (const slot of SLOTS) {
      const isBlue = slot.team === 'blue';
      const teamColor = isBlue ? PALETTE.BLUE_TEAM : PALETTE.RED_TEAM;
      const assignedPlayer = this.slotAssignments[slot.id];

      // If assigned to a human player, show a subtle highlight fill
      if (assignedPlayer !== null) {
        ctx.fillStyle = isBlue ? 'rgba(24, 104, 216, 0.12)' : 'rgba(224, 60, 32, 0.12)';
        ctx.fillRect(slot.boxX, slot.boxY, slot.boxW, slot.boxH);
      }

      // Thick team-colored border matching Screenshot 2
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 4.5;
      ctx.strokeRect(slot.boxX, slot.boxY, slot.boxW, slot.boxH);

      // Box Title
      ArcadeFont.drawText(ctx, slot.label, slot.boxX + slot.boxW / 2, slot.boxY + 9, {
        color: teamColor,
        scale: 2.05,
        align: 'center',
        spacing: 17.5
      });

      // Sprites inside each box matching Screenshot 2:
      if (slot.id === 0) {
        // BLUE DEFENSE: Goalie on left + Blue Defense Skater on right
        SpriteRenderer.drawGoalie(ctx, slot.boxX + 47, slot.boxY + 60, 'blue', this.graphicsMode, 2.3);
        SpriteRenderer.drawSkater(ctx, slot.boxX + 142, slot.boxY + 56, 'blue', 'defense', 0, this.graphicsMode, { scale: 2.3 });
      } else if (slot.id === 1) {
        // BLUE OFFENSE: Blue Offense Skater on right
        SpriteRenderer.drawSkater(ctx, slot.boxX + 142, slot.boxY + 56, 'blue', 'offense', 0, this.graphicsMode, { scale: 2.3 });
      } else if (slot.id === 2) {
        // RED DEFENSE: Red Defense Skater on left + Goalie on right
        SpriteRenderer.drawSkater(ctx, slot.boxX + 84, slot.boxY + 56, 'red', 'defense', Math.PI, this.graphicsMode, { scale: 2.3 });
        SpriteRenderer.drawGoalie(ctx, slot.boxX + 174, slot.boxY + 60, 'red', this.graphicsMode, 2.3);
      } else if (slot.id === 3) {
        // RED OFFENSE: Red Offense Skater on left
        SpriteRenderer.drawSkater(ctx, slot.boxX + 84, slot.boxY + 56, 'red', 'offense', Math.PI, this.graphicsMode, { scale: 2.3 });
      }

      // Badge showing who controls this slot (P1, P2, P3, P4, or CPU)
      const badgeText = assignedPlayer !== null ? `P${assignedPlayer + 1} HUMAN` : 'CPU AI';
      const badgeColor = assignedPlayer !== null ? '#FFFFFF' : '#707070';
      const badgeBg = assignedPlayer !== null ? teamColor : '#B0B0B0';
      const bx = isBlue ? slot.boxX + 8 : slot.boxX + slot.boxW - 86;
      const by = slot.boxY + slot.boxH - 22;
      ctx.fillStyle = badgeBg;
      ctx.fillRect(bx, by, 78, 16);
      ArcadeFont.drawText(ctx, badgeText, bx + 39, by + 3, {
        color: badgeColor,
        scale: 1.15,
        align: 'center',
        spacing: 9
      });
    }

    // Helper instruction at bottom center for selecting same or opposite teams
    ArcadeFont.drawText(ctx, 'CLICK ANY BOX OR USE P1(WASD) / P2(ARROWS) TO PICK TEAM', 400, 456, {
      color: '#505050',
      scale: 1.25,
      align: 'center',
      spacing: 10
    });
    ArcadeFont.drawText(ctx, '[START MATCH NOW]', 400, 476, {
      color: PALETTE.PURPLE_TEXT,
      scale: 1.45,
      align: 'center',
      spacing: 12
    });

    // 7. Bottom-right "CREDITS: 1" in slanted yellow font matching Screenshot 2
    ArcadeFont.drawText(ctx, `CREDITS: ${this.credits}`, 636, 488, {
      color: PALETTE.YELLOW_GOLD,
      scale: 2.1,
      align: 'center',
      slant: 0.35,
      spacing: 18
    });
  }

  /**
   * SCREENSHOT 3: Active Rink, Scoreboard, 6 Players (2 Goalies + 4 Skaters) & Puck
   */
  renderGameplayScreen(ctx) {
    this.renderRinkAndScoreboard(ctx);

    // Draw Puck
    const p = this.puck;
    ctx.save();
    if (this.graphicsMode === 'modern') {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
    }
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw the 2 Goalies (controlled by each team's Defense controller!)
    SpriteRenderer.drawGoalie(ctx, this.blueGoalie.x, this.blueGoalie.y, 'blue', this.graphicsMode);
    SpriteRenderer.drawGoalie(ctx, this.redGoalie.x, this.redGoalie.y, 'red', this.graphicsMode);

    // Draw the 4 Skaters (2 Offense, 2 Defense)
    for (const s of this.skaters) {
      const swingOffset = s.swingTimer > 0 ? -0.45 : 0;
      const humanLabel = s.humanPlayer !== null ? `P${s.humanPlayer + 1}` : null;
      SpriteRenderer.drawSkater(ctx, s.x, s.y, s.team, s.role, s.angle, this.graphicsMode, {
        swingOffset,
        humanLabel
      });
    }

    // Goal Celebration Banner
    if (this.state === STATE.GOAL_CELEBRATION && this.lastScorerTeam) {
      const bannerColor = this.lastScorerTeam === 'blue' ? PALETTE.BLUE_TEAM : PALETTE.RED_TEAM;
      ctx.fillStyle = '#000000';
      ctx.fillRect(265, 250, 270, 44);
      ctx.strokeStyle = bannerColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(265, 250, 270, 44);
      ArcadeFont.drawText(ctx, `${this.lastScorerTeam.toUpperCase()} SCORES!`, 400, 264, {
        color: PALETTE.YELLOW_GOLD,
        scale: 2.2,
        align: 'center'
      });
    }

    // Overtime Intro Banner
    if (this.state === STATE.OVERTIME_INTRO) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(245, 248, 310, 48);
      ctx.strokeStyle = PALETTE.PURPLE_BOARD;
      ctx.lineWidth = 3;
      ctx.strokeRect(245, 248, 310, 48);
      ArcadeFont.drawText(ctx, 'SUDDEN DEATH OVERTIME', 400, 264, {
        color: PALETTE.YELLOW_GOLD,
        scale: 1.9,
        align: 'center'
      });
    }
  }

  /**
   * SCREENSHOT 4: Post-Game Stats Overlay + Zamboni Clearing the Ice
   */
  renderGameOverScreen(ctx) {
    this.renderRinkAndScoreboard(ctx);

    // 1. Draw the Zamboni driving across the ice clearing the skate marks!
    if (this.zamboni.active) {
      SpriteRenderer.drawZamboni(
        ctx,
        this.zamboni.x,
        this.zamboni.y,
        this.zamboni.facingLeft,
        this.graphicsMode,
        2.6
      );
    }

    // 2. Render "GAME STATS" table over the ice matching Screenshot 4
    // Header: GAME (left of red line) | STATS (right of red line)
    ArcadeFont.drawText(ctx, 'GAME', 336, 104, {
      color: PALETTE.PURPLE_TEXT,
      scale: 2.2,
      align: 'center',
      spacing: 19
    });
    ArcadeFont.drawText(ctx, 'STATS', 464, 104, {
      color: PALETTE.PURPLE_TEXT,
      scale: 2.2,
      align: 'center',
      spacing: 19
    });

    // Determine MVP skater to award the Golden Trophy above their column!
    const colXs = [318, 366, 434, 482]; // Blue DEF, Blue OFF, Red OFF, Red DEF
    const orderedSkaters = [
      this.skaters[0], // Blue DEF
      this.skaters[1], // Blue OFF
      this.skaters[3], // Red OFF
      this.skaters[2]  // Red DEF
    ];
    let bestIdx = 0;
    let bestScore = -1;
    orderedSkaters.forEach((sk, idx) => {
      const teamWonBonus =
        (sk.team === 'blue' && this.score.blue > this.score.red) ||
        (sk.team === 'red' && this.score.red > this.score.blue)
          ? 100
          : 0;
      const rating =
        teamWonBonus +
        sk.stats.goals * 30 +
        sk.stats.assists * 18 +
        sk.stats.faceoffsWon * 5 +
        sk.stats.viciousChecks * 4;
      if (rating > bestScore) {
        bestScore = rating;
        bestIdx = idx;
      }
    });

    // Draw Golden Trophy above the winning skater column (matching Screenshot 4!)
    SpriteRenderer.drawTrophy(ctx, colXs[bestIdx], 139, 2.2);

    // Subheaders: DEF. OFF. (Blue) | OFF. DEF. (Red)
    ArcadeFont.drawText(ctx, 'DEF.', colXs[0], 158, {
      color: PALETTE.BLUE_TEAM,
      scale: 1.55,
      align: 'center',
      spacing: 11
    });
    ArcadeFont.drawText(ctx, 'OFF.', colXs[1], 158, {
      color: PALETTE.BLUE_TEAM,
      scale: 1.55,
      align: 'center',
      spacing: 11
    });
    ArcadeFont.drawText(ctx, 'OFF.', colXs[2], 158, {
      color: PALETTE.RED_TEAM,
      scale: 1.55,
      align: 'center',
      spacing: 11
    });
    ArcadeFont.drawText(ctx, 'DEF.', colXs[3], 158, {
      color: PALETTE.RED_TEAM,
      scale: 1.55,
      align: 'center',
      spacing: 11
    });

    // Helper for drawing 4-column player stats
    const drawFourColStat = (y, vals) => {
      vals.forEach((val, idx) => {
        const colColor = idx < 2 ? PALETTE.BLUE_TEAM : PALETTE.RED_TEAM;
        ArcadeFont.drawText(ctx, String(val), colXs[idx], y, {
          color: colColor,
          scale: 1.9,
          align: 'center'
        });
      });
    };

    // Row 1: GOALS SCORED
    ArcadeFont.drawText(ctx, 'GOALS', 198, 178, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, 'SCORED', 198, 194, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    drawFourColStat(184, orderedSkaters.map(s => s.stats.goals));

    // Row 2: ASSISTS
    ArcadeFont.drawText(ctx, 'ASSISTS', 198, 232, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    drawFourColStat(232, orderedSkaters.map(s => s.stats.assists));

    // Row 3: SHOTS ON GOAL (Team totals)
    ArcadeFont.drawText(ctx, 'SHOTS', 198, 268, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, 'ON GOAL', 198, 284, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, String(this.shotsOnGoal.blue), 342, 276, { color: PALETTE.BLUE_TEAM, scale: 1.9, align: 'center' });
    ArcadeFont.drawText(ctx, String(this.shotsOnGoal.red), 458, 276, { color: PALETTE.RED_TEAM, scale: 1.9, align: 'center' });

    // Row 4: TIME OF POSS. (Team totals formatted M:SS)
    ArcadeFont.drawText(ctx, 'TIME', 198, 320, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, 'OF POSS.', 198, 336, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, this.formatTime(this.possessionSeconds.blue), 342, 328, { color: PALETTE.BLUE_TEAM, scale: 1.9, align: 'center' });
    ArcadeFont.drawText(ctx, this.formatTime(this.possessionSeconds.red), 458, 328, { color: PALETTE.RED_TEAM, scale: 1.9, align: 'center' });

    // Row 5: FACEOFFS WON
    ArcadeFont.drawText(ctx, 'FACEOFFS', 198, 372, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, 'WON', 198, 388, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    drawFourColStat(380, orderedSkaters.map(s => s.stats.faceoffsWon));

    // Row 6: VICIOUS CHECKS
    ArcadeFont.drawText(ctx, 'VICIOUS', 198, 424, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    ArcadeFont.drawText(ctx, 'CHECKS', 198, 440, { color: PALETTE.PURPLE_TEXT, scale: 1.9, align: 'center', spacing: 16 });
    drawFourColStat(432, orderedSkaters.map(s => s.stats.viciousChecks));

    // 3. Bottom Bar Boxes matching Screenshot 4 ("GAME OVER" & "CREDITS: 0")
    ctx.fillStyle = '#000000';
    ctx.fillRect(76, 488, 212, 24);
    ctx.fillRect(316, 488, 172, 24);
    ctx.fillRect(528, 488, 204, 24);

    ArcadeFont.drawText(ctx, 'GAME OVER', 402, 492, {
      color: '#FFFFFF',
      scale: 2.0,
      align: 'center',
      spacing: 17
    });

    ArcadeFont.drawText(ctx, `CREDITS: ${this.credits}`, 630, 492, {
      color: PALETTE.YELLOW_GOLD,
      scale: 2.0,
      align: 'center',
      slant: 0.35,
      spacing: 17
    });
  }

  /**
   * Renders the Rink, Purple Segmented Boards, Ice Markings, Skate Scars, Goals, and Top Scoreboard
   */
  renderRinkAndScoreboard(ctx) {
    // 1. Top black header strip & outer blue background matching Screenshot 3 & 4
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 800, 42);
    ctx.fillStyle = PALETTE.OUTER_BLUE;
    ctx.fillRect(0, 42, 800, 478);

    // 2. Purple Segmented Outer Rink Boards
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(22, 54, 756, 456, 50);
    if (this.graphicsMode === 'modern') {
      const boardGrad = ctx.createLinearGradient(0, 54, 0, 510);
      boardGrad.addColorStop(0, '#A848D0');
      boardGrad.addColorStop(0.5, '#782098');
      boardGrad.addColorStop(1, '#581078');
      ctx.fillStyle = boardGrad;
    } else {
      ctx.fillStyle = PALETTE.PURPLE_BOARD;
    }
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.PURPLE_DARK;
    ctx.stroke();

    // Inner lighter purple bevel on the boards
    ctx.beginPath();
    ctx.roundRect(30, 62, 740, 440, 42);
    ctx.strokeStyle = PALETTE.PURPLE_LIGHT;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw the vertical/horizontal board segment lines around the purple perimeter
    ctx.strokeStyle = PALETTE.PURPLE_DARK;
    ctx.lineWidth = 2;
    for (let bx = 76; bx <= 724; bx += 26) {
      // Top board segments
      ctx.beginPath();
      ctx.moveTo(bx, 54);
      ctx.lineTo(bx, 80);
      ctx.stroke();
      // Bottom board segments
      ctx.beginPath();
      ctx.moveTo(bx, 480);
      ctx.lineTo(bx, 510);
      ctx.stroke();
    }
    for (let by = 100; by <= 460; by += 26) {
      if (by < 200 || by > 360) {
        // Left board segments
        ctx.beginPath();
        ctx.moveTo(22, by);
        ctx.lineTo(54, by);
        ctx.stroke();
        // Right board segments
        ctx.beginPath();
        ctx.moveTo(746, by);
        ctx.lineTo(778, by);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Inner Ice Surface
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(54, 80, 692, 400, 28);
    if (this.graphicsMode === 'modern') {
      const iceGrad = ctx.createRadialGradient(400, 280, 40, 400, 280, 420);
      iceGrad.addColorStop(0, '#E4ECF2');
      iceGrad.addColorStop(1, '#C4D0DC');
      ctx.fillStyle = iceGrad;
    } else {
      ctx.fillStyle = PALETTE.ICE_BG;
    }
    ctx.fill();
    ctx.clip();

    // 4. Rink Lines (Blue zone lines, Center Yellow Circle, Center Red Dashed Line)
    // Left Blue Line
    ctx.fillStyle = PALETTE.PURPLE_BOARD;
    ctx.fillRect(this.rink.blueLineLeft - 2, 80, 14, 400);
    ctx.fillStyle = PALETTE.OUTER_BLUE;
    ctx.fillRect(this.rink.blueLineLeft, 80, 10, 400);

    // Right Blue Line
    ctx.fillStyle = PALETTE.PURPLE_BOARD;
    ctx.fillRect(this.rink.blueLineRight - 2, 80, 14, 400);
    ctx.fillStyle = PALETTE.OUTER_BLUE;
    ctx.fillRect(this.rink.blueLineRight, 80, 10, 400);

    // Center Yellow Faceoff Circle
    ctx.strokeStyle = PALETTE.YELLOW_GOLD;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(this.rink.centerX, this.rink.centerY, 82, 0, Math.PI * 2);
    ctx.stroke();

    // Center Red Dashed Line
    ctx.fillStyle = PALETTE.RED_TEAM;
    ctx.fillRect(this.rink.centerX - 6, 80, 12, 400);
    ctx.fillStyle = this.graphicsMode === 'modern' ? '#DCE6EE' : PALETTE.ICE_BG;
    for (let dy = 88; dy < 480; dy += 26) {
      ctx.fillRect(this.rink.centerX - 4, dy, 8, 13);
    }

    // 5. Composite persistent Skate Marks canvas on top of the ice & lines!
    ctx.drawImage(this.skateCanvas, 0, 0);

    ctx.restore();

    // Crisp black inner rink border around the ice perimeter
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(54, 80, 692, 400, 28);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();

    // 6. Left Goal (Blue) & Right Goal (Red) + Goal Lights
    this.renderGoal(ctx, 'blue');
    this.renderGoal(ctx, 'red');

    // 7. Top Scoreboard (BLUE | SAVES | TIME | SAVES | RED)
    this.renderScoreboard(ctx);
  }

  renderGoal(ctx, team) {
    const isBlue = team === 'blue';
    const teamColor = isBlue ? PALETTE.BLUE_TEAM : PALETTE.RED_TEAM;
    const netX = isBlue ? 21 : 746;
    const netW = 33;
    const netY = 220;
    const netH = 120;

    // Goal Crease Frame inside the ice
    const creaseX = isBlue ? 54 : 706;
    const creaseW = 40;
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(creaseX, 216, creaseW, 128);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(isBlue ? 54 : 709, 220, creaseW - 3, 120);

    // White Goal Netting Mesh
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(netX, netY, netW, netH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(netX, netY, netW, netH);

    // Grey mesh grid lines inside the net
    ctx.fillStyle = '#B8B8B8';
    for (let gx = netX + 6; gx < netX + netW - 2; gx += 7) {
      ctx.fillRect(gx, netY + 2, 3, netH - 4);
    }
    for (let gy = netY + 6; gy < netY + netH - 2; gy += 8) {
      ctx.fillRect(netX + 2, gy, netW - 4, 3);
    }

    // Two Circular Goal Lights above and below the goal on the boards (Screenshot 3 & 4)
    const lightX = isBlue ? 37 : 763;
    const lightYs = [205, 355];
    const scoredOnThisNet =
      this.goalLightTimer > 0 &&
      ((isBlue && this.lastScorerTeam === 'red') || (!isBlue && this.lastScorerTeam === 'blue'));
    const flashOn = scoredOnThisNet && Math.floor(this.goalLightTimer * 12) % 2 === 0;

    for (const ly of lightYs) {
      ctx.beginPath();
      ctx.arc(lightX, ly, 10, 0, Math.PI * 2);
      ctx.fillStyle = flashOn ? '#FFFF40' : teamColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(lightX, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = flashOn ? '#FFFFFF' : '#C8C8C8';
      ctx.fill();
    }
  }

  renderScoreboard(ctx) {
    // Outer purple frame + black scoreboard box matching Screenshot 3 & 4
    ctx.fillStyle = PALETTE.PURPLE_BOARD;
    ctx.fillRect(145, 11, 510, 68);
    ctx.fillStyle = PALETTE.OUTER_BLUE;
    ctx.fillRect(151, 14, 498, 62);
    ctx.fillStyle = '#000000';
    ctx.fillRect(154, 16, 492, 58);

    // --- LEFT: BLUE SCORE & SAVES ---
    this.drawScoreBox(ctx, 170, 21, this.score.blue);
    ArcadeFont.drawText(ctx, 'BLUE', 195, 59, {
      color: PALETTE.BLUE_TEAM,
      scale: 1.5,
      align: 'center',
      spacing: 13
    });

    ArcadeFont.drawText(ctx, 'SAVES', 264, 23, {
      color: PALETTE.BLUE_TEAM,
      scale: 1.5,
      align: 'center',
      spacing: 13
    });
    ArcadeFont.drawText(ctx, String(this.saves.blue), 269, 38, {
      color: PALETTE.YELLOW_GOLD,
      scale: 1.9,
      align: 'center'
    });

    // --- CENTER: TIME ---
    ArcadeFont.drawText(ctx, this.isOvertime ? 'O.T.' : 'TIME', 400, 22, {
      color: '#FFFFFF',
      scale: 1.55,
      align: 'center',
      spacing: 13.5
    });

    const totalSecs = Math.ceil(Math.max(0, this.timeRemaining));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const secTens = Math.floor(secs / 10);
    const secOnes = secs % 10;

    // Minutes box
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(351, 37, 25, 30);
    ArcadeFont.drawText(ctx, String(mins), 364, 45, {
      color: PALETTE.YELLOW_GOLD,
      scale: 2.0,
      align: 'center'
    });

    // Colon
    ArcadeFont.drawText(ctx, ':', 386, 45, {
      color: '#FFFFFF',
      scale: 2.0,
      align: 'center'
    });

    // Seconds 2-digit split box
    ctx.strokeRect(395, 37, 50, 30);
    ctx.beginPath();
    ctx.moveTo(420, 37);
    ctx.lineTo(420, 67);
    ctx.stroke();

    ArcadeFont.drawText(ctx, String(secTens), 408, 45, {
      color: PALETTE.YELLOW_GOLD,
      scale: 2.0,
      align: 'center'
    });
    ArcadeFont.drawText(ctx, String(secOnes), 433, 45, {
      color: PALETTE.YELLOW_GOLD,
      scale: 2.0,
      align: 'center'
    });

    // --- RIGHT: RED SAVES & SCORE ---
    ArcadeFont.drawText(ctx, 'SAVES', 531, 23, {
      color: PALETTE.RED_TEAM,
      scale: 1.5,
      align: 'center',
      spacing: 13
    });
    ArcadeFont.drawText(ctx, String(this.saves.red), 539, 38, {
      color: PALETTE.YELLOW_GOLD,
      scale: 1.9,
      align: 'center'
    });

    this.drawScoreBox(ctx, 570, 21, this.score.red);
    ArcadeFont.drawText(ctx, 'RED', 595, 59, {
      color: PALETTE.RED_TEAM,
      scale: 1.5,
      align: 'center',
      spacing: 13
    });
  }

  drawScoreBox(ctx, x, y, val) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x, y, 50, 33);
    ctx.beginPath();
    ctx.moveTo(x + 25, y);
    ctx.lineTo(x + 25, y + 33);
    ctx.stroke();

    const tens = Math.floor(val / 10);
    const ones = val % 10;
    if (tens > 0) {
      ArcadeFont.drawText(ctx, String(tens), x + 13, y + 9, {
        color: PALETTE.YELLOW_GOLD,
        scale: 2.0,
        align: 'center'
      });
    }
    ArcadeFont.drawText(ctx, String(ones), x + 38, y + 9, {
      color: PALETTE.YELLOW_GOLD,
      scale: 2.0,
      align: 'center'
    });
  }

  formatTime(seconds) {
    const s = Math.floor(Math.max(0, seconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }
}
