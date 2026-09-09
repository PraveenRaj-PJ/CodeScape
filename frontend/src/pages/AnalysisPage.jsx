import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { analyzeProject } from "../services/api";

import "./AnalysisPage.css";

const analysisStages = [
  {
    label: "Reading project",
    description: "Preparing uploaded source files",
  },
  {
    label: "Extracting source files",
    description: "Inspecting project contents",
  },
  {
    label: "Building architecture",
    description: "Parsing Python modules and relationships",
  },
  {
    label: "Scanning security",
    description: "Security analysis will use the structural model",
  },
  {
    label: "Evaluating quality",
    description: "Calculating structural code metrics",
  },
  {
    label: "Generating recommendations",
    description: "Preparing contextual recommendations",
  },
  {
    label: "Constructing CodeScape",
    description: "Preparing the visual software structure",
  },
];

function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const project = location.state?.project;

  const [currentStage, setCurrentStage] = useState(0);

  const [progress, setProgress] = useState(0);

  const [analysisFinished, setAnalysisFinished] = useState(false);

  const [analysisResult, setAnalysisResult] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");

  /*
   * Redirect users who enter /analysis
   * without uploading a project.
   */
  useEffect(() => {
    if (!project) {
      navigate("/upload", {
        replace: true,
      });
    }
  }, [navigate, project]);

  /*
   * Start the REAL backend analysis.
   */
  useEffect(() => {
    if (!project) {
      return;
    }

    let cancelled = false;

    async function runAnalysis() {
      try {
        const result = await analyzeProject(
          project.project_id,
          project.filename,
        );

        if (!cancelled) {
          setAnalysisResult(result);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Project analysis failed.");
        }
      }
    }

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [project]);

  /*
   * Move the visual pipeline forward.
   */
  useEffect(() => {
    if (!project || errorMessage) {
      return;
    }

    if (currentStage < analysisStages.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStage((previousStage) => previousStage + 1);
      }, 850);

      return () => clearTimeout(timer);
    }

    /*
     * The final stage can only finish
     * when the actual backend result exists.
     */
    if (currentStage === analysisStages.length - 1 && analysisResult) {
      const timer = setTimeout(() => {
        setAnalysisFinished(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentStage, analysisResult, errorMessage, project]);

  /*
   * Calculate progress.
   */
  useEffect(() => {
    if (analysisFinished) {
      setProgress(100);

      return;
    }

    const calculatedProgress =
      ((currentStage + 1) / analysisStages.length) * 100;

    setProgress(Math.min(calculatedProgress, 99));
  }, [currentStage, analysisFinished]);

  if (!project) {
    return null;
  }

  const structure = analysisResult?.structure;

  const summary = structure?.summary;

  const securitySummary = structure?.security_summary;

  const qualitySummary = structure?.quality_summary;

  const qualityFindings = structure?.quality_findings || [];

  const securityFindings = structure?.security_findings || [];

  /*
   * Safe fallback values.
   *
   * Some older backend responses may not contain
   * modules or methods yet.
   */
  const pythonFiles = summary?.python_files ?? 0;

  const modules = summary?.modules ?? 0;

  const classes = summary?.classes ?? 0;

  const functions = summary?.functions ?? 0;

  const methods = summary?.methods ?? 0;

  const imports = summary?.imports ?? 0;

  const qualityTotal = qualitySummary?.total_findings ?? 0;

  const qualityHigh = qualitySummary?.high_findings ?? 0;

  const qualityMedium = qualitySummary?.medium_findings ?? 0;

  const qualityLow = qualitySummary?.low_findings ?? 0;

  const securityTotal = securitySummary?.total_findings ?? 0;

  const securityCritical = securitySummary?.critical_findings ?? 0;

  const securityHigh = securitySummary?.high_findings ?? 0;

  const securityMedium = securitySummary?.medium_findings ?? 0;

  /*
   * Collect complexity metrics from all files.
   */
  const complexityMetrics = [];

  const nestingMetrics = [];

  const files = structure?.files || [];

  files.forEach((file) => {
    const quality = file.quality;

    if (!quality) {
      return;
    }

    (quality.complexity || []).forEach((item) => {
      complexityMetrics.push({
        ...item,
        file: file.file,
      });
    });

    (quality.nesting || []).forEach((item) => {
      nestingMetrics.push({
        ...item,
        file: file.file,
      });
    });
  });

  const highestComplexity =
    complexityMetrics.length > 0
      ? Math.max(...complexityMetrics.map((item) => item.value))
      : 0;

  const highestNesting =
    nestingMetrics.length > 0
      ? Math.max(...nestingMetrics.map((item) => item.value))
      : 0;

  return (
    <div className="analysis-page">
      <header className="analysis-navbar">
        <div className="analysis-logo">
          <span className="analysis-logo-mark">C</span>

          <span>CODESCAPE</span>
        </div>

        <div className="analysis-step">
          STEP <strong>02</strong> / 03
        </div>
      </header>

      <main className="analysis-main">
        <div className="analysis-header">
          <div className="analysis-eyebrow">CODE INTELLIGENCE ENGINE</div>

          <h1>
            {analysisFinished ? (
              <>
                Structure
                <br />
                <span>prepared.</span>
              </>
            ) : (
              <>
                Analyzing
                <br />
                <span>your software.</span>
              </>
            )}
          </h1>

          <p>{project.filename}</p>
        </div>

        <section className="analysis-panel">
          <div className="analysis-progress-header">
            <div>
              <span>ANALYSIS PROGRESS</span>

              <strong>{Math.round(progress)}%</strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          <div className="analysis-stages">
            {analysisStages.map((stage, index) => {
              const isCompleted = analysisFinished || index < currentStage;

              const isActive = !analysisFinished && index === currentStage;

              return (
                <div
                  className={`analysis-stage ${
                    isCompleted ? "completed" : ""
                  } ${isActive ? "active" : ""}`}
                  key={stage.label}
                >
                  <div className="stage-indicator">
                    {isCompleted ? (
                      "✓"
                    ) : isActive ? (
                      <span className="stage-spinner" />
                    ) : (
                      "○"
                    )}
                  </div>

                  <div className="stage-content">
                    <strong>{stage.label}</strong>

                    <span>{stage.description}</span>
                  </div>

                  <div className="stage-status">
                    {isCompleted ? "DONE" : isActive ? "RUNNING" : "WAITING"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {errorMessage && (
          <div className="analysis-error">
            <div className="analysis-error-mark">!</div>

            <div>
              <strong>Analysis failed</strong>

              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="analysis-project-info">
          <div>
            <span>PROJECT ID</span>

            <strong>{project.project_id}</strong>
          </div>

          <div>
            <span>ARCHIVE SIZE</span>

            <strong>
              {(project.size_bytes / (1024 * 1024)).toFixed(2)}
              {" MB"}
            </strong>
          </div>

          <div>
            <span>FORMAT</span>

            <strong>ZIP</strong>
          </div>
        </div>

        {analysisFinished && summary && (
          <>
            {/* ========================= */}
            {/* STRUCTURAL ANALYSIS */}
            {/* ========================= */}

            <section className="analysis-results">
              <div className="results-heading">
                <span>STRUCTURAL ANALYSIS</span>

                <strong>REAL AST RESULTS</strong>
              </div>

              <div className="results-grid">
                <div className="result-card">
                  <strong>{pythonFiles}</strong>

                  <span>PYTHON FILES</span>
                </div>

                <div className="result-card">
                  <strong>{modules}</strong>

                  <span>MODULES</span>
                </div>

                <div className="result-card">
                  <strong>{classes}</strong>

                  <span>CLASSES</span>
                </div>

                <div className="result-card">
                  <strong>{functions}</strong>

                  <span>FUNCTIONS</span>
                </div>

                <div className="result-card">
                  <strong>{methods}</strong>

                  <span>METHODS</span>
                </div>

                <div className="result-card">
                  <strong>{imports}</strong>

                  <span>IMPORTS</span>
                </div>
              </div>

              <div className="analysis-complete">
                <div className="complete-mark">✓</div>

                <div>
                  <strong>Python structure extracted successfully</strong>

                  <p>
                    CodeScape has generated the first structural model of your
                    project.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================= */}
            {/* CODE QUALITY ANALYSIS */}
            {/* ========================= */}

            <section className="analysis-results">
              <div className="results-heading">
                <span>CODE QUALITY ANALYSIS</span>

                <strong>STATIC QUALITY METRICS</strong>
              </div>

              <div className="results-grid">
                <div className="result-card">
                  <strong>{qualityTotal}</strong>

                  <span>QUALITY FINDINGS</span>
                </div>

                <div className="result-card">
                  <strong>{qualityHigh}</strong>

                  <span>HIGH</span>
                </div>

                <div className="result-card">
                  <strong>{qualityMedium}</strong>

                  <span>MEDIUM</span>
                </div>

                <div className="result-card">
                  <strong>{qualityLow}</strong>

                  <span>LOW</span>
                </div>

                <div className="result-card">
                  <strong>{highestComplexity}</strong>

                  <span>MAX COMPLEXITY</span>
                </div>

                <div className="result-card">
                  <strong>{highestNesting}</strong>

                  <span>MAX NESTING</span>
                </div>
              </div>

              {/* Quality findings */}
              {qualityFindings.length > 0 ? (
                <div className="analysis-complete">
                  <div className="complete-mark">!</div>

                  <div>
                    <strong>Code quality issues detected</strong>

                    <p>
                      CodeScape identified {qualityTotal} measurable quality
                      characteristic
                      {qualityTotal === 1 ? "" : "s"} that may affect
                      maintainability or readability.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="analysis-complete">
                  <div className="complete-mark">✓</div>

                  <div>
                    <strong>No major quality issues detected</strong>

                    <p>
                      The analyzed Python source passed the current CodeScape
                      quality rules.
                    </p>
                  </div>
                </div>
              )}

              {/* Detailed quality findings */}
              {qualityFindings.length > 0 && (
                <div
                  className="analysis-findings"
                  style={{
                    marginTop: "24px",
                  }}
                >
                  {qualityFindings.slice(0, 12).map((finding, index) => (
                    <div
                      className="analysis-finding"
                      key={`${finding.id}-${finding.file}-${finding.line}-${index}`}
                    >
                      <div
                        className="finding-header"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "16px",
                          marginBottom: "8px",
                        }}
                      >
                        <strong>{finding.title}</strong>

                        <span>{finding.severity.toUpperCase()}</span>
                      </div>

                      <p>
                        <strong>{finding.file}</strong>

                        {" • Line "}

                        {finding.line}
                      </p>

                      <p>{finding.description}</p>

                      <p>
                        <strong>Recommendation:</strong>{" "}
                        {finding.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {qualityFindings.length > 12 && (
                <p
                  style={{
                    marginTop: "16px",
                    opacity: 0.65,
                    fontSize: "12px",
                  }}
                >
                  Showing the first 12 quality findings. The complete result
                  remains available in the backend analysis model.
                </p>
              )}
            </section>

            {/* ========================= */}
            {/* SECURITY ANALYSIS */}
            {/* ========================= */}

            <section className="analysis-results">
              <div className="results-heading">
                <span>SECURITY ANALYSIS</span>

                <strong>STATIC SECURITY RULES</strong>
              </div>

              <div className="results-grid">
                <div className="result-card">
                  <strong>{securityTotal}</strong>

                  <span>FINDINGS</span>
                </div>

                <div className="result-card">
                  <strong>{securityCritical}</strong>

                  <span>CRITICAL</span>
                </div>

                <div className="result-card">
                  <strong>{securityHigh}</strong>

                  <span>HIGH</span>
                </div>

                <div className="result-card">
                  <strong>{securityMedium}</strong>

                  <span>MEDIUM</span>
                </div>
              </div>

              {securityFindings.length === 0 ? (
                <div className="analysis-complete">
                  <div className="complete-mark">✓</div>

                  <div>
                    <strong>No security findings detected</strong>

                    <p>
                      The current deterministic security rules did not identify
                      any known issues in the analyzed Python source.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="analysis-complete">
                  <div className="complete-mark">!</div>

                  <div>
                    <strong>Security findings detected</strong>

                    <p>
                      CodeScape identified {securityTotal} security finding
                      {securityTotal === 1 ? "" : "s"} requiring review.
                    </p>
                  </div>
                </div>
              )}
            </section>
            {/* ========================= */}
            {/* ARCHITECTURE DASHBOARD */}
            {/* ========================= */}

            <section className="architecture-navigation">
              <div>
                <span className="architecture-navigation-label">
                  NEXT: ARCHITECTURE INTELLIGENCE
                </span>

                <h2>Explore your software structure</h2>

                <p>
                  View modules, classes, functions and dependency relationships
                  as an interactive architectural model.
                </p>
              </div>

              <button
                className="architecture-navigation-button"
                onClick={() =>
                  navigate("/architecture", {
                    state: {
                      analysis: analysisResult,
                    },
                  })
                }
              >
                Open Architecture Dashboard
                <span>→</span>
              </button>
            </section>
          </>
        )}
      </main>

      <footer className="analysis-footer">
        <span>CODESCAPE ANALYSIS PIPELINE</span>

        <div className="analysis-pipeline">
          <span>UPLOAD</span>

          <i></i>

          <span className="active">ANALYZE</span>

          <i></i>

          <span>VISUALIZE</span>
        </div>
      </footer>
    </div>
  );
}

export default AnalysisPage;
