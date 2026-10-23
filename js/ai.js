// ============================================================================
// TEAM HAT TRICK (1985 Bally Sente) - 2v2 Hockey AI Controller
// Controls any unassigned Offense or Defense (+ Tandem Goalie) slots
// ============================================================================

export class HockeyAI {
  /**
   * Compute { dx, dy, shootJustPressed } for an AI-controlled skater
   * @param {object} skater - The AI skater entity
   * @param {object} game - Reference to the Game instance
   */
  static computeInput(skater, game) {
    const puck = game.puck;
    const rink = game.rink;
    const isBlue = skater.team === 'blue';
    const attackGoalX = isBlue ? rink.rightGoalX : rink.leftGoalX;
    const defendGoalX = isBlue ? rink.leftGoalX : rink.rightGoalX;
    const goalCenterY = (rink.goalTopY + rink.goalBottomY) / 2;

    // Find teammate and opponents
    const teammate = game.skaters.find(s => s.team === skater.team && s.id !== skater.id);
    const opponents = game.skaters.filter(s => s.team !== skater.team);
    const goalie = isBlue ? game.blueGoalie : game.redGoalie;

    // Difficulty multiplier (0.75 easy, 0.92 normal, 1.08 hard)
    const diff = game.aiDifficultyFactor || 0.92;

    let targetX = skater.x;
    let targetY = skater.y;
    let shootJustPressed = false;

    const puckCarrier = puck.owner;
    const weHavePuck = puckCarrier === skater;
    const teamHasPuck = puckCarrier && puckCarrier.team === skater.team;
    const oppHasPuck = puckCarrier && puckCarrier.team !== skater.team;

    if (weHavePuck) {
      // 1. We have the puck! Skate toward opponent's goal slot and shoot or pass
      const slotX = isBlue ? rink.right - 135 : rink.left + 135;
      // Pick top or bottom corner away from opposing goalie
      const oppGoalie = isBlue ? game.redGoalie : game.blueGoalie;
      const aimOffsetY = oppGoalie.y > goalCenterY ? -34 : 34;
      targetX = slotX;
      targetY = goalCenterY + aimOffsetY;

      const distToGoal = Math.hypot(attackGoalX - skater.x, goalCenterY - skater.y);
      const facingGoal = isBlue
        ? Math.cos(skater.angle) > 0.55
        : Math.cos(skater.angle) < -0.55;

      // Check if an opponent is about to body-check us
      const nearestOppDist = Math.min(
        ...opponents.map(o => Math.hypot(o.x - skater.x, o.y - skater.y))
      );

      // If Defense has the puck deep in own zone and Offense teammate is ahead & open, pass up ice!
      if (
        skater.role === 'defense' &&
        teammate &&
        ((isBlue && skater.x < rink.centerX - 40 && teammate.x > skater.x + 70) ||
          (!isBlue && skater.x > rink.centerX + 40 && teammate.x < skater.x - 70)) &&
        skater.possessionTime > 0.35
      ) {
        targetX = teammate.x;
        targetY = teammate.y;
        const angleToMate = Math.atan2(teammate.y - skater.y, teammate.x - skater.x);
        const angleDiff = Math.abs(Math.atan2(Math.sin(angleToMate - skater.angle), Math.cos(angleToMate - skater.angle)));
        if (angleDiff < 0.55 && Math.random() < 0.08 * diff) {
          shootJustPressed = true;
        }
      }

      // Shoot when in good scoring range and facing goal
      if (distToGoal < 245 && facingGoal && skater.possessionTime > 0.22) {
        if (Math.random() < 0.09 * diff || distToGoal < 135 || nearestOppDist < 42) {
          shootJustPressed = true;
        }
      }
    } else if (teamHasPuck) {
      // 2. Our teammate has the puck!
      if (skater.role === 'offense') {
        // Get open in the offensive slot for a pass or rebound
        targetX = isBlue ? rink.centerX + 145 : rink.centerX - 145;
        targetY = puckCarrier.y < goalCenterY ? goalCenterY + 65 : goalCenterY - 65;
      } else {
        // Defense holds the blue line / neutral zone support
        targetX = isBlue ? rink.centerX - 95 : rink.centerX + 95;
        targetY = goalCenterY + (puck.y - goalCenterY) * 0.45;
      }
    } else if (oppHasPuck) {
      // 3. Opponent has the puck!
      const distToCarrier = Math.hypot(puckCarrier.x - skater.x, puckCarrier.y - skater.y);
      if (skater.role === 'offense' || distToCarrier < 180) {
        // Forecheck / body-check the puck carrier!
        targetX = puckCarrier.x + puckCarrier.vx * 0.12;
        targetY = puckCarrier.y + puckCarrier.vy * 0.12;
        if (distToCarrier < 36 && Math.random() < 0.025 * diff) {
          shootJustPressed = true; // Trigger lunge/vicious check!
        }
      } else {
        // Defense stays between puck carrier and own goal
        targetX = (puckCarrier.x + defendGoalX) * 0.5;
        targetY = (puckCarrier.y + goalCenterY) * 0.5;
      }
    } else {
      // 4. Loose puck!
      const distSelf = Math.hypot(puck.x - skater.x, puck.y - skater.y);
      const distMate = teammate ? Math.hypot(puck.x - teammate.x, puck.y - teammate.y) : Infinity;

      const puckInDefZone = isBlue ? puck.x < rink.centerX : puck.x > rink.centerX;

      if (skater.role === 'offense' || distSelf <= distMate + 40 || puckInDefZone) {
        targetX = puck.x + puck.vx * 0.15;
        targetY = puck.y + puck.vy * 0.15;
      } else {
        // Stay back on defense near blue line
        targetX = isBlue ? rink.left + 165 : rink.right - 165;
        targetY = goalCenterY + (puck.y - goalCenterY) * 0.5;
      }
    }

    let dx = targetX - skater.x;
    let dy = targetY - skater.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      dx /= dist;
      dy /= dist;
    } else {
      dx = 0;
      dy = 0;
    }

    // Special Tandem Goalie AI logic for Defense role:
    // Because the Defense controller's vertical movement (dy) also moves the Goalie,
    // when a shot or opponent is threatening the net, blend goalie tracking into dy!
    const puckThreateningOurGoal = isBlue
      ? (puck.x < rink.centerX - 20 && puck.vx <= 60)
      : (puck.x > rink.centerX + 20 && puck.vx >= -60);

    if (skater.role === 'defense' && !weHavePuck && puckThreateningOurGoal && goalie) {
      const desiredGoalieY = Math.max(
        rink.goalTopY + 18,
        Math.min(rink.goalBottomY - 18, puck.y + puck.vy * 0.08)
      );
      const goalieDiffY = desiredGoalieY - goalie.y;
      if (Math.abs(goalieDiffY) > 6) {
        const goalieDy = Math.sign(goalieDiffY);
        dy = dy * 0.35 + goalieDy * 0.65;
      }
    }

    return {
      dx: dx * diff,
      dy: dy * diff,
      shoot: shootJustPressed,
      shootJustPressed
    };
  }
}
