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

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#120a2e');
    grad.addColorStop(1, '#35216f');
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

    // Slow, calm drifting clouds.
    ctx.save();
    ctx.globalAlpha = 0.35;
    clouds.forEach((c) => {
      c.x += c.speed;
      if (c.x > width + 120) c.x = -120;
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

  function drawGhost(piece, offsetY) {
    if (offsetY <= 2) return; // already essentially touching down, no need to show it

    const parts = piece.parts.length > 1 ? piece.parts.slice(1) : [piece];

    // Combined bounding box of the landing footprint, for the wide glow bar.
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    parts.forEach((part) => {
      part.vertices.forEach((v) => {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y + offsetY);
      });
    });

    // Wide, soft "landing zone" glow beneath the footprint — the larger,
    // easy-to-spot part of the indicator.
    ctx.save();
    const glowPad = 22;
    const glow = ctx.createLinearGradient(0, maxY - 10, 0, maxY + 10);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0)');
    glow.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(minX - glowPad, maxY - 10, (maxX - minX) + glowPad * 2, 20);
    ctx.restore();

    // Ghost outline of the piece itself at its landing position.
    ctx.save();
    ctx.globalAlpha = 0.85;
    parts.forEach((part) => {
      const verts = part.vertices;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y + offsetY);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y + offsetY);
      ctx.closePath();

      ctx.fillStyle = hexToRgba(piece.ttColor, 0.22);
      ctx.fill();

      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = piece.ttColor;
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.restore();
  }

  function hexToRgba(hex, alpha) {
    const h = parseInt(hex.slice(1), 16);
    const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function frame(physics, canvasEl, opts) {
    if (canvasEl !== canvas) init(canvasEl);
    if (canvas.width !== width || canvas.height !== height) resize();

    frameCount++;

    drawBackground();
    drawGoalLine(opts.goalY, physics.platformLeft, physics.platformRight);
    drawPlatform(physics);

    if (opts.ghost) drawGhost(opts.ghost.piece, opts.ghost.offsetY);

    const bodies = Composite.allBodies(physics.world).filter((b) => b.label !== 'platform');
    bodies.forEach(drawBody);
  }

  return { init, frame };
})();
