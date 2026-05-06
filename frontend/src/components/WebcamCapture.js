import React, { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const WIDTH         = 800;
const HEIGHT        = 600;
const API_URL       = "http://127.0.0.1:8000/predict";
const POLL_INTERVAL = 400; // ms between API calls

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  bad:    { en: "bad",    ml: "മോശം",       hi: "बुरा"       },
  eat:    { en: "eat",    ml: "കഴിക്കുക",   hi: "खाना"       },
  friend: { en: "friend", ml: "സുഹൃത്ത്",   hi: "दोस्त"      },
  good:   { en: "good",   ml: "നല്ലത്",     hi: "अच्छा"      },
  hello:  { en: "hello",  ml: "ഹലോ",        hi: "नमस्ते"     },
  help:   { en: "help",   ml: "സഹായം",      hi: "मदद"        },
  no:     { en: "no",     ml: "ഇല്ല",        hi: "नहीं"       },
  please: { en: "please", ml: "ദയവായി",     hi: "कृपया"      },
  sorry:  { en: "sorry",  ml: "ക്ഷമിക്കണം",  hi: "माफ़ करना"  },
  thanks: { en: "thanks", ml: "നന്ദി",       hi: "धन्यवाद"    },
  water:  { en: "water",  ml: "വെള്ളം",     hi: "पानी"       },
  yes:    { en: "yes",    ml: "അതെ",         hi: "हाँ"        },
};

const LANG_CODES  = { en: "en-US", ml: "ml-IN", hi: "hi-IN" };
const LANG_LABELS = { en: "English", ml: "മലയാളം", hi: "हिंदी" };
const SIGNS       = Object.keys(T);

// ── Speech ────────────────────────────────────────────────────────────────────
function speak(text, langCode) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang  = langCode;
  u.rate  = 0.92;
  const v = window.speechSynthesis.getVoices()
              .find(x => x.lang.startsWith(langCode.split("-")[0]));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WebcamCapture() {
  const webcamRef    = useRef(null);
  const canvasRef    = useRef(null);
  const timerRef     = useRef(null);   // setInterval handle
  const isFetchingRef = useRef(false);

  // live states
  const [prediction,   setPrediction]   = useState("—");
  const [confidence,   setConfidence]   = useState(0);
  const [status,       setStatus]       = useState("Initializing...");
  const [handCount,    setHandCount]    = useState(0);
  const [collecting,   setCollecting]   = useState(false);
  const [collectPct,   setCollectPct]   = useState(0);
  const [language,     setLanguage]     = useState("en");
  const [autoSpeak,    setAutoSpeak]    = useState(true);
  const [sentence,     setSentence]     = useState([]);
  const [isSpeakAll,   setIsSpeakAll]   = useState(false);

  // refs so callbacks always see latest values
  const langRef      = useRef("en");
  const autoSpeakRef = useRef(true);
  useEffect(() => { langRef.current      = language;  }, [language]);
  useEffect(() => { autoSpeakRef.current = autoSpeak; }, [autoSpeak]);

  // ── Translation helper ────────────────────────────────────────────────────
  const tr = useCallback((key) => {
    const k = key?.toLowerCase();
    return T[k]?.[language] ?? key;
  }, [language]);

  // ── Speak helpers ─────────────────────────────────────────────────────────
  const speakWord = useCallback((key) => {
    const lang = langRef.current;
    speak(T[key?.toLowerCase()]?.[lang] ?? key, LANG_CODES[lang]);
  }, []);

  const speakAll = useCallback((words) => {
    if (!words.length) return;
    setIsSpeakAll(true);
    const lang = langRef.current;
    const text = words.map(w => T[w]?.[lang] ?? w).join(" ");
    const u    = new SpeechSynthesisUtterance(text);
    u.lang     = LANG_CODES[lang];
    u.rate     = 0.88;
    const v    = window.speechSynthesis.getVoices()
                   .find(x => x.lang.startsWith(lang));
    if (v) u.voice = v;
    u.onend = () => setIsSpeakAll(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  // ── Handle ONE prediction result from backend ─────────────────────────────
  // This is called every POLL_INTERVAL ms.
  const handleResult = useCallback((result, conf) => {
    if (!result) return;

    if (result.startsWith("Collecting")) {
      const m = result.match(/(\d+)\/(\d+)/);
      if (m) setCollectPct(Math.round((+m[1] / +m[2]) * 100));
      setCollecting(true);
      setPrediction("Collecting...");
      setConfidence(0);
      return;
    }

    if (result === "..." || result === "Error") {
      setCollecting(false);
      setCollectPct(0);
      // Don't wipe prediction — keep last visible word
      return;
    }

    // ── Valid word from backend ───────────────────────────────────────────
    // Backend already guarantees:
    //  - word changed from last sent
    //  - confidence > 0.75
    //  - buffer hard-reset after sending
    setCollecting(false);
    setCollectPct(0);
    setPrediction(result);
    setConfidence(Math.round(conf * 100));

    // Append to sentence — no dedup needed here, backend controls frequency
    setSentence(prev => [...prev, result.toLowerCase()].slice(-14));

    // Auto-speak
    if (autoSpeakRef.current) speakWord(result.toLowerCase());

  }, [speakWord]);

  // ── Polling loop ──────────────────────────────────────────────────────────
  // Runs every POLL_INTERVAL ms and sends the current webcam frame.
  // Uses setInterval instead of calling inside onResults — this decouples
  // MediaPipe's frame rate from the API call rate.
  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(async () => {
      if (isFetchingRef.current) return;
      if (!webcamRef.current)    return;

      const img = webcamRef.current.getScreenshot();
      if (!img) return;

      isFetchingRef.current = true;
      try {
        const res = await axios.post(
          API_URL,
          { image: img },
          { timeout: 3000 }
        );
        handleResult(res.data.prediction, res.data.confidence || 0);
      } catch (_) {
        // ignore
      } finally {
        isFetchingRef.current = false;
      }
    }, POLL_INTERVAL);
  }, [handleResult]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetAll = useCallback(async () => {
    setPrediction("—");
    setConfidence(0);
    setCollecting(false);
    setCollectPct(0);
    setSentence([]);
    window.speechSynthesis.cancel();
    try { await axios.post("http://127.0.0.1:8000/reset"); } catch (_) {}
  }, []);

  // ── MediaPipe ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const poll = setInterval(() => {
      const video = webcamRef.current?.video;
      if (!video) return;
      clearInterval(poll);

      const canvas = canvasRef.current;
      const ctx    = canvas.getContext("2d");
      let alive    = true;

      const hands = new Hands({
        locateFile: f =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`,
      });

      hands.setOptions({
        maxNumHands: 2, modelComplexity: 1,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });

      hands.onResults(res => {
        if (!alive) return;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (res.multiHandLandmarks?.length > 0) {
          const n = res.multiHandLandmarks.length;
          setStatus(`✋ ${n} hand${n > 1 ? "s" : ""} detected`);
          setHandCount(n);
          for (const lm of res.multiHandLandmarks) {
            drawConnectors(ctx, lm, HAND_CONNECTIONS,
              { color: "#00FF00", lineWidth: 2 });
            drawLandmarks(ctx, lm,
              { color: "#FF0000", fillColor: "#00ffcc", lineWidth: 1, radius: 4 });
          }
        } else {
          setStatus("❌ No hand detected");
          setHandCount(0);
        }
        ctx.restore();
      });

      const cam = new Camera(video, {
        onFrame: async () => {
          if (!alive) return;
          try { await hands.send({ image: video }); } catch (_) {}
        },
        width: WIDTH, height: HEIGHT,
      });

      cam.start();
      setStatus("Camera ready ✅");
      startPolling();   // start API polling independently

      const cleanup = () => {
        alive = false;
        if (timerRef.current) clearInterval(timerRef.current);
        try { cam.stop();    } catch (_) {}
        try { hands.close(); } catch (_) {}
      };
      window.addEventListener("beforeunload", cleanup);
      return cleanup;
    }, 200);

    return () => clearInterval(poll);
  }, [startPolling]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const predKey   = prediction?.toLowerCase();
  const currTrans = T[predKey];
  const isReal    = prediction !== "—" && prediction !== "Collecting...";
  const confColor =
    confidence >= 85 ? "#00e6b4" :
    confidence >= 65 ? "#ffcc00" : "#ff6644";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Controls */}
      <div style={S.bar}>
        <div style={S.grp}>
          <span style={S.micro}>OUTPUT LANGUAGE</span>
          <div style={S.row}>
            {Object.entries(LANG_LABELS).map(([code, lbl]) => (
              <button key={code}
                style={{ ...S.lBtn, ...(language === code ? S.lOn : {}) }}
                onClick={() => setLanguage(code)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={S.grp}>
          <span style={S.micro}>AUTO SPEAK</span>
          <button
            style={{ ...S.tBtn, ...(autoSpeak ? S.tOn : {}) }}
            onClick={() => setAutoSpeak(v => !v)}>
            <span style={{ ...S.dot, ...(autoSpeak ? S.dotOn : {}) }} />
            {autoSpeak ? "ON" : "OFF"}
          </button>
        </div>

        <button style={{ ...S.iBtn, marginLeft: "auto" }} onClick={resetAll}>
          🔄 Reset Buffer
        </button>
      </div>

      {/* Camera + right panel */}
      <div style={S.main}>

        {/* Camera */}
        <div style={S.camWrap}>
          <Webcam ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={WIDTH} height={HEIGHT}
            mirrored={true} style={S.cam} />
          <canvas ref={canvasRef}
            width={WIDTH} height={HEIGHT} style={S.cvs} />

          <div style={{
            ...S.badge,
            borderColor: handCount > 0 ? "#00e6b4" : "#ff4444",
            color:       handCount > 0 ? "#00e6b4" : "#ff6666",
            background:  handCount > 0
              ? "rgba(0,230,180,0.1)" : "rgba(255,50,50,0.1)",
          }}>{status}</div>

          {collecting && (
            <div style={S.cBar}>
              <span style={S.cTxt}>⏳ Building... {collectPct}%</span>
              <div style={S.pBg}>
                <div style={{ ...S.pFill, width: `${collectPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div style={S.right}>

          {/* Detected card */}
          <div style={S.card}>
            <div style={S.eye}>DETECTED SIGN</div>
            <div style={S.big}>
              {collecting ? "..." : isReal ? tr(predKey) : "—"}
            </div>

            {isReal && currTrans && (
              <div style={S.tStack}>
                {Object.entries(currTrans).map(([lang, w]) => (
                  <div key={lang} style={{
                    ...S.tRow,
                    borderColor:     language === lang
                      ? "rgba(0,230,180,0.35)"
                      : "rgba(255,255,255,0.06)",
                    backgroundColor: language === lang
                      ? "rgba(0,230,180,0.07)" : "transparent",
                  }}>
                    <span style={S.tLang}>{LANG_LABELS[lang]}</span>
                    <span style={{
                      ...S.tWord,
                      color: language === lang ? "#00e6b4" : "#aab",
                    }}>{w}</span>
                    <button style={S.spkBtn}
                      onClick={() => speak(w, LANG_CODES[lang])}>🔊</button>
                  </div>
                ))}
              </div>
            )}

            {confidence > 0 && isReal && (
              <div style={S.cRow}>
                <span style={S.cLbl}>Confidence</span>
                <div style={S.cBg}>
                  <div style={{
                    ...S.cFill,
                    width: `${confidence}%`,
                    backgroundColor: confColor,
                  }} />
                </div>
                <span style={{ ...S.cVal, color: confColor }}>{confidence}%</span>
              </div>
            )}
          </div>

          {/* Signs */}
          <div style={S.card}>
            <div style={S.eye}>AVAILABLE SIGNS</div>
            <div style={S.sGrid}>
              {SIGNS.map(sign => {
                const a = predKey === sign;
                return (
                  <div key={sign} style={{
                    ...S.sPill,
                    borderColor:     a ? "#00e6b4" : "rgba(255,255,255,0.07)",
                    backgroundColor: a ? "rgba(0,230,180,0.12)" : "transparent",
                    color:           a ? "#00e6b4" : "#445",
                    transform:       a ? "scale(1.1)" : "scale(1)",
                  }}>{sign}</div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sentence builder */}
      <div style={S.sent}>
        <div style={S.sHead}>
          <div style={S.sTitle}>
            <span style={S.sDot} />
            SENTENCE BUILDER
            {sentence.length > 0 &&
              <span style={S.wCnt}>
                {sentence.length} word{sentence.length !== 1 ? "s" : ""}
              </span>
            }
          </div>
          <div style={S.sActs}>
            <button
              disabled={!sentence.length}
              style={{
                ...S.sBtn, ...S.sBtnSpk,
                opacity:   sentence.length ? 1 : 0.35,
                animation: isSpeakAll ? "spkPulse 1s infinite" : "none",
              }}
              onClick={() => speakAll(sentence)}>
              {isSpeakAll ? "🔊 Speaking..." : "🔊 Speak All"}
            </button>
            <button
              disabled={!sentence.length}
              style={{ ...S.sBtn, opacity: sentence.length ? 1 : 0.35 }}
              onClick={() => setSentence(p => p.slice(0, -1))}>
              ⌫ Undo
            </button>
            <button
              disabled={!sentence.length}
              style={{ ...S.sBtn, opacity: sentence.length ? 1 : 0.35 }}
              onClick={() => setSentence([])}>
              ✕ Clear
            </button>
          </div>
        </div>

        <div style={S.sBox}>
          {sentence.length === 0
            ? <span style={S.sPlc}>
                Perform a sign — detected words appear here automatically...
              </span>
            : <div style={S.wBubs}>
                {sentence.map((w, i) => (
                  <span key={`${w}-${i}`} style={{
                    ...S.bub,
                    animation: i === sentence.length - 1
                      ? "wPop 0.35s ease" : "none",
                  }}>
                    {tr(w)}
                  </span>
                ))}
              </div>
          }
        </div>

        {sentence.length > 0 && (
          <div style={S.sTGrid}>
            {Object.entries(LANG_LABELS).map(([lang, lbl]) => {
              const txt = sentence.map(w => T[w]?.[lang] ?? w).join(" ");
              return (
                <div key={lang} style={{
                  ...S.sTCard,
                  borderColor:     language === lang
                    ? "rgba(0,230,180,0.25)"
                    : "rgba(255,255,255,0.05)",
                  backgroundColor: language === lang
                    ? "rgba(0,230,180,0.04)" : "rgba(0,0,0,0.2)",
                }}>
                  <div style={S.sTTop}>
                    <span style={S.sTLang}>{lbl}</span>
                    <button style={S.spkBtn}
                      onClick={() => speak(txt, LANG_CODES[lang])}>🔊</button>
                  </div>
                  <p style={{
                    ...S.sTxt,
                    color: language === lang ? "#dffff6" : "#4a5a6a",
                  }}>{txt}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={S.tips}>
        <span>💡 Hold gesture steady for ~1 sec</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>💡 Lower hand between signs — auto-resets</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>💡 Two-handed: thanks, help, friend</span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes wPop {
          0%   { transform:scale(0.6) translateY(10px);opacity:0 }
          65%  { transform:scale(1.12) translateY(-2px);opacity:1 }
          100% { transform:scale(1) translateY(0) }
        }
        @keyframes spkPulse {
          0%,100%{box-shadow:0 0 0 0 rgba(0,230,180,0.4)}
          50%{box-shadow:0 0 0 8px rgba(0,230,180,0)}
        }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:{ display:"flex",flexDirection:"column",alignItems:"center",
    backgroundColor:"#08090d",minHeight:"100vh",padding:"20px 16px 48px",
    fontFamily:"'DM Sans',sans-serif",color:"#f0f4f8",gap:"18px" },

  bar:{ display:"flex",alignItems:"flex-end",gap:"20px",
    width:"100%",maxWidth:"1060px",
    backgroundColor:"rgba(255,255,255,0.025)",
    border:"1px solid rgba(0,230,180,0.1)",
    borderRadius:"14px",padding:"14px 20px",flexWrap:"wrap" },
  grp:{ display:"flex",flexDirection:"column",gap:"6px" },
  micro:{ fontSize:"9px",letterSpacing:"3px",color:"#2a3a4a",fontWeight:700 },
  row:{ display:"flex",gap:"6px" },
  lBtn:{ padding:"7px 16px",borderRadius:"8px",
    border:"1px solid rgba(255,255,255,0.08)",
    background:"transparent",color:"#445",
    fontSize:"13px",fontWeight:600,cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s" },
  lOn:{ borderColor:"#00e6b4",backgroundColor:"rgba(0,230,180,0.1)",color:"#00e6b4" },
  tBtn:{ display:"flex",alignItems:"center",gap:"8px",
    padding:"7px 16px",borderRadius:"8px",
    border:"1px solid rgba(255,255,255,0.08)",
    background:"transparent",color:"#445",
    fontSize:"12px",fontWeight:700,cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",letterSpacing:"1px",transition:"all 0.2s" },
  tOn:{ borderColor:"#00e6b4",backgroundColor:"rgba(0,230,180,0.08)",color:"#00e6b4" },
  dot:{ width:"7px",height:"7px",borderRadius:"50%",
    backgroundColor:"#2a3a4a",transition:"all 0.2s",flexShrink:0 },
  dotOn:{ backgroundColor:"#00e6b4",boxShadow:"0 0 7px rgba(0,230,180,0.7)" },
  iBtn:{ padding:"8px 18px",borderRadius:"10px",
    border:"1px solid rgba(255,255,255,0.07)",
    background:"transparent",color:"#445",
    fontSize:"12px",fontWeight:600,cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif" },

  main:{ display:"flex",gap:"18px",
    width:"100%",maxWidth:"1060px",alignItems:"flex-start" },
  camWrap:{ position:"relative",borderRadius:"16px",overflow:"hidden",
    border:"2px solid rgba(0,230,180,0.12)",
    boxShadow:"0 0 40px rgba(0,230,180,0.06)",flexShrink:0 },
  cam:{ display:"block" },
  cvs:{ position:"absolute",top:0,left:0,pointerEvents:"none" },
  badge:{ position:"absolute",top:"12px",left:"12px",
    padding:"6px 14px",borderRadius:"20px",border:"1px solid",
    fontSize:"12px",fontWeight:600,backdropFilter:"blur(10px)" },
  cBar:{ position:"absolute",bottom:0,left:0,right:0,
    backgroundColor:"rgba(0,0,0,0.78)",padding:"12px 18px",
    backdropFilter:"blur(6px)" },
  cTxt:{ color:"#ffcc00",fontSize:"12px",fontWeight:600,
    display:"block",marginBottom:"7px" },
  pBg:{ width:"100%",height:"4px",
    backgroundColor:"rgba(255,255,255,0.07)",
    borderRadius:"2px",overflow:"hidden" },
  pFill:{ height:"100%",backgroundColor:"#ffcc00",
    borderRadius:"2px",transition:"width 0.3s" },

  right:{ flex:1,display:"flex",flexDirection:"column",gap:"14px",minWidth:0 },
  card:{ backgroundColor:"rgba(255,255,255,0.025)",
    border:"1px solid rgba(0,230,180,0.09)",
    borderRadius:"16px",padding:"20px" },
  eye:{ fontSize:"9px",letterSpacing:"4px",color:"#00e6b4",
    fontWeight:700,marginBottom:"10px" },
  big:{ fontFamily:"'Bebas Neue',sans-serif",
    fontSize:"52px",letterSpacing:"4px",color:"#fff",
    lineHeight:1,marginBottom:"14px",textTransform:"capitalize" },
  tStack:{ display:"flex",flexDirection:"column",gap:"7px",marginBottom:"14px" },
  tRow:{ display:"flex",alignItems:"center",gap:"10px",
    padding:"9px 14px",borderRadius:"10px",border:"1px solid",transition:"all 0.25s" },
  tLang:{ fontSize:"9px",letterSpacing:"2px",color:"#334",fontWeight:700,
    textTransform:"uppercase",width:"64px",flexShrink:0 },
  tWord:{ flex:1,fontSize:"16px",fontWeight:600 },
  spkBtn:{ background:"transparent",border:"none",fontSize:"14px",
    cursor:"pointer",padding:"0 4px",opacity:0.6,flexShrink:0 },
  cRow:{ display:"flex",alignItems:"center",gap:"10px" },
  cLbl:{ color:"#334",fontSize:"11px",width:"74px",flexShrink:0 },
  cBg:{ flex:1,height:"5px",backgroundColor:"rgba(255,255,255,0.05)",
    borderRadius:"3px",overflow:"hidden" },
  cFill:{ height:"100%",borderRadius:"3px",
    transition:"width 0.5s,background-color 0.5s" },
  cVal:{ fontSize:"11px",fontWeight:700,width:"36px",
    textAlign:"right",flexShrink:0 },
  sGrid:{ display:"flex",flexWrap:"wrap",gap:"6px" },
  sPill:{ padding:"5px 12px",borderRadius:"20px",border:"1px solid",
    fontSize:"12px",fontWeight:600,transition:"all 0.25s",
    textTransform:"capitalize",cursor:"default" },

  sent:{ width:"100%",maxWidth:"1060px",
    backgroundColor:"rgba(255,255,255,0.02)",
    border:"1px solid rgba(0,230,180,0.09)",
    borderRadius:"18px",padding:"22px" },
  sHead:{ display:"flex",justifyContent:"space-between",
    alignItems:"center",marginBottom:"14px" },
  sTitle:{ display:"flex",alignItems:"center",gap:"8px",
    fontSize:"10px",letterSpacing:"3px",color:"#00e6b4",fontWeight:700 },
  sDot:{ width:"7px",height:"7px",borderRadius:"50%",
    backgroundColor:"#00e6b4",
    boxShadow:"0 0 8px rgba(0,230,180,0.6)",display:"inline-block" },
  wCnt:{ marginLeft:"8px",fontSize:"10px",letterSpacing:"1px",
    color:"#334",fontWeight:600 },
  sActs:{ display:"flex",gap:"7px" },
  sBtn:{ padding:"7px 14px",borderRadius:"9px",
    border:"1px solid rgba(255,255,255,0.07)",
    backgroundColor:"transparent",color:"#445",
    fontSize:"12px",fontWeight:600,cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s" },
  sBtnSpk:{ borderColor:"rgba(0,230,180,0.2)",
    backgroundColor:"rgba(0,230,180,0.06)",color:"#00e6b4" },
  sBox:{ minHeight:"60px",backgroundColor:"rgba(0,0,0,0.22)",
    borderRadius:"10px",padding:"14px 18px",marginBottom:"14px",
    border:"1px solid rgba(255,255,255,0.04)",
    display:"flex",alignItems:"center",flexWrap:"wrap" },
  sPlc:{ color:"#1e2e3e",fontSize:"13px",fontStyle:"italic" },
  wBubs:{ display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"center" },
  bub:{ fontSize:"21px",fontWeight:700,color:"#e0fff8",
    padding:"5px 14px",borderRadius:"10px",
    backgroundColor:"rgba(0,230,180,0.07)",
    border:"1px solid rgba(0,230,180,0.15)" },
  sTGrid:{ display:"flex",gap:"12px",flexWrap:"wrap" },
  sTCard:{ flex:1,minWidth:"160px",borderRadius:"12px",
    border:"1px solid",padding:"14px 16px",transition:"all 0.25s" },
  sTTop:{ display:"flex",justifyContent:"space-between",
    alignItems:"center",marginBottom:"6px" },
  sTLang:{ fontSize:"9px",letterSpacing:"2px",color:"#334",
    fontWeight:700,textTransform:"uppercase" },
  sTxt:{ fontSize:"15px",fontWeight:600,lineHeight:1.6,margin:0 },

  tips:{ display:"flex",gap:"20px",flexWrap:"wrap",justifyContent:"center" },
};