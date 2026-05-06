import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WebcamCapture from "../components/WebcamCapture";
import TextToSign from "../components/TextToSign";
import "./Translator.css";

function Translator() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("sign2text");

  return (
    <div className="translator">
      <header className="translator__header">
        <button className="translator__back" onClick={() => navigate("/")}>
          <span className="translator__back-arrow">←</span>
          <span>Back</span>
        </button>
        <div className="translator__brand">
          <span className="translator__brand-icon">🤟</span>
          <span className="translator__brand-name">SignBridge</span>
        </div>
        <div className="translator__live-badge">
          <span className="translator__live-dot" />
          LIVE
        </div>
      </header>

      <div className="translator__tabs">
        <button
          className={`translator__tab ${tab === "sign2text" ? "translator__tab-active" : ""}`}
          onClick={() => setTab("sign2text")}
        >
          <span className="tab-icon">📷</span>
          Sign → Text
        </button>
        <button
          className={`translator__tab ${tab === "text2sign" ? "translator__tab-active" : ""}`}
          onClick={() => setTab("text2sign")}
        >
          <span className="tab-icon">⌨️</span>
          Text → Sign
        </button>
      </div>

      <main className="translator__main">
        {tab === "sign2text" ? <WebcamCapture /> : <TextToSign />}
      </main>
    </div>
  );
}

export default Translator;