// ============================================================================
// TEAM HAT TRICK (1985 Bally Sente) - Application Bootstrap & UI Controls
// ============================================================================

import { InputManager } from './input.js';
import { ArcadeAudio } from './audio.js';
import { TeamHatTrickGame, STATE } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const crtOverlay = document.getElementById('crt-overlay');
  const btnModeClassic = document.getElementById('btn-mode-classic');
  const btnModeModern = document.getElementById('btn-mode-modern');
  const btnCrt = document.getElementById('btn-crt');
  const btnMute = document.getElementById('btn-mute');
  const btnCoin = document.getElementById('btn-coin');
  const btnSelectScreen = document.getElementById('btn-select-screen');
  const btnZamboniDemo = document.getElementById('btn-zamboni-demo');
  const btnTitleScreen = document.getElementById('btn-title-screen');
  const selectDifficulty = document.getElementById('select-difficulty');
  const selectDuration = document.getElementById('select-duration');

  const input = new InputManager(canvas);
  const audio = new ArcadeAudio();
  const game = new TeamHatTrickGame(canvas, input, audio);

  // Expose game instance for debugging/inspection
  window.teamHatTrick = game;

  const syncUI = () => {
    if (game.graphicsMode === 'classic') {
      btnModeClassic.classList.add('active');
      btnModeModern.classList.remove('active');
    } else {
      btnModeModern.classList.add('active');
      btnModeClassic.classList.remove('active');
    }

    if (game.crtEnabled) {
      crtOverlay.classList.remove('hidden');
      btnCrt.classList.add('active');
      btnCrt.textContent = 'CRT: ON';
    } else {
      crtOverlay.classList.add('hidden');
      btnCrt.classList.remove('active');
      btnCrt.textContent = 'CRT: OFF';
    }

    btnMute.textContent = audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
    btnMute.classList.toggle('active', !audio.muted);
  };

  game.onSettingsChange = syncUI;

  btnModeClassic.addEventListener('click', () => {
    game.setGraphicsMode('classic');
    canvas.focus();
  });

  btnModeModern.addEventListener('click', () => {
    game.setGraphicsMode('modern');
    canvas.focus();
  });

  btnCrt.addEventListener('click', () => {
    game.crtEnabled = !game.crtEnabled;
    syncUI();
    canvas.focus();
  });

  btnMute.addEventListener('click', () => {
    audio.toggleMute();
    syncUI();
    canvas.focus();
  });

  btnCoin.addEventListener('click', () => {
    game.insertCoin();
    canvas.focus();
  });

  btnTitleScreen.addEventListener('click', () => {
    audio.stopZamboniTune();
    game.state = STATE.TITLE;
    game.stateTimer = 0;
    canvas.focus();
  });

  btnSelectScreen.addEventListener('click', () => {
    game.goToSelectScreen();
    canvas.focus();
  });

  btnZamboniDemo.addEventListener('click', () => {
    // Populate realistic stats & skate marks matching Screenshot 4 and trigger Zamboni!
    game.resetMatchData();
    game.score = { blue: 2, red: 1 };
    game.saves = { blue: 6, red: 9 };
    game.shotsOnGoal = { blue: 11, red: 7 };
    game.possessionSeconds = { blue: 61, red: 57 }; // 1:01 vs 0:57
    game.timeRemaining = 7;
    game.skaters[0].stats = { goals: 1, assists: 0, faceoffsWon: 0, viciousChecks: 3 }; // Blue DEF
    game.skaters[1].stats = { goals: 1, assists: 0, faceoffsWon: 2, viciousChecks: 0 }; // Blue OFF
    game.skaters[3].stats = { goals: 0, assists: 0, faceoffsWon: 1, viciousChecks: 0 }; // Red OFF
    game.skaters[2].stats = { goals: 1, assists: 0, faceoffsWon: 0, viciousChecks: 2 }; // Red DEF

    // Cover the ice in realistic skate marks for the Zamboni to clear!
    game.clearIceMarks();
    for (let i = 0; i < 2400; i++) {
      const rx = 64 + Math.random() * 672;
      const ry = 140 + Math.random() * 332;
      game.addSkateMark(rx, ry, Math.random() * Math.PI * 2, 1.5);
    }
    game.enterGameOver();
    canvas.focus();
  });

  selectDifficulty.addEventListener('change', (e) => {
    game.aiDifficultyFactor = parseFloat(e.target.value);
    canvas.focus();
  });

  selectDuration.addEventListener('change', (e) => {
    game.matchDurationSeconds = parseInt(e.target.value, 10);
    if (game.state === STATE.PLAYING || game.state === STATE.FACEOFF) {
      game.timeRemaining = game.matchDurationSeconds;
    }
    canvas.focus();
  });

  syncUI();

  // Main 60fps animation loop
  let lastTime = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    game.update(dt);
    game.render();

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
});
