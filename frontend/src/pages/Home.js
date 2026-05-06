import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Animated grid-dot background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cols = Math.ceil(canvas.width / 48) + 1;
      const rows = Math.ceil(canvas.height / 48) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * 48;
          const y = r * 48;
          const dist = Math.sqrt(
            Math.pow(x - canvas.width / 2, 2) +
            Math.pow(y - canvas.height / 2, 2)
          );
          const wave = Math.sin(dist / 80 - t * 0.018) * 0.5 + 0.5;
          const alpha = wave * 0.18 + 0.03;
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 230, 180, ${alpha})`;
          ctx.fill();
        }
      }
      t++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const signs = ["hello", "thanks", "yes", "no", "please", "sorry", "help", "good", "bad", "water", "eat", "friend"];

  return (
    <div className="home">
      <canvas ref={canvasRef} className="home__canvas" />

      {/* Top nav bar */}
      <nav className="home__nav">
        <div className="home__nav-logo">
          <span className="home__nav-icon">🤟</span>
          <span className="home__nav-name">SignBridge</span>
        </div>
        <div className="home__nav-tag">ISL · Real-Time · AI</div>
      </nav>

      {/* Hero */}
      <main className="home__hero">
        <div className="home__eyebrow">
          <span className="home__eyebrow-dot" />
          Indian Sign Language Translator
        </div>

        <h1 className="home__title">
          <span className="home__title-line1">Bridge the</span>
          <span className="home__title-line2">Silence</span>
        </h1>

        <p className="home__subtitle">
          Real-time AI translation of Indian Sign Language — point your camera,<br />
          and let every gesture speak.
        </p>

        {/* CTA with pulse rings */}
        <div className="home__cta-wrap">
          <div className="home__pulse-ring home__pulse-ring--1" />
          <div className="home__pulse-ring home__pulse-ring--2" />
          <div className="home__pulse-ring home__pulse-ring--3" />
          <button
            className="home__start-btn"
            onClick={() => navigate("/translator")}
          >
            <span className="home__btn-icon">▶</span>
            Start Translating
          </button>
        </div>

        {/* Stats row */}
        <div className="home__stats">
          <div className="home__stat">
            <span className="home__stat-number">12</span>
            <span className="home__stat-label">Signs</span>
          </div>
          <div className="home__stat-divider" />
          <div className="home__stat">
            <span className="home__stat-number">30</span>
            <span className="home__stat-label">FPS</span>
          </div>
          <div className="home__stat-divider" />
          <div className="home__stat">
            <span className="home__stat-number">AI</span>
            <span className="home__stat-label">Powered</span>
          </div>
        </div>
      </main>

      {/* Scrolling signs ticker */}
      <div className="home__ticker-wrap">
        <div className="home__ticker">
          {[...signs, ...signs].map((s, i) => (
            <span key={i} className="home__ticker-item">{s}</span>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <section className="home__features">
        {[
          {
            icon: "✋",
            title: "Two-Hand Detection",
            desc: "Tracks both hands simultaneously for complex ISL signs requiring dual-hand gestures.",
          },
          {
            icon: "⚡",
            title: "Real-Time Processing",
            desc: "MediaPipe keypoint extraction at 30fps with LSTM model inference under 400ms.",
          },
          {
            icon: "🗣️",
            title: "Voice Output",
            desc: "Text-to-speech conversion of detected signs for seamless communication.",
          },
        ].map((f, i) => (
          <div className="home__feature-card" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
            <div className="home__feature-icon">{f.icon}</div>
            <h3 className="home__feature-title">{f.title}</h3>
            <p className="home__feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="home__footer">
        <span>Built with MediaPipe · TensorFlow · React</span>
        <span className="home__footer-dot">·</span>
        <span>SignBridge © 2025</span>
      </footer>
    </div>
  );
}

export default Home;