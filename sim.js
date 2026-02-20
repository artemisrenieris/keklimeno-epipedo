const g = 10;

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const angleSlider = document.getElementById("angleSlider");
const lengthSlider = document.getElementById("lengthSlider");
const massSlider = document.getElementById("massSlider");
const muSlider = document.getElementById("muSlider");
const frictionToggle = document.getElementById("frictionToggle");
const vectorsToggle = document.getElementById("vectorsToggle");
const forceToggle = document.getElementById("forceToggle");
const forceSlider = document.getElementById("forceSlider");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const slowBtn = document.getElementById("slowBtn");
const miniPlayBtn = document.getElementById("miniPlayBtn");
const miniResetBtn = document.getElementById("miniResetBtn");
const miniSlowBtn = document.getElementById("miniSlowBtn");
const phPanel = document.getElementById("phPanel");
const phBody = document.getElementById("phBody");
const phToggleBtn = document.getElementById("phToggleBtn");

const angleValue = document.getElementById("angleValue");
const lengthValue = document.getElementById("lengthValue");
const massValue = document.getElementById("massValue");
const muValue = document.getElementById("muValue");
const forceValue = document.getElementById("forceValue");
const accelValue = document.getElementById("accelValue");
const velValue = document.getElementById("velValue");
const dispValue = document.getElementById("dispValue");
const currentHeightValue = document.getElementById("currentHeightValue");
const heightValue = document.getElementById("heightValue");
const impactValue = document.getElementById("impactValue");
const phAccelValue = document.getElementById("phAccelValue");
const phVelValue = document.getElementById("phVelValue");
const phDispValue = document.getElementById("phDispValue");
const phCurrentHeightValue = document.getElementById("phCurrentHeightValue");
const phHeightValue = document.getElementById("phHeightValue");
const phImpactValue = document.getElementById("phImpactValue");

const state = {
  thetaDeg: Number(angleSlider.value),
  planeLength: Number(lengthSlider.value),
  m: Number(massSlider.value),
  mu: Number(muSlider.value),
  frictionOn: frictionToggle.checked,
  showVectors: vectorsToggle.checked,
  pushOn: forceToggle.checked,
  forceN: Number(forceSlider.value),
  phExpanded: true,
  playing: false,
  s: 0,
  v: 0,
  elapsedTime: 0,
  impactTime: null,
  impactSpeed: null,
  slowMotion: false,
  timeScale: 1,
  a: 0,
  lastTime: null
};

function rampGeometry() {
  const theta = (state.thetaDeg * Math.PI) / 180;
  const start = { x: 800, y: 440 };
  const rampPixels = 280 + state.planeLength * 18;
  const tx = Math.cos(theta);
  const ty = Math.sin(theta);
  const end = {
    x: start.x - rampPixels * tx,
    y: start.y - rampPixels * ty
  };

  return {
    theta,
    start,
    end,
    rampPixels,
    t: { x: tx, y: ty },
    n: { x: ty, y: -tx }
  };
}

function activeForce() {
  return state.pushOn ? state.forceN : 0;
}

function normalMagnitude(theta) {
  const Fh = activeForce();
  return state.m * g * Math.cos(theta) + Fh * Math.sin(theta);
}

function computeAcceleration() {
  const theta = (state.thetaDeg * Math.PI) / 180;
  const Fh = activeForce();
  const alongWithoutFriction = g * Math.sin(theta) - (Fh / state.m) * Math.cos(theta);

  if (!state.frictionOn) {
    return Math.max(0, alongWithoutFriction);
  }

  const nMag = normalMagnitude(theta);
  const frictionAccel = (state.mu * nMag) / state.m;
  return Math.max(0, alongWithoutFriction - frictionAccel);
}

function updateReadouts() {
  const theta = (state.thetaDeg * Math.PI) / 180;
  angleValue.textContent = state.thetaDeg.toFixed(0);
  lengthValue.textContent = state.planeLength.toFixed(1);
  massValue.textContent = state.m.toFixed(1);
  muValue.textContent = state.mu.toFixed(2);
  forceValue.textContent = activeForce().toFixed(1);
  accelValue.textContent = state.a.toFixed(2);
  phAccelValue.textContent = state.a.toFixed(2);
  velValue.textContent = state.v.toFixed(2);
  phVelValue.textContent = state.v.toFixed(2);
  dispValue.textContent = state.s.toFixed(2);
  phDispValue.textContent = state.s.toFixed(2);
  currentHeightValue.textContent = ((state.planeLength - state.s) * Math.sin(theta)).toFixed(2);
  phCurrentHeightValue.textContent = ((state.planeLength - state.s) * Math.sin(theta)).toFixed(2);
  heightValue.textContent = (state.planeLength * Math.sin(theta)).toFixed(2);
  phHeightValue.textContent = (state.planeLength * Math.sin(theta)).toFixed(2);
  impactValue.textContent = state.impactSpeed === null ? "-" : `${state.impactSpeed.toFixed(2)} m/s`;
  phImpactValue.textContent = state.impactSpeed === null ? "-" : `${state.impactSpeed.toFixed(2)} m/s`;
}

function drawArrow(x, y, vx, vy, color, label) {
  const tipX = x + vx;
  const tipY = y + vy;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.8;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  const angle = Math.atan2(vy, vx);
  const headSize = 12;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - headSize * Math.cos(angle - Math.PI / 6),
    tipY - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    tipX - headSize * Math.cos(angle + Math.PI / 6),
    tipY - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.font = "12px Arial";
  ctx.fillText(label, tipX + 6, tipY - 6);
}

function drawAngleMarker(geom) {
  const r = 46;
  const startAngle = -Math.PI;
  const endAngle = -Math.PI + geom.theta;

  ctx.strokeStyle = "#3a5a78";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(geom.start.x, geom.start.y, r, startAngle, endAngle);
  ctx.stroke();

  const mid = (startAngle + endAngle) / 2;
  const tx = geom.start.x + (r + 16) * Math.cos(mid);
  const ty = geom.start.y + (r + 16) * Math.sin(mid);

  ctx.fillStyle = "#1f3e64";
  ctx.font = "15px Arial";
  ctx.fillText("\u03b8", tx, ty);
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const geom = rampGeometry();

  ctx.strokeStyle = "#8da1ba";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, geom.start.y);
  ctx.lineTo(canvas.width - 60, geom.start.y);
  ctx.stroke();

  ctx.fillStyle = "#3a5a78";
  ctx.beginPath();
  ctx.arc(geom.start.x, geom.start.y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7a8ca5";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(geom.start.x, geom.start.y);
  ctx.lineTo(geom.end.x, geom.end.y);
  ctx.stroke();

  drawAngleMarker(geom);

  const pad = 36;
  const usable = geom.rampPixels - 2 * pad;
  const distancePx = pad + (state.s / state.planeLength) * usable;
  const blockCenter = {
    x: geom.end.x + geom.t.x * distancePx + geom.n.x * 18,
    y: geom.end.y + geom.t.y * distancePx + geom.n.y * 18
  };

  ctx.save();
  ctx.translate(blockCenter.x, blockCenter.y);
  ctx.rotate(Math.atan2(geom.t.y, geom.t.x));
  ctx.fillStyle = "#264653";
  ctx.fillRect(-22, -14, 44, 28);
  ctx.restore();

  if (state.showVectors) {
    const mg = state.m * g;
    const Fh = activeForce();
    const nMag = normalMagnitude(geom.theta);
    const tMag = state.frictionOn ? state.mu * nMag : 0;
    const mgSin = state.m * g * Math.sin(geom.theta);
    const mgCos = state.m * g * Math.cos(geom.theta);

    const massScale = state.m / 2;
    const scale = 1.15 * massScale;

    drawArrow(blockCenter.x, blockCenter.y, 0, mg * scale, "#d90429", "mg");
    drawArrow(
      blockCenter.x,
      blockCenter.y,
      geom.n.x * nMag * scale,
      geom.n.y * nMag * scale,
      "#1d3557",
      "N"
    );
    if (state.frictionOn && state.mu > 0 && tMag > 0) {
      drawArrow(
        blockCenter.x,
        blockCenter.y,
        -geom.t.x * tMag * scale,
        -geom.t.y * tMag * scale,
        "#f4a261",
        "\u03a4"
      );
    }
    drawArrow(
      blockCenter.x,
      blockCenter.y,
      geom.t.x * mgSin * scale,
      geom.t.y * mgSin * scale,
      "#2a9d8f",
      "mg \u03b7\u03bc\u03b8"
    );
    drawArrow(
      blockCenter.x,
      blockCenter.y,
      -geom.n.x * mgCos * scale,
      -geom.n.y * mgCos * scale,
      "#6c757d",
      "mg \u03c3\u03c5\u03bd\u03b8"
    );

    if (state.pushOn && Fh > 0) {
      drawArrow(blockCenter.x, blockCenter.y, -Fh * scale, 0, "#7b2cbf", "F");
    }
  }

  ctx.fillStyle = "#0b1d3a";
  ctx.font = "15px Arial";
  ctx.fillText(`\u03b8 = ${state.thetaDeg.toFixed(0)}\u00b0`, geom.start.x + 10, geom.start.y - 18);
}

function tick(timestamp) {
  if (state.lastTime === null) {
    state.lastTime = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000) * state.timeScale;
  state.lastTime = timestamp;

  state.a = computeAcceleration();

  if (state.playing) {
    const nextS = state.s + state.v * dt + 0.5 * state.a * dt * dt;
    state.v += state.a * dt;
    state.elapsedTime += dt;
    state.s = Math.min(state.planeLength, nextS);

    if (state.s >= state.planeLength) {
      state.impactTime = state.elapsedTime;
      state.impactSpeed = state.v;
      state.s = state.planeLength;
      state.v = 0;
      state.playing = false;
    }
  }

  syncTransportLabels();
  updateReadouts();
  drawScene();
  requestAnimationFrame(tick);
}

function resetMotion() {
  state.s = 0;
  state.v = 0;
  state.elapsedTime = 0;
  state.impactTime = null;
  state.impactSpeed = null;
  state.playing = false;
}

function setPhExpanded(expanded) {
  state.phExpanded = expanded;
  phPanel.classList.toggle("collapsed", !state.phExpanded);
  phBody.hidden = !state.phExpanded;
  phToggleBtn.textContent = state.phExpanded ? "-" : "+";
}

function syncTransportLabels() {
  miniPlayBtn.textContent = state.playing ? "Pause" : "Start";
}

function runPlay() {
  if (state.s >= state.planeLength) {
    state.s = 0;
    state.v = 0;
    state.elapsedTime = 0;
    state.impactTime = null;
    state.impactSpeed = null;
  }
  state.playing = true;
  syncTransportLabels();
}

function runPause() {
  state.playing = false;
  syncTransportLabels();
}

function runReset() {
  resetMotion();
  syncTransportLabels();
  updateReadouts();
}

function toggleSlow() {
  state.slowMotion = !state.slowMotion;
  state.timeScale = state.slowMotion ? 0.25 : 1;
  slowBtn.textContent = `Slow motion: ${state.slowMotion ? "On" : "Off"}`;
  slowBtn.classList.toggle("slow-on", state.slowMotion);
  miniSlowBtn.classList.toggle("slow-on", state.slowMotion);
}

function syncInputs() {
  state.thetaDeg = Number(angleSlider.value);
  state.planeLength = Number(lengthSlider.value);
  state.m = Number(massSlider.value);
  state.mu = Number(muSlider.value);
  state.frictionOn = frictionToggle.checked;
  state.showVectors = vectorsToggle.checked;
  state.pushOn = forceToggle.checked;
  state.forceN = Number(forceSlider.value);
  forceSlider.disabled = !state.pushOn;
  state.s = Math.min(state.s, state.planeLength);
  if (state.s >= state.planeLength) {
    state.playing = false;
  }
  if (state.s < state.planeLength) {
    state.impactTime = null;
    state.impactSpeed = null;
  }
  state.a = computeAcceleration();
  syncTransportLabels();
  updateReadouts();
}

[angleSlider, lengthSlider, massSlider, muSlider, forceSlider].forEach((el) => {
  el.addEventListener("input", syncInputs);
});

[frictionToggle, vectorsToggle, forceToggle].forEach((el) => {
  el.addEventListener("change", syncInputs);
});

playBtn.addEventListener("click", () => {
  runPlay();
});

pauseBtn.addEventListener("click", () => {
  runPause();
});

slowBtn.addEventListener("click", () => {
  toggleSlow();
});

phToggleBtn.addEventListener("click", () => {
  setPhExpanded(!state.phExpanded);
});

resetBtn.addEventListener("click", () => {
  runReset();
});

miniPlayBtn.addEventListener("click", () => {
  if (state.playing) {
    runPause();
  } else {
    runPlay();
  }
});

miniResetBtn.addEventListener("click", () => {
  runReset();
});

miniSlowBtn.addEventListener("click", () => {
  toggleSlow();
});

if (window.matchMedia("(max-width: 700px)").matches) {
  setPhExpanded(false);
} else {
  setPhExpanded(true);
}

syncInputs();
requestAnimationFrame(tick);
