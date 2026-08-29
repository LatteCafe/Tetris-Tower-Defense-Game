// render.js — hand-rolled canvas renderer (not Matter.Render) so the art
// style stays fully custom: storm sky, stone pedestal, gem-toned blocks.
window.TT = window.TT || {};

TT.Render = (function () {
  const { Composite } = Matter;

  let canvas, ctx, width, height;
  let stars = [];
  let clouds = [];
  let frameCount = 0;

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();

    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.55,
      r: Math.random() * 1.5 + 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    clouds = Array.from({ length: 6 }, () => ({
      x: Math.random() * width,
      y: 30 + Math.random() * 130,
      scale: 0.5 + Math.random() * 0.9,
      speed: 0.12 + Math.random() * 0.22,
    }));
  }

  function resize() {
    width = canvas.width;
    height = canvas.height;
  }

  function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
    const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bch = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bch})`;
  }

  function drawBackground(windStrength) {
    const stormT = Math.min(1, Math.abs(windStrength) / 6);
    const topColor = lerpColor('#120a2e', '#1c0f3a', stormT);
    const bottomColor = lerpColor('#35216f', '#4a1f5c', stormT);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Stars twinkle gently.
    ctx.save();
    stars.forEach((s) => {
      const tw = 0.5 + 0.5 * Math.sin(frameCount * 0.03 + s.phase);
      ctx.globalAlpha = 0.25 + tw * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Drifting storm clouds; speed reacts to wind.
    ctx.save();
    ctx.globalAlpha = 0.35;
    clouds.forEach((c) => {
      c.x += c.speed * (1 + Math.abs(windStrength) * 0.6) * Math.sign(windStrength || 1);
      if (c.x > width + 120) c.x = -120;
      if (c.x < -120) c.x = width + 120;
      drawCloud(c.x, c.y, c.scale);
    });
    ctx.restore();
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = '#e9e4ff';
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26 * s, y + 4 * s, 26 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 26 * s, y + 4 * s, 24 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlatform(physics) {
    const { platformY, platformLeft, platformRight } = physics;
    const w = platformRight - platformLeft;
    const cx = (platformLeft + platformRight) / 2;

    // Pedestal shadow.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, height - 8, w * 0.7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Stone pedestal body.
    const stoneGrad = ctx.createLinearGradient(0, platformY, 0, height);
    stoneGrad.addColorStop(0, '#6b6478');
    stoneGrad.addColorStop(1, '#302a3d');
    ctx.fillStyle = stoneGrad;
    ctx.fillRect(platformLeft, platformY, w, height - platformY);

    // Top surface highlight.
    ctx.fillStyle = '#8b84a0';
    ctx.fillRect(platformLeft, platformY, w, 10);

    // Vertical fluting lines for a carved-column look.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let x = platformLeft + 14; x < platformRight; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, platformY + 12);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Edge markers so the drop-off zone reads clearly.
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(platformLeft - 3, platformY, 3, 10);
    ctx.fillRect(platformRight, platformY, 3, 10);
  }

  function drawGoalLine(goalY, platformLeft, platformRight) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, goalY);
    ctx.lineTo(width, goalY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
    ctx.font = '600 11px "Space Grotesk", sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('GOAL', 12, goalY - 4);
    ctx.restore();
  }

  function drawBody(body) {
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    parts.forEach((part) => {
      const verts = part.vertices;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();

      ctx.fillStyle = body.ttColor || '#cccccc';
      ctx.fill();

      // Gloss highlight along the top edge for a candy/gem look.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      ctx.lineTo(verts[1].x, verts[1].y);
      ctx.lineTo(verts[1].x, verts[1].y + 8);
      ctx.lineTo(verts[0].x, verts[0].y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  function drawWindIndicator(wind) {
    const strength = Math.min(1, Math.abs(wind) / 6);
    if (strength < 0.05) return;

    const dir = wind > 0 ? 1 : -1;
    const x = width - 46;
    const y = 100;

    ctx.save();
    ctx.globalAlpha = 0.55 + strength * 0.35;
    ctx.strokeStyle = '#e9e4ff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = y + i * 12 - 12;
      const len = 18 + strength * 22;
      ctx.beginPath();
      ctx.moveTo(x - dir * len * 0.5, yy + Math.sin(frameCount * 0.2 + i) * 2);
      ctx.lineTo(x + dir * len * 0.5, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(physics, canvasEl, opts) {
    if (canvasEl !== canvas) init(canvasEl);
    if (canvas.width !== width || canvas.height !== height) resize();

    frameCount++;
    const wind = opts.wind || 0;

    drawBackground(wind);
    drawGoalLine(opts.goalY, physics.platformLeft, physics.platformRight);
    drawPlatform(physics);

    const bodies = Composite.allBodies(physics.world).filter((b) => b.label !== 'platform');
    bodies.forEach(drawBody);

    drawWindIndicator(wind);
  }

  return { init, frame };
})();
