import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./ArchitecturePage.css";

function getSeverityClass(severity) {
  if (!severity) {
    return "severity-info";
  }

  return `severity-${severity.toLowerCase()}`;
}

function ArchitecturePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const analysis = location.state?.analysis;

  const structure = analysis?.structure;

  const architecture = structure?.architecture || {};

  const summary = structure?.summary || {};

  const modules = architecture.modules || [];

  const classes = architecture.classes || [];

  const functions = architecture.functions || [];

  const dependencies = architecture.dependencies || [];

  const architectureSummary = architecture.summary || {};

  const externalDependencies = useMemo(
    () => dependencies.filter((dependency) => dependency.type === "external"),
    [dependencies],
  );

  const internalDependencies = useMemo(
    () => dependencies.filter((dependency) => dependency.type === "internal"),
    [dependencies],
  );

  const getModuleFunctions = (moduleName) => {
    const moduleFunctions = functions.filter(
      (functionData) =>
        functionData.file &&
        functionData.file
          .replace(/\\/g, "/")
          .replace(/\.py$/, "")
          .replace(/\//g, ".") === moduleName,
    );

    return moduleFunctions;
  };

  const getModuleClasses = (moduleName) => {
    return classes.filter((classData) => {
      const normalizedFile = classData.file
        ?.replace(/\\/g, "/")
        .replace(/\.py$/, "")
        .replace(/\//g, ".");

      return normalizedFile === moduleName;
    });
  };

  return (
    <div className="architecture-page">
      {/* ======================================
          HEADER
      ====================================== */}

      <header className="architecture-header">
        <div>
          <p className="architecture-eyebrow">
            CODESCAPE ARCHITECTURE INTELLIGENCE
          </p>

          <h1>Architecture Overview</h1>

          <p className="architecture-subtitle">
            Explore the structural composition and dependency relationships of
            your software project.
          </p>
        </div>

        <button
          className="back-button"
          onClick={() =>
            navigate("/analysis", {
              state: {
                analysis,
              },
            })
          }
        >
          ← Back to Analysis
        </button>
      </header>

      {/* ======================================
          SUMMARY CARDS
      ====================================== */}

      <section className="architecture-summary-grid">
        <div className="architecture-summary-card">
          <span>Modules</span>
          <strong>{summary.modules ?? 0}</strong>
          <small>Python modules detected</small>
        </div>

        <div className="architecture-summary-card">
          <span>Classes</span>
          <strong>{summary.classes ?? 0}</strong>
          <small>Classes identified</small>
        </div>

        <div className="architecture-summary-card">
          <span>Functions</span>
          <strong>{summary.functions ?? 0}</strong>
          <small>Functions identified</small>
        </div>

        <div className="architecture-summary-card">
          <span>Methods</span>
          <strong>{summary.methods ?? 0}</strong>
          <small>Class methods identified</small>
        </div>

        <div className="architecture-summary-card">
          <span>Dependencies</span>
          <strong>
            {architectureSummary.total_dependencies ??
              summary.dependencies ??
              0}
          </strong>
          <small>Import relationships</small>
        </div>
      </section>

      {/* ======================================
          MODULES
      ====================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <div>
            <p className="section-label">STRUCTURAL MAP</p>

            <h2>Modules</h2>
          </div>

          <span className="section-count">{modules.length} detected</span>
        </div>

        {modules.length === 0 ? (
          <div className="empty-architecture">No modules were detected.</div>
        ) : (
          <div className="module-grid">
            {modules.map((module, index) => {
              const moduleFunctions = getModuleFunctions(module.name);

              const moduleClasses = getModuleClasses(module.name);

              return (
                <div className="module-card" key={`${module.name}-${index}`}>
                  <div className="module-card-header">
                    <div className="module-icon">M</div>

                    <div>
                      <h3>{module.name}</h3>

                      <p>{module.file}</p>
                    </div>
                  </div>

                  <div className="module-stats">
                    <div>
                      <strong>{moduleClasses.length}</strong>

                      <span>Classes</span>
                    </div>

                    <div>
                      <strong>{moduleFunctions.length}</strong>

                      <span>Functions</span>
                    </div>
                  </div>

                  {moduleClasses.length > 0 && (
                    <div className="module-details">
                      <h4>Classes</h4>

                      {moduleClasses.map((classData) => (
                        <div
                          className="architecture-item"
                          key={`${module.name}-${classData.name}`}
                        >
                          <span>{classData.name}</span>

                          <small>
                            {classData.methods?.length ?? 0} methods
                          </small>
                        </div>
                      ))}
                    </div>
                  )}

                  {moduleFunctions.length > 0 && (
                    <div className="module-details">
                      <h4>Functions</h4>

                      {moduleFunctions.slice(0, 8).map((functionData) => (
                        <div
                          className="architecture-item"
                          key={`${module.name}-${functionData.name}-${functionData.line}`}
                        >
                          <span>{functionData.name}</span>

                          <small>Line {functionData.line}</small>
                        </div>
                      ))}

                      {moduleFunctions.length > 8 && (
                        <p className="more-items">
                          +{moduleFunctions.length - 8} more functions
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ======================================
          DEPENDENCIES
      ====================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <div>
            <p className="section-label">RELATIONSHIP MAP</p>

            <h2>Dependencies</h2>
          </div>

          <div className="dependency-counts">
            <span>
              Internal <strong>{internalDependencies.length}</strong>
            </span>

            <span>
              External <strong>{externalDependencies.length}</strong>
            </span>
          </div>
        </div>

        {dependencies.length === 0 ? (
          <div className="empty-architecture">
            No dependency relationships detected.
          </div>
        ) : (
          <div className="dependency-list">
            {dependencies.slice(0, 40).map((dependency, index) => (
              <div
                className="dependency-row"
                key={`${dependency.source}-${dependency.target}-${dependency.line}-${index}`}
              >
                <div className="dependency-source">
                  <span className="dependency-node">
                    {dependency.source || "Unknown"}
                  </span>
                </div>

                <div className="dependency-arrow">→</div>

                <div className="dependency-target">
                  <span className="dependency-node">
                    {dependency.target || "Unknown"}
                  </span>

                  <span
                    className={`dependency-type ${getSeverityClass(
                      dependency.type === "internal" ? "info" : "medium",
                    )}`}
                  >
                    {dependency.type}
                  </span>
                </div>
              </div>
            ))}

            {dependencies.length > 40 && (
              <p className="more-items dependency-more">
                Showing the first 40 of {dependencies.length} dependencies.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ======================================
          ARCHITECTURE INSIGHT
      ====================================== */}

      <section className="architecture-insight">
        <div className="insight-icon">◆</div>

        <div>
          <p className="section-label">ARCHITECTURE INSIGHT</p>

          <h2>
            Your codebase has {summary.modules ?? 0} modules connected through{" "}
            {architectureSummary.total_dependencies ??
              summary.dependencies ??
              0}{" "}
            dependency relationships.
          </h2>

          <p>
            This structural model will become the foundation for CodeScape's
            interactive software architecture visualization.
          </p>
        </div>
      </section>

      {/* ======================================
    3D SOFTWARE BUILDING
====================================== */}

      <section className="architecture-3d-navigation">
        <div className="architecture-3d-navigation-content">
          <p className="section-label">CODESCAPE VISUALIZATION</p>

          <h2>Turn your architecture into a 3D software building</h2>

          <p>
            Explore modules, classes, functions and dependencies through
            CodeScape's interactive structural visualization.
          </p>
        </div>

        <button
          className="architecture-3d-button"
          onClick={() =>
            navigate("/codescape", {
              state: {
                analysis,
              },
            })
          }
        >
          Open 3D Software Building
          <span>→</span>
        </button>
      </section>
    </div>
  );
}

export default ArchitecturePage;
