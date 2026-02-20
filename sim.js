const g = 10;
const TRACE_MAX = 5000;

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const diagCanvas = document.getElementById("diagCanvas");
const dctx = diagCanvas ? diagCanvas.getContext("2d") : null;

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
const graphModeSelect = document.getElementById("graphModeSelect");
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
  Fnet: 0,
  N: 0,
  T: 0,
  hCurrent: 0,
  hMax: 0,
  Ek: 0,
  Ep: 0,
  status: "Κατάσταση: Έτοιμο για εκκίνηση.",
  graphMode: graphModeSelect ? graphModeSelect.value : "v",
  trace: [],
  yMin: -0.2,
  yMax: 0.2,
  tAxisMax: 8,
  lastTime: null
};

function graphSeriesConfig() {
  switch (state.graphMode) {
    case "a":
      return { key: "a", label: "α(t) [m/s²]", color: "#6a4c93" };
    case "s":
      return { key: "s", label: "S(t) [m]", color: "#2a9d8f" };
    case "fnet":
      return { key: "fnet", label: "ΣF(t) [N]", color: "#d90429" };
    case "n":
      return { key: "n", label: "N(t) [N]", color: "#1d3557" };
    case "v":
    default:
      return { key: "v", label: "υ(t) [m/s]", color: "#f77f00" };
  }
}

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

function computeDynamics() {
  const theta = (state.thetaDeg * Math.PI) / 180;
  const Fh = activeForce();
  const N = normalMagnitude(theta);
  const drive = state.m * g * Math.sin(theta) - Fh * Math.cos(theta);
  const T = state.frictionOn ? state.mu * N : 0;
  const rawAlong = drive - T;

  state.a = Math.max(0, rawAlong / state.m);
  state.Fnet = state.m * state.a;
  state.N = N;
  state.T = state.frictionOn ? T : 0;
  state.hCurrent = Math.max(0, (state.planeLength - state.s) * Math.sin(theta));
  state.hMax = state.planeLength * Math.sin(theta);
  state.Ek = 0.5 * state.m * state.v * state.v;
  state.Ep = state.m * g * state.hCurrent;

  if (state.s >= state.planeLength) {
    state.status = "Κατάσταση: Έφτασε στη βάση του κεκλιμένου.";
  } else if (state.playing && state.a > 1e-6) {
    state.status = "Κατάσταση: Επιταχυνόμενη κίνηση στο κεκλιμένο.";
  } else if (state.playing && state.a <= 1e-6) {
    state.status = "Κατάσταση: Οριακή ισορροπία δυνάμεων (α≈0).";
  } else {
    state.status = "Κατάσταση: Παύση προσομοίωσης.";
  }
}

function pushHistory() {
  state.trace.push({
    t: state.elapsedTime,
    v: state.v,
    a: state.a,
    s: state.s,
    fnet: state.Fnet,
    n: state.N
  });
  if (state.trace.length > TRACE_MAX) {
    state.trace.shift();
  }
  updateTraceBounds();
}

function updateTraceBounds() {
  if (state.trace.length === 0) {
    state.yMin = -0.2;
    state.yMax = 0.2;
    state.tAxisMax = 0.5;
    return;
  }
  const { key } = graphSeriesConfig();
  const values = state.trace.map((p) => p[key]);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const span = Math.max(0.15, vMax - vMin);
  const pad = 0.18 * span;
  if (state.trace.length <= 1) {
    state.yMin = vMin - pad;
    state.yMax = vMax + pad;
  } else {
    state.yMin = Math.min(state.yMin, vMin - pad);
    state.yMax = Math.max(state.yMax, vMax + pad);
  }
  const lastT = state.trace[state.trace.length - 1].t;
  state.tAxisMax = Math.max(0.5, lastT);
}

function resetTraceAtCurrentTime() {
  state.trace = [{
    t: state.elapsedTime,
    v: state.v,
    a: state.a,
    s: state.s,
    fnet: state.Fnet,
    n: state.N
  }];
  updateTraceBounds();
}

function updateReadouts() {
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
  currentHeightValue.textContent = state.hCurrent.toFixed(2);
  phCurrentHeightValue.textContent = state.hCurrent.toFixed(2);
  heightValue.textContent = state.hMax.toFixed(2);
  phHeightValue.textContent = state.hMax.toFixed(2);

  const impactText = state.impactSpeed === null ? "-" : `${state.impactSpeed.toFixed(2)} m/s`;
  impactValue.textContent = impactText;
  phImpactValue.textContent = impactText;
}

function drawArrow(x, y, vx, vy, color, label) {
  if (Math.hypot(vx, vy) < 1) {
    return;
  }

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

function drawCanvasStatus(text) {
  if (!text) {
    return;
  }
  const padX = 12;
  const boxY = 10;
  ctx.font = "bold 14px Arial";
  const metrics = ctx.measureText(text);
  const boxW = Math.min(canvas.width - 24, metrics.width + padX * 2);
  const boxH = 28;
  const boxX = (canvas.width - boxW) / 2;

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.strokeStyle = "#b7c7da";
  ctx.lineWidth = 1.2;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#1d3557";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2 + 0.5, boxW - padX * 2);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
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
  ctx.fillText("θ", tx, ty);
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
    const nMag = state.N;
    const tMag = state.T;
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
        "T"
      );
    }
    drawArrow(
      blockCenter.x,
      blockCenter.y,
      geom.t.x * mgSin * scale,
      geom.t.y * mgSin * scale,
      "#2a9d8f",
      "mg ημθ"
    );
    drawArrow(
      blockCenter.x,
      blockCenter.y,
      -geom.n.x * mgCos * scale,
      -geom.n.y * mgCos * scale,
      "#6c757d",
      "mg συνθ"
    );

    if (state.pushOn && Fh > 0) {
      drawArrow(blockCenter.x, blockCenter.y, -Fh * scale, 0, "#7b2cbf", "F");
    }
  }

  ctx.fillStyle = "#0b1d3a";
  ctx.font = "15px Arial";
  ctx.fillText(`θ = ${state.thetaDeg.toFixed(0)}°`, geom.start.x + 10, geom.start.y - 18);
  drawCanvasStatus(state.status);
}

function drawMiniSeriesBox(x, y, w, h, label, points, key, color, minVal, maxVal, tMax) {
  dctx.strokeStyle = "#b5c5d9";
  dctx.fillStyle = "rgba(255,255,255,0.9)";
  dctx.lineWidth = 1.2;
  dctx.fillRect(x, y, w, h);
  dctx.strokeRect(x, y, w, h);

  dctx.fillStyle = "#2a3f5e";
  dctx.font = "bold 14px Arial";
  dctx.fillText(label, x + 8, y + 15);

  const plotX = x + 56;
  const plotY = y + 22;
  const plotW = w - 64;
  const plotH = h - 28;

  if (points.length < 2 || maxVal - minVal < 1e-9 || tMax <= 0) {
    return;
  }

  const toX = (t) => plotX + (t / tMax) * plotW;
  const toY = (v) => plotY + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;

  const yTicks = 5;
  dctx.font = "11px Arial";
  dctx.fillStyle = "#34506f";
  dctx.strokeStyle = "#d6e0eb";
  dctx.lineWidth = 1;
  for (let i = 0; i <= yTicks; i += 1) {
    const frac = i / yTicks;
    const yv = maxVal - frac * (maxVal - minVal);
    const py = plotY + frac * plotH;
    dctx.beginPath();
    dctx.moveTo(plotX, py);
    dctx.lineTo(plotX + plotW, py);
    dctx.stroke();
    dctx.fillText(yv.toFixed(2), x + 6, py + 4);
  }

  dctx.strokeStyle = color;
  dctx.lineWidth = 2.6;
  dctx.beginPath();
  points.forEach((p, i) => {
    const px = toX(p.t);
    const py = toY(p[key]);
    if (i === 0) {
      dctx.moveTo(px, py);
    } else {
      dctx.lineTo(px, py);
    }
  });
  dctx.stroke();

  const latest = points[points.length - 1];
  if (latest) {
    const yNow = toY(latest[key]);
    dctx.save();
    dctx.setLineDash([5, 4]);
    dctx.strokeStyle = "rgba(42, 63, 94, 0.55)";
    dctx.lineWidth = 1.3;
    dctx.beginPath();
    dctx.moveTo(plotX, yNow);
    dctx.lineTo(plotX + plotW, yNow);
    dctx.stroke();
    dctx.restore();

    dctx.fillStyle = "#2a3f5e";
    dctx.font = "bold 11px Arial";
    dctx.textAlign = "right";
    dctx.textBaseline = "middle";
    dctx.fillText(latest[key].toFixed(2), plotX + plotW - 4, yNow - 8);
    dctx.textAlign = "start";
    dctx.textBaseline = "alphabetic";
  }
}

function drawLiveBars(x, y, w, h) {
  dctx.fillStyle = "rgba(255,255,255,0.92)";
  dctx.strokeStyle = "#b5c5d9";
  dctx.lineWidth = 1.2;
  dctx.fillRect(x, y, w, h);
  dctx.strokeRect(x, y, w, h);

  const labels = ["|α|", "|υ|", "|ΣF|"];
  const colors = ["#6a4c93", "#f77f00", "#d90429"];
  const values = [Math.abs(state.a), Math.abs(state.v), Math.abs(state.Fnet)];
  const maxAbs = Math.max(1, ...values);
  const zeroY = y + h * 0.86;
  const innerPad = 10;
  const gap = 10;
  const barAreaW = Math.max(90, w - innerPad * 2 - gap * 2);
  const barW = Math.max(22, barAreaW / 3);
  const startX = x + innerPad;

  dctx.strokeStyle = "#c8d7e8";
  dctx.beginPath();
  dctx.moveTo(x + 8, zeroY);
  dctx.lineTo(x + w - 8, zeroY);
  dctx.stroke();

  values.forEach((v, i) => {
    const bh = (Math.abs(v) / maxAbs) * (h * 0.62);
    const bx = startX + i * (barW + gap);
    const by = zeroY - bh;
    dctx.fillStyle = colors[i];
    dctx.fillRect(bx, by, barW, bh);
    dctx.fillStyle = "#233c5b";
    dctx.font = "bold 12px Arial";
    dctx.fillText(labels[i], bx, y + h - 10);
    dctx.fillText(v.toFixed(2), bx, by - 5);
  });
}

function drawFormulaBox(x, y, w, h) {
  dctx.fillStyle = "rgba(255,255,255,0.93)";
  dctx.strokeStyle = "#b5c5d9";
  dctx.lineWidth = 1.2;
  dctx.fillRect(x, y, w, h);
  dctx.strokeRect(x, y, w, h);

  dctx.fillStyle = "#223854";
  dctx.font = "bold 14px Arial";
  dctx.fillText("Live σχέσεις", x + 8, y + 15);
  dctx.font = w < 300 ? "12px Arial" : "13px Arial";

  const theta = (state.thetaDeg * Math.PI) / 180;
  const Fh = activeForce();
  const l1 = `N = mg·συνθ + F·ημθ = ${state.N.toFixed(2)} N`;
  const l2 = `T = μN = ${state.T.toFixed(2)} N`;
  const l3 = `ΣF = mα = ${state.m.toFixed(2)}·${state.a.toFixed(2)} = ${state.Fnet.toFixed(2)} N`;
  const l4 = `α = gημθ - (F/m)συνθ - ${state.frictionOn ? "μN/m" : "0"} = ${state.a.toFixed(2)} m/s²`;
  const l5 = `Eκ=${state.Ek.toFixed(1)} J, Eπ=${state.Ep.toFixed(1)} J, θ=${state.thetaDeg.toFixed(0)}°`;

  dctx.fillText(l1, x + 8, y + 34);
  dctx.fillText(l2, x + 8, y + 52);
  dctx.fillText(l3, x + 8, y + 70);
  dctx.fillText(l4, x + 8, y + 88);
  dctx.fillText(l5, x + 8, y + 106);
}

function drawDiagnosticsPanel() {
  if (!dctx) {
    return;
  }

  dctx.clearRect(0, 0, diagCanvas.width, diagCanvas.height);

  const pad = 12;
  const graphCfg = graphSeriesConfig();
  const narrow = diagCanvas.width < 760;

  if (narrow) {
    const fullW = diagCanvas.width - pad * 2;
    const graphH = Math.floor(diagCanvas.height * 0.47);
    const barsH = Math.floor(diagCanvas.height * 0.23);
    const formulaH = diagCanvas.height - graphH - barsH - pad * 4;
    drawMiniSeriesBox(pad, pad, fullW, graphH, graphCfg.label, state.trace, graphCfg.key, graphCfg.color, state.yMin, state.yMax, state.tAxisMax);
    drawLiveBars(pad, pad * 2 + graphH, fullW, barsH);
    drawFormulaBox(pad, pad * 3 + graphH + barsH, fullW, formulaH);
  } else {
    const leftW = Math.floor(diagCanvas.width * 0.5);
    const rightW = diagCanvas.width - leftW - pad * 3;
    const gx = pad;
    const gy = pad;
    const gw = leftW;
    const graphH = diagCanvas.height - pad * 2;
    drawMiniSeriesBox(gx, gy, gw, graphH, graphCfg.label, state.trace, graphCfg.key, graphCfg.color, state.yMin, state.yMax, state.tAxisMax);

    const rightX = gx + gw + pad;
    const barsH = 165;
    drawLiveBars(rightX, gy, rightW, barsH);
    drawFormulaBox(rightX, gy + barsH + 8, rightW, diagCanvas.height - (gy + barsH + 8) - pad);
  }
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
    resetMotion();
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
  computeDynamics();
  resetTraceAtCurrentTime();
  syncTransportLabels();
  updateReadouts();
  drawScene();
  drawDiagnosticsPanel();
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

  computeDynamics();
  syncTransportLabels();
  updateReadouts();
  if (!state.playing) {
    resetTraceAtCurrentTime();
  }
}

function tick(timestamp) {
  if (state.lastTime === null) {
    state.lastTime = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000) * state.timeScale;
  state.lastTime = timestamp;

  computeDynamics();

  if (state.playing) {
    const nextS = state.s + state.v * dt + 0.5 * state.a * dt * dt;
    state.v += state.a * dt;
    state.elapsedTime += dt;
    state.s = Math.min(state.planeLength, nextS);

    if (state.s >= state.planeLength) {
      state.impactTime = state.elapsedTime;
      state.impactSpeed = state.v;
      state.s = state.planeLength;
      state.playing = false;
    }

    computeDynamics();
    pushHistory();
  }

  syncTransportLabels();
  updateReadouts();
  drawScene();
  drawDiagnosticsPanel();
  requestAnimationFrame(tick);
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

if (graphModeSelect) {
  graphModeSelect.addEventListener("change", () => {
    state.graphMode = graphModeSelect.value;
    state.yMin = -0.2;
    state.yMax = 0.2;
    updateTraceBounds();
  });
}

if (window.matchMedia("(max-width: 700px)").matches) {
  setPhExpanded(false);
} else {
  setPhExpanded(true);
}

syncInputs();
resetTraceAtCurrentTime();
requestAnimationFrame(tick);
