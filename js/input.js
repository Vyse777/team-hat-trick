// ============================================================================
// TEAM HAT TRICK (1985 Bally Sente) - Multi-Player Input Manager
// Supports P1, P2, P3, P4 on Keyboard + up to 4 HTML5 Gamepads + Mouse clicks
// ============================================================================

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.prevGamepadButtons = [[], [], [], []];
    this.clicks = [];

    window.addEventListener('keydown', (e) => {
      // Prevent page scrolling on arrows / space when focused on game
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (document.activeElement === document.body || document.activeElement === this.canvas) {
          e.preventDefault();
        }
      }
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.clicks.push({
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        });
      });
    }
  }

  consumeClicks() {
    const out = this.clicks.slice();
    this.clicks.length = 0;
    return out;
  }

  wasKeyJustPressed(code) {
    return this.justPressed.has(code);
  }

  clearFrame() {
    this.justPressed.clear();
    this.clicks.length = 0;
  }

  /**
   * Returns controller state for human player index 0..3 (P1..P4)
   * { dx, dy, shoot, shootJustPressed, navJustMoved }
   */
  getControllerState(playerIndex) {
    let dx = 0;
    let dy = 0;
    let shoot = false;
    let shootJustPressed = false;
    let upJust = false;
    let downJust = false;
    let leftJust = false;
    let rightJust = false;

    if (playerIndex === 0) {
      // P1: WASD + Space / KeyF / ShiftLeft / KeyZ
      if (this.keys.has('KeyW')) dy -= 1;
      if (this.keys.has('KeyS')) dy += 1;
      if (this.keys.has('KeyA')) dx -= 1;
      if (this.keys.has('KeyD')) dx += 1;
      shoot = this.keys.has('Space') || this.keys.has('KeyF') || this.keys.has('ShiftLeft') || this.keys.has('KeyZ');
      shootJustPressed =
        this.justPressed.has('Space') ||
        this.justPressed.has('KeyF') ||
        this.justPressed.has('ShiftLeft') ||
        this.justPressed.has('KeyZ');
      upJust = this.justPressed.has('KeyW');
      downJust = this.justPressed.has('KeyS');
      leftJust = this.justPressed.has('KeyA');
      rightJust = this.justPressed.has('KeyD');
    } else if (playerIndex === 1) {
      // P2: Arrow Keys + Enter / Slash / KeyM / ShiftRight
      if (this.keys.has('ArrowUp')) dy -= 1;
      if (this.keys.has('ArrowDown')) dy += 1;
      if (this.keys.has('ArrowLeft')) dx -= 1;
      if (this.keys.has('ArrowRight')) dx += 1;
      shoot =
        this.keys.has('Enter') ||
        this.keys.has('Slash') ||
        this.keys.has('KeyM') ||
        this.keys.has('ShiftRight');
      shootJustPressed =
        this.justPressed.has('Enter') ||
        this.justPressed.has('Slash') ||
        this.justPressed.has('KeyM') ||
        this.justPressed.has('ShiftRight');
      upJust = this.justPressed.has('ArrowUp');
      downJust = this.justPressed.has('ArrowDown');
      leftJust = this.justPressed.has('ArrowLeft');
      rightJust = this.justPressed.has('ArrowRight');
    } else if (playerIndex === 2) {
      // P3: IJKL + KeyU / KeyH
      if (this.keys.has('KeyI')) dy -= 1;
      if (this.keys.has('KeyK')) dy += 1;
      if (this.keys.has('KeyJ')) dx -= 1;
      if (this.keys.has('KeyL')) dx += 1;
      shoot = this.keys.has('KeyU') || this.keys.has('KeyH');
      shootJustPressed = this.justPressed.has('KeyU') || this.justPressed.has('KeyH');
      upJust = this.justPressed.has('KeyI');
      downJust = this.justPressed.has('KeyK');
      leftJust = this.justPressed.has('KeyJ');
      rightJust = this.justPressed.has('KeyL');
    } else if (playerIndex === 3) {
      // P4: Numpad 8456 + Numpad0 / NumpadEnter
      if (this.keys.has('Numpad8')) dy -= 1;
      if (this.keys.has('Numpad5') || this.keys.has('Numpad2')) dy += 1;
      if (this.keys.has('Numpad4')) dx -= 1;
      if (this.keys.has('Numpad6')) dx += 1;
      shoot = this.keys.has('Numpad0') || this.keys.has('NumpadEnter');
      shootJustPressed = this.justPressed.has('Numpad0') || this.justPressed.has('NumpadEnter');
      upJust = this.justPressed.has('Numpad8');
      downJust = this.justPressed.has('Numpad5') || this.justPressed.has('Numpad2');
      leftJust = this.justPressed.has('Numpad4');
      rightJust = this.justPressed.has('Numpad6');
    }

    // Merge HTML5 Gamepad if connected
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[playerIndex];
    if (gp) {
      const deadzone = 0.28;
      const gx = gp.axes[0] || 0;
      const gy = gp.axes[1] || 0;
      if (Math.abs(gx) > deadzone) dx += gx;
      if (Math.abs(gy) > deadzone) dy += gy;
      // D-pad buttons 12,13,14,15
      if (gp.buttons[12]?.pressed) dy -= 1;
      if (gp.buttons[13]?.pressed) dy += 1;
      if (gp.buttons[14]?.pressed) dx -= 1;
      if (gp.buttons[15]?.pressed) dx += 1;

      const btnPressed = Boolean(gp.buttons[0]?.pressed || gp.buttons[1]?.pressed || gp.buttons[2]?.pressed);
      const prevBtn = Boolean(this.prevGamepadButtons[playerIndex][0]);
      if (btnPressed) shoot = true;
      if (btnPressed && !prevBtn) shootJustPressed = true;
      this.prevGamepadButtons[playerIndex][0] = btnPressed;
    }

    // Normalize diagonal vector
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    return {
      dx,
      dy,
      shoot,
      shootJustPressed,
      upJust,
      downJust,
      leftJust,
      rightJust
    };
  }
}
