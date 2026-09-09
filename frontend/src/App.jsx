import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

import "./App.css";

import UploadPage from "./pages/UploadPage";
import AnalysisPage from "./pages/AnalysisPage";
import ArchitecturePage from "./pages/ArchitecturePage";
import CodeScape3DPage from "./pages/CodeScape3DPage";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <span className="logo-mark">C</span>
          <span className="logo-text">CODESCAPE</span>
        </div>

        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About</a>
        </nav>

        <button className="nav-button" onClick={() => navigate("/upload")}>
          Analyze My Code
        </button>
      </header>

      <main>
        {/* ==========================================
            HERO
        ========================================== */}

        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="status-dot"></span>
              AI-ASSISTED CODE INTELLIGENCE
            </div>

            <h1>
              Turn Your Code
              <br />
              Into a <span>Living Structure.</span>
            </h1>

            <p className="hero-description">
              CodeScape analyzes your software, maps its architecture, discovers
              security weaknesses, and transforms your code into an interactive
              visual structure.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => navigate("/upload")}
              >
                <span>Analyze My Code</span>
                <span className="arrow">→</span>
              </button>

              <a href="#features" className="secondary-button">
                Explore CodeScape
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong>01</strong>
                <span>Upload</span>
              </div>

              <div className="stat-line"></div>

              <div>
                <strong>02</strong>
                <span>Analyze</span>
              </div>

              <div className="stat-line"></div>

              <div>
                <strong>03</strong>
                <span>Visualize</span>
              </div>
            </div>
          </div>

          {/* ==========================================
              HERO VISUAL
          ========================================== */}

          <div className="hero-visual">
            <div className="visual-glow"></div>

            <div className="building">
              <div className="building-label">
                <span className="pulse"></span>
                SOFTWARE STRUCTURE
              </div>

              <div className="building-top">
                <div className="roof-line"></div>
              </div>

              <div className="building-body">
                <div className="building-section section-one">
                  <div className="window-row">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>

                  <div className="window-row">
                    <span></span>
                    <span className="damaged"></span>
                    <span></span>
                  </div>

                  <div className="window-row">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>

                <div className="building-section section-two">
                  <div className="module-title">AUTH</div>

                  <div className="module-line"></div>
                  <div className="module-line short"></div>
                  <div className="module-line"></div>

                  <div className="warning-mark">!</div>
                </div>

                <div className="building-section section-three">
                  <div className="window-row">
                    <span></span>
                    <span></span>
                  </div>

                  <div className="window-row">
                    <span></span>
                    <span className="damaged"></span>
                  </div>

                  <div className="window-row">
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>

              <div className="building-base">
                <div className="base-door"></div>
              </div>
            </div>

            <div className="floating-card security-card">
              <div className="card-icon danger">!</div>

              <div>
                <strong>Security Issue</strong>

                <span>SQL Injection</span>
              </div>
            </div>

            <div className="floating-card quality-card">
              <div className="card-icon success">✓</div>

              <div>
                <strong>Code Quality</strong>

                <span>Good Structure</span>
              </div>
            </div>

            <div className="floating-card ai-card">
              <div className="card-icon ai">✦</div>

              <div>
                <strong>AI Recommendation</strong>

                <span>Add input validation</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            FEATURES
        ========================================== */}

        <section className="features" id="features">
          <div className="section-heading">
            <span>CORE CAPABILITIES</span>

            <h2>
              Understand your software
              <br />
              at a glance.
            </h2>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-number">01</div>

              <h3>Security Analysis</h3>

              <p>
                Detect vulnerabilities and security weaknesses before they
                become real-world problems.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-number">02</div>

              <h3>Architecture Mapping</h3>

              <p>
                Transform classes, functions, modules and dependencies into an
                understandable software structure.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-number">03</div>

              <h3>AI Recommendations</h3>

              <p>
                Receive contextual explanations and improvement suggestions
                based on your analyzed code.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-number">04</div>

              <h3>Interactive Visualization</h3>

              <p>
                Explore your software as a living structure where weaknesses
                become visible.
              </p>
            </article>
          </div>
        </section>

        {/* ==========================================
            WORKFLOW
        ========================================== */}

        <section className="workflow" id="how-it-works">
          <div className="section-heading centered">
            <span>THE CODESCAPE WORKFLOW</span>

            <h2>
              From source code
              <br />
              to software structure.
            </h2>
          </div>

          <div className="workflow-line">
            <div className="workflow-step">
              <div className="step-circle">01</div>

              <h3>Upload</h3>

              <p>Upload your project as a ZIP file.</p>
            </div>

            <div className="workflow-connector"></div>

            <div className="workflow-step">
              <div className="step-circle">02</div>

              <h3>Analyze</h3>

              <p>CodeScape examines structure, quality and security.</p>
            </div>

            <div className="workflow-connector"></div>

            <div className="workflow-step">
              <div className="step-circle">03</div>

              <h3>Understand</h3>

              <p>Explore weaknesses through an interactive structure.</p>
            </div>

            <div className="workflow-connector"></div>

            <div className="workflow-step">
              <div className="step-circle">04</div>

              <h3>Improve</h3>

              <p>Use intelligent recommendations to strengthen your code.</p>
            </div>
          </div>
        </section>

        {/* ==========================================
            FINAL CTA
        ========================================== */}

        <section className="final-cta" id="about">
          <div>
            <span>BUILD BETTER SOFTWARE</span>

            <h2>
              Your code has a structure.
              <br />
              <em>Let's make it visible.</em>
            </h2>
          </div>

          <button
            className="primary-button large"
            onClick={() => navigate("/upload")}
          >
            Start Analyzing
            <span className="arrow">→</span>
          </button>
        </section>
      </main>

      {/* ==========================================
          FOOTER
      ========================================== */}

      <footer className="footer">
        <div className="logo">
          <span className="logo-mark">C</span>

          <span className="logo-text">CODESCAPE</span>
        </div>

        <p>Intelligent code analysis & interactive software visualization.</p>

        <span className="version">v0.1.4</span>
      </footer>
    </div>
  );
}

/* =====================================================
   APP ROUTER
   ===================================================== */

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}

        <Route path="/" element={<LandingPage />} />

        {/* Upload Page */}

        <Route path="/upload" element={<UploadPage />} />

        {/* Analysis Page */}

        <Route path="/analysis" element={<AnalysisPage />} />

        {/* Architecture Dashboard */}

        <Route path="/architecture" element={<ArchitecturePage />} />

        {/* 3D Software Building */}

        <Route path="/codescape" element={<CodeScape3DPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
