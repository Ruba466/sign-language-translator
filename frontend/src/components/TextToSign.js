import React, { useEffect, useRef, useState, useCallback } from "react";
import "./TextToSign.css";

// ── Colour palette ────────────────────────────────────────────────────────────
const SK   = "#f2c49a";   // skin fill
const SKS  = "#c9844a";   // skin stroke
const SKM  = "#e8a865";   // skin mid (joints)
const SH   = "#6bacd6";   // shirt
const SHK  = "#4a85b0";   // shirt dark
const PN   = "#3d6595";   // pants
const PND  = "#2d4d75";   // pants dark cuff
const HR   = "#5c3010";   // hair
const SHO  = "#e8ddd0";   // shoe highlight
const SHK2 = "#403028";   // shoe dark

// ── Avatar dimensions (canvas 220 × 320) ─────────────────────────────────────
const HX = 110, HY = 52, HRAD = 28;       // head centre & radius
const SHX = 110, SHY = 108;               // shoulder mid
const LSHX = SHX - 30, RSHX = SHX + 30;  // shoulder joints
const HIP  = 195;
const UAL  = 42;   // upper arm length
const FAL  = 36;   // forearm length

// ── Arm FK: given shoulder angle + elbow bend → elbow & wrist positions ───────
function armPoints(side, sh, el) {
  const sx  = side === "L" ? LSHX : RSHX;
  const sy  = SHY;
  const shR = (sh - 90) * Math.PI / 180;   // 0 = pointing down
  const ex  = sx + Math.cos(shR) * UAL;
  const ey  = sy + Math.sin(shR) * UAL;
  const elR = shR + el * Math.PI / 180;
  const wx  = ex + Math.cos(elR) * FAL;
  const wy  = ey + Math.sin(elR) * FAL;
  return { sx, sy, ex, ey, wx, wy };
}

// ── Hand shapes ───────────────────────────────────────────────────────────────
function drawHand(ctx, wx, wy, handAngle, shape, side) {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(handAngle * Math.PI / 180);
  const L = side === "L" ? -1 : 1;

  ctx.fillStyle   = SK;
  ctx.strokeStyle = SKS;
  ctx.lineWidth   = 1.5;

  // Palm
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  const seg = (ax, ay, bx, by, w = 5.5) => {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.strokeStyle = SKS; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.stroke();
  };
  const dot = (x, y, r = 3.5) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = SKM; ctx.fill();
    ctx.strokeStyle = SKS; ctx.lineWidth = 1; ctx.stroke();
  };
  const finger = (angleDeg, len, w = 5.5) => {
    const a = angleDeg * Math.PI / 180;
    seg(Math.sin(a) * 7, -Math.cos(a) * 7,
        Math.sin(a) * (7 + len), -Math.cos(a) * (7 + len), w);
    dot(Math.sin(a) * (7 + len), -Math.cos(a) * (7 + len));
  };
  const curl = (angleDeg) => {
    const a = angleDeg * Math.PI / 180;
    seg(Math.sin(a) * 7, -Math.cos(a) * 7,
        Math.sin(a) * 11, -Math.cos(a) * 11 + 4, 6);
  };

  switch (shape) {
    case "open":
      [-28, -14, 0, 14, 28].forEach(a => finger(a, 15));
      break;

    case "fist":
      [-15, -5, 5, 15].forEach(a => curl(a));
      seg(-8 * L, 0, -13 * L, -4, 6);
      break;

    case "point2":
      finger(-10, 15); finger(4, 15);
      [14, 22].forEach(a => curl(a));
      seg(-8 * L, 0, -12 * L, -3, 5);
      break;

    case "thumbup":
      [-15, -5, 5, 15].forEach(a => curl(a));
      seg(-8 * L, 0, -8 * L, -18, 7);
      dot(-8 * L, -18, 4);
      break;

    case "thumbdn":
      [-15, -5, 5, 15].forEach(a => curl(a));
      seg(-8 * L, 0, -8 * L, 18, 7);
      dot(-8 * L, 18, 4);
      break;

    case "W":
      [-18, -4, 10].forEach(a => finger(a, 15));
      curl(22);
      seg(-8 * L, 0, -12 * L, -3, 5);
      break;

    case "pinch":
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 12 * Math.PI / 180;
        seg(Math.sin(a) * 7, -Math.cos(a) * 7,
            Math.sin(a) * 14, -Math.cos(a) * 14, 5);
      }
      dot(0, -14, 3);
      break;

    case "hook":
      {
        const a = -15 * L * Math.PI / 180;
        seg(Math.sin(a) * 7, -Math.cos(a) * 7,
            Math.sin(a) * 17, -Math.cos(a) * 12);
        dot(Math.sin(a) * 17, -Math.cos(a) * 12);
        [-5, 5, 15].forEach(x => curl(x));
        seg(-8 * L, 0, -12 * L, -3, 5);
      }
      break;

    case "flat":
      for (let i = 0; i < 4; i++) {
        const a = (i * 6 - 9) * Math.PI / 180;
        seg(Math.sin(a) * 7, -Math.cos(a) * 7,
            Math.sin(a) * 22, -Math.cos(a) * 22, 5.5);
      }
      dot(0, -22, 3.5);
      seg(-8 * L, 0, -14 * L, -8, 6);
      dot(-14 * L, -8);
      break;

    default:
      break;
  }
  ctx.restore();
}

// ── Full avatar renderer ──────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function drawAvatar(ctx, pose, tween = 1, prev = null) {
  const p = prev || pose;
  const v = (a, b) => lerp(a, b, tween);

  ctx.clearRect(0, 0, 220, 320);

  const lsh = v(p.lsh, pose.lsh), lel = v(p.lel, pose.lel), lha = v(p.lha, pose.lha);
  const rsh = v(p.rsh, pose.rsh), rel = v(p.rel, pose.rel), rha = v(p.rha, pose.rha);
  const ht  = v(p.ht || 0, pose.ht || 0);

  const LA = armPoints("L", lsh, lel);
  const RA = armPoints("R", rsh, rel);

  // ── Legs ──────────────────────────────────────────────────────────────────
  ctx.strokeStyle = PN; ctx.lineWidth = 20; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(HX - 10, HIP); ctx.lineTo(HX - 12, 252); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(HX + 10, HIP); ctx.lineTo(HX + 12, 252); ctx.stroke();

  ctx.strokeStyle = PND; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(HX - 12, 252); ctx.lineTo(HX - 12, 296); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(HX + 12, 252); ctx.lineTo(HX + 12, 296); ctx.stroke();

  // Shoes
  ctx.fillStyle = SHK2;
  ctx.beginPath(); ctx.ellipse(HX - 14, 302, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(HX + 14, 302, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SHO;
  ctx.beginPath(); ctx.ellipse(HX - 19, 300, 7, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(HX + 19, 300, 7, 5,  0.3, 0, Math.PI * 2); ctx.fill();

  // ── Torso ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = SH;
  ctx.beginPath();
  ctx.moveTo(HX - 28, SHY + 5);
  ctx.bezierCurveTo(HX - 38, SHY + 62, HX - 30, HIP - 12, HX - 18, HIP);
  ctx.lineTo(HX + 18, HIP);
  ctx.bezierCurveTo(HX + 30, HIP - 12, HX + 38, SHY + 62, HX + 28, SHY + 5);
  ctx.closePath(); ctx.fill();

  // Collar
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(HX - 10, SHY + 5);
  ctx.lineTo(HX, SHY + 30);
  ctx.lineTo(HX + 10, SHY + 5);
  ctx.closePath(); ctx.fill();

  // Shoulder seam
  ctx.fillStyle = SHK;
  ctx.beginPath(); ctx.ellipse(HX, SHY + 2, 32, 9, 0, 0, Math.PI * 2); ctx.fill();

  // ── Arms ──────────────────────────────────────────────────────────────────
  const drawArm = (pts, side, hs, ha) => {
    // Upper arm
    ctx.strokeStyle = SHK; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts.sx, pts.sy); ctx.lineTo(pts.ex, pts.ey); ctx.stroke();
    // Elbow
    ctx.fillStyle = SK;
    ctx.beginPath(); ctx.arc(pts.ex, pts.ey, 7, 0, Math.PI * 2); ctx.fill();
    // Forearm
    ctx.strokeStyle = SK; ctx.lineWidth = 11; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts.ex, pts.ey); ctx.lineTo(pts.wx, pts.wy); ctx.stroke();
    // Wrist
    ctx.fillStyle = SK;
    ctx.beginPath(); ctx.arc(pts.wx, pts.wy, 6, 0, Math.PI * 2); ctx.fill();
    // Hand
    drawHand(ctx, pts.wx, pts.wy, ha, hs, side);
  };

  drawArm(LA, "L", pose.lhs, lha);
  drawArm(RA, "R", pose.rhs, rha);

  // ── Head ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(HX, HY);
  ctx.rotate(ht * Math.PI / 180);

  // Neck
  ctx.fillStyle = SK;
  ctx.beginPath(); ctx.ellipse(0, HRAD - 2, 7, 10, 0, 0, Math.PI * 2); ctx.fill();

  // Face
  ctx.fillStyle = SK;
  ctx.beginPath(); ctx.ellipse(0, 0, HRAD, HRAD + 3, 0, 0, Math.PI * 2); ctx.fill();

  // Hair layers
  ctx.fillStyle = HR;
  ctx.beginPath(); ctx.ellipse(0, -HRAD + 4, HRAD + 1, HRAD * 0.55, 0, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-HRAD + 4, -4, HRAD * 0.32, HRAD * 0.5, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(HRAD - 4, -4, HRAD * 0.32, HRAD * 0.5,  0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -HRAD - 4, HRAD * 0.38, HRAD * 0.28, 0, 0, Math.PI * 2); ctx.fill();

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.ellipse(-10, 1, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 10, 1, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a7050";
  ctx.beginPath(); ctx.arc(-10, 1, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 10, 1, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(-10, 1, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 10, 1, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath(); ctx.arc(-8, -0.5, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, -0.5, 1, 0, Math.PI * 2); ctx.fill();

  // Eyebrows
  ctx.strokeStyle = "#8B5020"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-16, -9); ctx.quadraticCurveTo(-10, -13, -4, -10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -10);  ctx.quadraticCurveTo(10, -13, 16, -9);   ctx.stroke();

  // Cheek blush
  ctx.fillStyle = "rgba(240,130,110,0.22)";
  ctx.beginPath(); ctx.ellipse(-17, 9, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 17, 9, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

  // Nose
  ctx.fillStyle = SKM;
  ctx.beginPath(); ctx.ellipse(0, 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

  // Smile
  ctx.strokeStyle = "#c07070"; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, 13, 7, 0.2, Math.PI - 0.2); ctx.stroke();

  ctx.restore();
}

// ── Sign database ─────────────────────────────────────────────────────────────
// lsh/rsh: upper arm angle (0=down, 90=forward, 135=up-forward, 180=straight up)
// lel/rel: elbow bend (0=straight, positive=bends forward)
// lha/rha: hand rotation at wrist in degrees
// lhs/rhs: hand shape ('open','fist','point2','thumbup','thumbdn','W','pinch','hook','flat')
// ht: head tilt
const SIGNS = {
  hello: {
    ml: "ഹലോ", hi: "नमस्ते",
    desc: "Open hand near temple, palm out — wave in small arc.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist",  rsh:135,rel:-30,rha:-80,rhs:"open", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist",  rsh:140,rel:-25,rha:-70,rhs:"open", ht:5  },
      { lsh:20,lel:0,lha:0,lhs:"fist",  rsh:145,rel:-20,rha:-60,rhs:"open", ht:5  },
      { lsh:20,lel:0,lha:0,lhs:"fist",  rsh:148,rel:-15,rha:-50,rhs:"open", ht:3  },
      { lsh:20,lel:0,lha:0,lhs:"fist",  rsh:145,rel:-20,rha:-60,rhs:"open", ht:0  },
    ],
  },
  yes: {
    ml: "അതെ", hi: "हाँ",
    desc: "Make a fist — nod wrist down twice.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:70,rha:-10,rhs:"fist", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:60,rha:-10,rhs:"fist", ht:-7 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:70,rha:-10,rhs:"fist", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:60,rha:-10,rhs:"fist", ht:-7 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:70,rha:-10,rhs:"fist", ht:0  },
    ],
  },
  no: {
    ml: "ഇല്ല", hi: "नहीं",
    desc: "Index + middle fingers extended — wag side to side.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:75,rel:60,rha:30,  rhs:"point2", ht:-4 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:75,rel:60,rha:0,   rhs:"point2", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:75,rel:60,rha:-30, rhs:"point2", ht:4  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:75,rel:60,rha:0,   rhs:"point2", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:75,rel:60,rha:30,  rhs:"point2", ht:-4 },
    ],
  },
  good: {
    ml: "നല്ലത്", hi: "अच्छा",
    desc: "Thumbs up — raise fist with thumb extended upward.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:55,rel:55,rha:0,rhs:"thumbup", ht:0 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:58,rel:50,rha:0,rhs:"thumbup", ht:4 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:45,rha:0,rhs:"thumbup", ht:6 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:58,rel:50,rha:0,rhs:"thumbup", ht:4 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:55,rel:55,rha:0,rhs:"thumbup", ht:0 },
    ],
  },
  bad: {
    ml: "മോശം", hi: "बुरा",
    desc: "Thumbs down — fist with thumb pointing downward.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:55,rel:55,rha:0,rhs:"thumbdn", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:58,rel:52,rha:0,rhs:"thumbdn", ht:-4 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:48,rha:0,rhs:"thumbdn", ht:-6 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:58,rel:52,rha:0,rhs:"thumbdn", ht:-4 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:55,rel:55,rha:0,rhs:"thumbdn", ht:0  },
    ],
  },
  thanks: {
    ml: "നന്ദി", hi: "धन्यवाद",
    desc: "Flat hand at chin — move forward and outward.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:105,rel:55,rha:-40,rhs:"flat", ht:0 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:100,rel:45,rha:-35,rhs:"flat", ht:3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:92, rel:35,rha:-30,rhs:"flat", ht:5 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:85, rel:28,rha:-25,rhs:"flat", ht:4 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:80, rel:22,rha:-20,rhs:"flat", ht:2 },
    ],
  },
  water: {
    ml: "വെള്ളം", hi: "पानी",
    desc: "W-shape hand taps chin twice.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:105,rel:60,rha:-50,rhs:"W", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:108,rel:55,rha:-50,rhs:"W", ht:-3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:105,rel:60,rha:-50,rhs:"W", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:108,rel:55,rha:-50,rhs:"W", ht:-3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:105,rel:60,rha:-50,rhs:"W", ht:0  },
    ],
  },
  please: {
    ml: "ദയവായി", hi: "कृपया",
    desc: "Flat hand circles on chest clockwise.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:65,rel:75,rha:-20,rhs:"flat", ht:0 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:60,rel:78,rha:-35,rhs:"flat", ht:2 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:68,rel:80,rha:-10,rhs:"flat", ht:2 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:72,rel:76,rha:0,  rhs:"flat", ht:0 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:65,rel:75,rha:-20,rhs:"flat", ht:0 },
    ],
  },
  sorry: {
    ml: "ക്ഷമിക്കണം", hi: "माफ़ करना",
    desc: "Fist rubs in circle on chest — apologetic motion.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:62,rel:78,rha:-10,rhs:"fist", ht:-3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:58,rel:80,rha:-20,rhs:"fist", ht:-3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:65,rel:82,rha:0,  rhs:"fist", ht:-3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:70,rel:78,rha:10, rhs:"fist", ht:-3 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:62,rel:78,rha:-10,rhs:"fist", ht:-3 },
    ],
  },
  help: {
    ml: "സഹായം", hi: "मदद",
    desc: "Flat hand as platform — fist (thumb up) rises from below.",
    poses: [
      { lsh:90,lel:65,lha:10,lhs:"flat", rsh:62,rel:72,rha:0,rhs:"thumbup", ht:0 },
      { lsh:90,lel:62,lha:10,lhs:"flat", rsh:62,rel:62,rha:0,rhs:"thumbup", ht:3 },
      { lsh:90,lel:58,lha:10,lhs:"flat", rsh:62,rel:52,rha:0,rhs:"thumbup", ht:5 },
      { lsh:90,lel:62,lha:10,lhs:"flat", rsh:62,rel:62,rha:0,rhs:"thumbup", ht:3 },
      { lsh:90,lel:65,lha:10,lhs:"flat", rsh:62,rel:72,rha:0,rhs:"thumbup", ht:0 },
    ],
  },
  eat: {
    ml: "കഴിക്കുക", hi: "खाना",
    desc: "Pinched fingers tap toward mouth twice.",
    poses: [
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:110,rel:55,rha:-55,rhs:"pinch", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:115,rel:50,rha:-60,rhs:"pinch", ht:-5 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:110,rel:55,rha:-55,rhs:"pinch", ht:0  },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:115,rel:50,rha:-60,rhs:"pinch", ht:-5 },
      { lsh:20,lel:0,lha:0,lhs:"fist", rsh:110,rel:55,rha:-55,rhs:"pinch", ht:0  },
    ],
  },
  friend: {
    ml: "സുഹൃത്ത്", hi: "दोस्त",
    desc: "Hook index fingers together — swap positions.",
    poses: [
      { lsh:85,lel:62,lha:18, lhs:"hook", rsh:85,rel:62,rha:-18,rhs:"hook", ht:0 },
      { lsh:88,lel:58,lha:14, lhs:"hook", rsh:82,rel:58,rha:-14,rhs:"hook", ht:3 },
      { lsh:92,lel:55,lha:10, lhs:"hook", rsh:78,rel:55,rha:-10,rhs:"hook", ht:5 },
      { lsh:88,lel:58,lha:14, lhs:"hook", rsh:82,rel:58,rha:-14,rhs:"hook", ht:3 },
      { lsh:85,lel:62,lha:18, lhs:"hook", rsh:85,rel:62,rha:-18,rhs:"hook", ht:0 },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function TextToSign() {
  const canvasRef     = useRef(null);
  const timerRef      = useRef(null);
  const tweenTimerRef = useRef(null);
  const prevPoseRef   = useRef(null);
  const tweenRef      = useRef(1);

  const [inputText,  setInputText]  = useState("");
  const [words,      setWords]      = useState([]);
  const [wordIdx,    setWordIdx]    = useState(0);
  const [frameIdx,   setFrameIdx]   = useState(0);
  const [tween,      setTween]      = useState(1);
  const [playing,    setPlaying]    = useState(false);
  const [speed,      setSpeed]      = useState(450);
  const [activeWord, setActiveWord] = useState("");

  const wordsRef    = useRef([]);
  const wordIdxRef  = useRef(0);
  const frameIdxRef = useRef(0);
  const speedRef    = useRef(450);

  useEffect(() => { wordsRef.current    = words;    }, [words]);
  useEffect(() => { wordIdxRef.current  = wordIdx;  }, [wordIdx]);
  useEffect(() => { frameIdxRef.current = frameIdx; }, [frameIdx]);
  useEffect(() => { speedRef.current    = speed;    }, [speed]);

  // Render whenever state changes
  useEffect(() => {
    if (!words.length) return;
    const sign = SIGNS[words[wordIdx]];
    if (!sign) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAvatar(ctx, sign.poses[frameIdx], tween, prevPoseRef.current);
  }, [words, wordIdx, frameIdx, tween]);

  const tick = useCallback(() => {
    const ws = wordsRef.current;
    if (!ws.length) return;
    let wi   = wordIdxRef.current;
    let fi   = frameIdxRef.current;
    const sign = SIGNS[ws[wi]];
    if (!sign) {
      const newWi = (wi + 1) % ws.length;
      setWordIdx(newWi); setFrameIdx(0);
      setActiveWord(ws[newWi] || "");
      return;
    }
    prevPoseRef.current = sign.poses[fi];
    fi++;
    if (fi >= sign.poses.length) {
      fi = 0;
      const newWi = (wi + 1) % ws.length;
      setWordIdx(newWi);
      setActiveWord(ws[newWi] || "");
    }
    setFrameIdx(fi);
    tweenRef.current = 0;
    setTween(0);
    if (tweenTimerRef.current) clearInterval(tweenTimerRef.current);
    tweenTimerRef.current = setInterval(() => {
      tweenRef.current = Math.min(1, tweenRef.current + 0.12);
      setTween(tweenRef.current);
      if (tweenRef.current >= 1) clearInterval(tweenTimerRef.current);
    }, 16);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, speedRef.current);
  }, [tick]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (playing) startTimer(); else stopTimer();
    return stopTimer;
  }, [playing, speed, startTimer, stopTimer]);

  const handleAnimate = useCallback(() => {
    const ws = inputText.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (!ws.length) return;
    prevPoseRef.current = null;
    tweenRef.current = 1;
    setWords(ws); setWordIdx(0); setFrameIdx(0); setTween(1);
    setActiveWord(ws[0] || ""); setPlaying(true);
  }, [inputText]);

  const handleClear = useCallback(() => {
    setWords([]); setPlaying(false); setInputText(""); setActiveWord("");
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, 220, 320);
  }, []);

  const jumpTo = useCallback((i) => {
    prevPoseRef.current = null; tweenRef.current = 1;
    setWordIdx(i); setFrameIdx(0); setTween(1);
    setActiveWord(words[i] || "");
  }, [words]);

  const currentSign = SIGNS[activeWord];

  return (
    <div className="tts-page">
      <div className="tts-input-row">
        <input className="tts-input" type="text"
          placeholder="Type: hello good water thanks..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAnimate()} />
        <button className="tts-btn tts-btn-primary" onClick={handleAnimate}>▶ Animate</button>
        <button className="tts-btn" onClick={handleClear}>✕ Clear</button>
      </div>

      {words.length > 0 && (
        <div className="tts-chips">
          {words.map((w, i) => {
            const has = !!SIGNS[w];
            return (
              <button key={i} onClick={() => jumpTo(i)}
                className={`tts-chip ${wordIdx === i ? "tts-chip-active" : ""} ${!has ? "tts-chip-missing" : ""}`}>
                {w}{!has && <span className="tts-chip-warn"> ?</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="tts-main">
        <div className="tts-canvas-card">
          <div className="tts-word-label">{activeWord || "—"}</div>
          <canvas ref={canvasRef} width={220} height={320} className="tts-canvas" />

          {words.length > 0 && SIGNS[words[wordIdx]] && (
            <div className="tts-progress-wrap">
              <div className="tts-progress-bg">
                <div className="tts-progress-fill"
                  style={{ width: `${((frameIdx + 1) / SIGNS[words[wordIdx]].poses.length) * 100}%` }} />
              </div>
              <span className="tts-frame-count">
                {frameIdx + 1}/{SIGNS[words[wordIdx]].poses.length}
              </span>
            </div>
          )}

          <div className="tts-controls">
            <button className="tts-btn" onClick={() => setPlaying(v => !v)} disabled={!words.length}>
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <select className="tts-select" value={speed} onChange={e => setSpeed(+e.target.value)}>
              <option value={800}>Slow</option>
              <option value={450}>Normal</option>
              <option value={220}>Fast</option>
            </select>
          </div>
        </div>

        <div className="tts-info-panel">
          <div className="tts-info-label">HOW TO SIGN</div>
          <div className="tts-desc-box">
            {currentSign ? currentSign.desc
              : activeWord ? `"${activeWord}" not in database yet.`
              : "Type words above and click Animate."}
          </div>

          {currentSign && (
            <>
              <div className="tts-info-label" style={{ marginTop: 16 }}>TRANSLATIONS</div>
              <div className="tts-trans-row">
                {[
                  { lang: "English",   val: activeWord },
                  { lang: "Malayalam", val: currentSign.ml },
                  { lang: "Hindi",     val: currentSign.hi },
                ].map(({ lang, val }) => (
                  <div className="tts-trans-chip" key={lang}>
                    <span className="tts-trans-lang">{lang.toUpperCase()}</span>
                    <span className="tts-trans-word">{val}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="tts-info-label" style={{ marginTop: 16 }}>AVAILABLE SIGNS</div>
          <div className="tts-available">
            {Object.keys(SIGNS).map(s => (
              <span key={s}
                className={`tts-avail-pill ${activeWord === s ? "tts-avail-active" : ""}`}
                onClick={() => {
                  setInputText(s);
                  prevPoseRef.current = null; tweenRef.current = 1;
                  setWords([s]); setWordIdx(0); setFrameIdx(0); setTween(1);
                  setActiveWord(s); setPlaying(true);
                }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}