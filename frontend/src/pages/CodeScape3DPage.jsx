import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Html } from "@react-three/drei";

import "./CodeScape3DPage.css";

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function getItemName(item, fallback) {
  return (
    item?.name ||
    item?.module_name ||
    item?.class_name ||
    item?.function_name ||
    item?.path ||
    item?.file ||
    fallback
  );
}

function normalizePath(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .toLowerCase();
}

function pathsMatch(first, second) {
  if (!first || !second) {
    return false;
  }

  const a = normalizePath(first);
  const b = normalizePath(second);

  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

function getLine(item) {
  return Number(
    item?.line ?? item?.lineno ?? item?.start_line ?? item?.startLine ?? 0,
  );
}

function getEndLine(item) {
  const start = getLine(item);

  return Number(
    item?.end_line ??
      item?.endLine ??
      item?.end_lineno ??
      item?.endLineNumber ??
      start,
  );
}

/* =========================================================
   SEVERITY
   ========================================================= */

function severityRank(severity) {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") {
    return 5;
  }

  if (value === "high") {
    return 4;
  }

  if (value === "medium") {
    return 3;
  }

  if (value === "low") {
    return 2;
  }

  return 1;
}

function getHighestSeverity(findings) {
  if (!findings || findings.length === 0) {
    return null;
  }

  return findings.reduce((highest, finding) => {
    if (severityRank(finding?.severity) > severityRank(highest?.severity)) {
      return finding;
    }

    return highest;
  }, findings[0])?.severity;
}

function getSeverityClass(severity) {
  const value = String(severity || "info").toLowerCase();

  return `damage-${value}`;
}

/* =========================================================
   FINDING → FILE
   ========================================================= */

function findingMatchesFile(finding, filePath) {
  return (
    pathsMatch(finding?.file, filePath) || pathsMatch(finding?.path, filePath)
  );
}

/* =========================================================
   FINDING → FUNCTION / METHOD
   ========================================================= */

function findingMatchesItem(finding, item) {
  const itemFile =
    item?.file || item?.path || item?.module || item?.module_name;

  if (!findingMatchesFile(finding, itemFile)) {
    return false;
  }

  const findingLine = getLine(finding);

  const startLine = getLine(item);

  const endLine = getEndLine(item);

  if (findingLine <= 0 || startLine <= 0) {
    return false;
  }

  return findingLine >= startLine && findingLine <= endLine;
}

/* =========================================================
   MODULE FINDINGS
   ========================================================= */

function getModuleFindings(module, findings) {
  if (!module || !findings) {
    return [];
  }

  const modulePath =
    module?.path || module?.file || module?.name || module?.module_name;

  return findings.filter((finding) => findingMatchesFile(finding, modulePath));
}

/* =========================================================
   CLASS FINDINGS
   ========================================================= */

function getClassFindings(classItem, findings) {
  if (!classItem || !findings) {
    return [];
  }

  return findings.filter((finding) => findingMatchesItem(finding, classItem));
}

/* =========================================================
   METHOD FINDINGS
   ========================================================= */

function getMethodFindings(method, findings) {
  if (!method || !findings) {
    return [];
  }

  return findings.filter((finding) => findingMatchesItem(finding, method));
}

/* =========================================================
   FUNCTION FINDINGS
   ========================================================= */

function getFunctionFindings(functionItem, findings) {
  if (!functionItem || !findings) {
    return [];
  }

  return findings.filter((finding) =>
    findingMatchesItem(finding, functionItem),
  );
}

/* =========================================================
   MODULE → CLASSES
   ========================================================= */

function getModuleClasses(module, allClasses) {
  const modulePath =
    module?.path || module?.file || module?.name || module?.module_name;

  const moduleName = module?.name || module?.module_name;

  if (Array.isArray(module?.classes) && module.classes.length > 0) {
    return module.classes;
  }

  return allClasses.filter((item) => {
    const itemFile =
      item?.file || item?.path || item?.module || item?.module_name;

    const itemModule = item?.module || item?.module_name;

    return (
      pathsMatch(itemFile, modulePath) ||
      pathsMatch(itemModule, modulePath) ||
      pathsMatch(itemModule, moduleName)
    );
  });
}

/* =========================================================
   MODULE → FUNCTIONS
   ========================================================= */

function getModuleFunctions(module, allFunctions) {
  const modulePath =
    module?.path || module?.file || module?.name || module?.module_name;

  const moduleName = module?.name || module?.module_name;

  if (Array.isArray(module?.functions) && module.functions.length > 0) {
    return module.functions;
  }

  return allFunctions.filter((item) => {
    const itemFile =
      item?.file || item?.path || item?.module || item?.module_name;

    const itemModule = item?.module || item?.module_name;

    return (
      pathsMatch(itemFile, modulePath) ||
      pathsMatch(itemModule, modulePath) ||
      pathsMatch(itemModule, moduleName)
    );
  });
}

/* =========================================================
   CLASS METHODS
   ========================================================= */

function getClassMethods(classItem) {
  if (Array.isArray(classItem?.methods)) {
    return classItem.methods;
  }

  if (Array.isArray(classItem?.functions)) {
    return classItem.functions;
  }

  return [];
}

/* =========================================================
   DAMAGE INDICATOR
   ========================================================= */

function DamageIndicator({ severity, count }) {
  if (!severity) {
    return null;
  }

  return (
    <group position={[0, 1.25, 0]}>
      <mesh>
        <boxGeometry args={[0.14, 1.0, 0.08]} />

        <meshStandardMaterial
          color="#ef4444"
          emissive="#991b1b"
          emissiveIntensity={1.5}
        />
      </mesh>

      <mesh rotation={[0, 0, -0.55]} position={[0.18, -0.05, 0.01]}>
        <boxGeometry args={[0.12, 0.7, 0.08]} />

        <meshStandardMaterial
          color="#f97316"
          emissive="#9a3412"
          emissiveIntensity={1.4}
        />
      </mesh>

      <Html position={[0, 0.85, 0]} center distanceFactor={13}>
        <div className={`damage-badge ${getSeverityClass(severity)}`}>
          ⚠ {count}
        </div>
      </Html>
    </group>
  );
}

/* =========================================================
   METHOD BLOCK
   ========================================================= */

function MethodBlock({
  method,
  methodIndex,
  classIndex,
  moduleIndex,
  selectedObject,
  onSelect,
  findings,
}) {
  const methodName = getItemName(method, `method_${methodIndex + 1}()`);

  const methodFindings = getMethodFindings(method, findings);

  const severity = getHighestSeverity(methodFindings);

  const isSelected =
    selectedObject?.type === "method" &&
    selectedObject?.moduleIndex === moduleIndex &&
    selectedObject?.classIndex === classIndex &&
    selectedObject?.methodIndex === methodIndex;

  const isDamaged = methodFindings.length > 0;

  let blockColor = isSelected ? "#ffffff" : "#94a3b8";

  if (isDamaged) {
    blockColor =
      severityRank(severity) >= 4
        ? "#ef4444"
        : severityRank(severity) >= 3
          ? "#f97316"
          : "#facc15";
  }

  return (
    <group>
      <mesh
        position={[0, 0.42, 0]}
        onClick={(event) => {
          event.stopPropagation();

          onSelect({
            type: "method",
            moduleIndex,
            classIndex,
            methodIndex,
            data: method,
            findings: methodFindings,
          });
        }}
      >
        <boxGeometry args={[1.15, 0.65, 0.85]} />

        <meshStandardMaterial
          color={blockColor}
          emissive={isDamaged ? blockColor : "#000000"}
          emissiveIntensity={isDamaged ? 0.55 : isSelected ? 0.7 : 0}
          metalness={0.1}
          roughness={0.65}
        />
      </mesh>

      {isDamaged && (
        <DamageIndicator severity={severity} count={methodFindings.length} />
      )}

      <Html position={[0, 0.88, 0]} center distanceFactor={12}>
        <div
          className={`method-label ${
            isSelected ? "method-label-selected" : ""
          } ${isDamaged ? "method-label-damaged" : ""}`}
        >
          {methodName}
        </div>
      </Html>
    </group>
  );
}

/* =========================================================
   CLASS ROOM
   ========================================================= */

function ClassRoom({
  classItem,
  classIndex,
  moduleIndex,
  selectedObject,
  onSelect,
  findings,
}) {
  const className = getItemName(classItem, `Class ${classIndex + 1}`);

  const methods = getClassMethods(classItem);

  const classFindings = getClassFindings(classItem, findings);

  const severity = getHighestSeverity(classFindings);

  const isSelected =
    selectedObject?.type === "class" &&
    selectedObject?.moduleIndex === moduleIndex &&
    selectedObject?.classIndex === classIndex;

  const isDamaged = classFindings.length > 0;

  return (
    <group>
      {/* CLASS FLOOR */}

      <mesh
        position={[0, 0.05, 0]}
        onClick={(event) => {
          event.stopPropagation();

          onSelect({
            type: "class",
            moduleIndex,
            classIndex,
            data: classItem,
            findings: classFindings,
          });
        }}
      >
        <boxGeometry args={[3.6, 0.15, 2.6]} />

        <meshStandardMaterial
          color={isDamaged ? "#7f1d1d" : isSelected ? "#0891b2" : "#164e63"}
          emissive={isDamaged ? "#7f1d1d" : "#083344"}
          emissiveIntensity={isDamaged ? 0.8 : isSelected ? 0.8 : 0.35}
          metalness={0.2}
          roughness={0.5}
        />
      </mesh>

      {/* BACK WALL */}

      <mesh position={[0, 1.0, -1.15]}>
        <boxGeometry args={[3.6, 1.9, 0.12]} />

        <meshStandardMaterial
          color={isDamaged ? "#7f1d1d" : isSelected ? "#0e7490" : "#155e75"}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* SIDE WALL */}

      <mesh position={[-1.74, 1.0, 0]}>
        <boxGeometry args={[0.12, 1.9, 2.5]} />

        <meshStandardMaterial color="#155e75" transparent opacity={0.72} />
      </mesh>

      {/* CLASS LABEL */}

      <Html position={[0, 2.15, -1.0]} center distanceFactor={11}>
        <div
          className={`hierarchy-label ${
            isSelected ? "hierarchy-label-selected" : ""
          } ${isDamaged ? "hierarchy-label-damaged" : ""}`}
        >
          <strong>{className}</strong>

          <span>{methods.length} methods</span>

          {isDamaged && <small>⚠ {classFindings.length} findings</small>}
        </div>
      </Html>

      {/* METHODS */}

      <group position={[0, 0, 0.15]}>
        {methods.slice(0, 8).map((method, methodIndex) => {
          const column = methodIndex % 4;

          const row = Math.floor(methodIndex / 4);

          const x = -1.65 + column * 1.1;

          const z = -0.45 + row * 0.9;

          return (
            <group
              key={
                `method-${moduleIndex}-` + `${classIndex}-` + `${methodIndex}`
              }
              position={[x, 0, z]}
            >
              <MethodBlock
                method={method}
                methodIndex={methodIndex}
                classIndex={classIndex}
                moduleIndex={moduleIndex}
                selectedObject={selectedObject}
                onSelect={onSelect}
                findings={findings}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}

/* =========================================================
   MODULE BUILDING
   ========================================================= */

function ModuleBuilding({
  module,
  index,
  modules,
  classes,
  functions,
  findings,
  selectedObject,
  onSelect,
}) {
  const columns = Math.min(3, Math.max(1, modules.length));

  const rows = Math.ceil(modules.length / columns);

  const spacing = 11;

  const column = index % columns;

  const row = Math.floor(index / columns);

  const totalWidth = (columns - 1) * spacing;

  const totalDepth = (rows - 1) * spacing;

  const x = column * spacing - totalWidth / 2;

  const z = row * spacing - totalDepth / 2;

  const moduleName = getItemName(module, `Module ${index + 1}`);

  const moduleClasses = getModuleClasses(module, classes);

  const moduleFunctions = getModuleFunctions(module, functions);

  const moduleFindings = getModuleFindings(module, findings);

  const moduleSeverity = getHighestSeverity(moduleFindings);

  const isDamaged = moduleFindings.length > 0;

  const isSelected =
    selectedObject?.type === "module" && selectedObject?.index === index;

  const classPositions = moduleClasses.map((_, classIndex) => {
    const column = classIndex % 2;

    const row = Math.floor(classIndex / 2);

    const classX = column === 0 ? -2 : 2;

    const classZ = row === 0 ? -0.8 : 2.3;

    return [classX, classZ];
  });

  return (
    <group position={[x, 0, z]}>
      {/* =================================================
          FOUNDATION
         ================================================= */}

      <mesh
        position={[0, 0, 0]}
        onClick={(event) => {
          event.stopPropagation();

          onSelect({
            type: "module",
            index,
            data: module,
            findings: moduleFindings,
          });
        }}
      >
        <boxGeometry args={[8.5, 0.25, 8]} />

        <meshStandardMaterial
          color={isDamaged ? "#7f1d1d" : isSelected ? "#2563eb" : "#1e293b"}
          emissive={isDamaged ? "#7f1d1d" : "#000000"}
          emissiveIntensity={isDamaged ? 0.5 : 0}
          metalness={0.25}
          roughness={0.55}
        />
      </mesh>

      {/* =================================================
          CORNER PILLARS
         ================================================= */}

      {[
        [-4, 0, -3.75],
        [4, 0, -3.75],
        [-4, 0, 3.75],
        [4, 0, 3.75],
      ].map((position, pillarIndex) => (
        <mesh
          key={`pillar-${pillarIndex}`}
          position={[position[0], 2.7, position[2]]}
          onClick={(event) => {
            event.stopPropagation();

            onSelect({
              type: "module",
              index,
              data: module,
              findings: moduleFindings,
            });
          }}
        >
          <boxGeometry args={[0.28, 5.4, 0.28]} />

          <meshStandardMaterial
            color={isDamaged ? "#ef4444" : isSelected ? "#60a5fa" : "#334155"}
            emissive={isDamaged ? "#7f1d1d" : "#000000"}
            emissiveIntensity={isDamaged ? 0.8 : 0}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* =================================================
          TOP FRAME
         ================================================= */}

      <mesh position={[0, 5.4, 0]}>
        <boxGeometry args={[8.5, 0.28, 8]} />

        <meshStandardMaterial
          color={isDamaged ? "#ef4444" : isSelected ? "#60a5fa" : "#3b82f6"}
          emissive={isDamaged ? "#7f1d1d" : "#000000"}
          emissiveIntensity={isDamaged ? 0.8 : 0}
          metalness={0.35}
          roughness={0.4}
        />
      </mesh>

      {/* =================================================
          MODULE LABEL
         ================================================= */}

      <Html position={[0, 6.5, 0]} center distanceFactor={10}>
        <div
          className={`building-label ${
            isSelected ? "building-label-selected" : ""
          } ${isDamaged ? "building-label-damaged" : ""}`}
        >
          <strong>{moduleName}</strong>

          <span>
            {moduleClasses.length} classes · {moduleFunctions.length} functions
          </span>

          {isDamaged && (
            <small>⚠ {moduleFindings.length} security findings</small>
          )}
        </div>
      </Html>

      {/* =================================================
          MODULE DAMAGE INDICATOR
         ================================================= */}

      {isDamaged && (
        <DamageIndicator
          severity={moduleSeverity}
          count={moduleFindings.length}
        />
      )}

      {/* =================================================
          CLASSES
         ================================================= */}

      {moduleClasses.map((classItem, classIndex) => {
        const position = classPositions[classIndex];

        return (
          <group
            key={`class-${index}-` + `${classIndex}`}
            position={[position[0], 0.2, position[1]]}
          >
            <ClassRoom
              classItem={classItem}
              classIndex={classIndex}
              moduleIndex={index}
              selectedObject={selectedObject}
              onSelect={onSelect}
              findings={findings}
            />
          </group>
        );
      })}

      {/* =================================================
          TOP LEVEL FUNCTIONS
         ================================================= */}

      {moduleFunctions.slice(0, 12).map((functionItem, functionIndex) => {
        const x = -3.2 + (functionIndex % 6) * 1.25;

        const z = 3.0;

        const functionFindings = getFunctionFindings(functionItem, findings);

        const functionSeverity = getHighestSeverity(functionFindings);

        const isFunctionDamaged = functionFindings.length > 0;

        const isFunctionSelected =
          selectedObject?.type === "function" &&
          selectedObject?.index === index &&
          selectedObject?.childIndex === functionIndex;

        const functionName = getItemName(
          functionItem,
          `function_${functionIndex + 1}()`,
        );

        let functionColor = isFunctionSelected ? "#ffffff" : "#a9b8c9";

        if (isFunctionDamaged) {
          functionColor =
            severityRank(functionSeverity) >= 4
              ? "#ef4444"
              : severityRank(functionSeverity) >= 3
                ? "#f97316"
                : "#facc15";
        }

        return (
          <group
            key={`function-${index}-` + functionIndex}
            position={[x, 0.3, z]}
          >
            <mesh
              position={[0, 0.45, 0]}
              onClick={(event) => {
                event.stopPropagation();

                onSelect({
                  type: "function",
                  index,
                  childIndex: functionIndex,
                  data: functionItem,
                  findings: functionFindings,
                });
              }}
            >
              <boxGeometry args={[1.0, 0.7, 0.8]} />

              <meshStandardMaterial
                color={functionColor}
                emissive={isFunctionDamaged ? functionColor : "#000000"}
                emissiveIntensity={
                  isFunctionDamaged ? 0.6 : isFunctionSelected ? 0.6 : 0
                }
                metalness={0.1}
                roughness={0.7}
              />
            </mesh>

            {isFunctionDamaged && (
              <DamageIndicator
                severity={functionSeverity}
                count={functionFindings.length}
              />
            )}

            <Html position={[0, 0.95, 0]} center distanceFactor={14}>
              <div
                className={`function-label ${
                  isFunctionSelected ? "function-label-selected" : ""
                } ${isFunctionDamaged ? "function-label-damaged" : ""}`}
              >
                {functionName}
              </div>
            </Html>
          </group>
        );
      })}

      {moduleFunctions.length > 0 && (
        <Html position={[0, 1.65, 3.0]} center distanceFactor={13}>
          <div className="top-level-label">TOP-LEVEL FUNCTIONS</div>
        </Html>
      )}
    </group>
  );
}

/* =========================================================
   DEPENDENCY BRIDGE
   ========================================================= */

function DependencyBridge({ from, to }) {
  if (!from || !to) {
    return null;
  }

  const dx = to[0] - from[0];

  const dz = to[2] - from[2];

  const distance = Math.sqrt(dx * dx + dz * dz);

  const angle = Math.atan2(dz, dx);

  const midpoint = [(from[0] + to[0]) / 2, 2.4, (from[2] + to[2]) / 2];

  return (
    <mesh position={midpoint} rotation={[0, -angle, 0]}>
      <boxGeometry args={[distance, 0.28, 0.35]} />

      <meshStandardMaterial
        color="#f59e0b"
        emissive="#7c4a03"
        emissiveIntensity={0.45}
        metalness={0.25}
        roughness={0.45}
      />
    </mesh>
  );
}

/* =========================================================
   3D SCENE
   ========================================================= */

function CodeScapeScene({
  modules,
  classes,
  functions,
  dependencies,
  findings,
  selectedObject,
  onSelect,
}) {
  const layout = useMemo(() => {
    if (modules.length === 0) {
      return {
        positions: [],
        center: [0, 2.5, 0],
        width: 24,
        depth: 24,
      };
    }

    const columns = Math.min(3, modules.length);

    const rows = Math.ceil(modules.length / columns);

    const spacing = 11;

    const totalWidth = (columns - 1) * spacing;

    const totalDepth = (rows - 1) * spacing;

    const positions = modules.map((_, index) => {
      const column = index % columns;

      const row = Math.floor(index / columns);

      return [
        column * spacing - totalWidth / 2,

        0,

        row * spacing - totalDepth / 2,
      ];
    });

    return {
      positions,

      center: [0, 2.5, 0],

      width: Math.max(28, totalWidth + 18),

      depth: Math.max(28, totalDepth + 18),
    };
  }, [modules]);

  return (
    <>
      {/* LIGHTING */}

      <ambientLight intensity={1.35} />

      <directionalLight position={[15, 25, 15]} intensity={2.6} />

      <directionalLight position={[-15, 15, -10]} intensity={1.2} />

      <Environment preset="city" />

      {/* FINITE GRID */}

      <Grid
        position={[0, -0.12, 0]}
        args={[layout.width, layout.depth]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#14558a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#1d75b8"
        fadeDistance={35}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {/* BUILDINGS */}

      {modules.map((module, index) => (
        <ModuleBuilding
          key={module?.path || module?.name || `module-${index}`}
          module={module}
          index={index}
          modules={modules}
          classes={classes}
          functions={functions}
          findings={findings}
          selectedObject={selectedObject}
          onSelect={onSelect}
        />
      ))}

      {/* DEPENDENCIES */}

      {dependencies
        .slice(0, Math.max(0, modules.length - 1))
        .map((dependency, index) => {
          const from = layout.positions[index];

          const to = layout.positions[index + 1];

          return (
            <DependencyBridge key={`dependency-${index}`} from={from} to={to} />
          );
        })}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={55}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.05}
        target={layout.center}
        enablePan
        panSpeed={0.5}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
      />
    </>
  );
}

/* =========================================================
   MAIN PAGE
   ========================================================= */

function CodeScape3DPage() {
  const location = useLocation();

  const navigate = useNavigate();

  const analysis = location.state?.analysis;

  const architecture = analysis?.structure?.architecture;

  const modules = architecture?.modules || [];

  const classes = architecture?.classes || [];

  const functions = architecture?.functions || [];

  const dependencies = architecture?.dependencies || [];

  const findings =
    analysis?.structure?.security_findings || analysis?.security_findings || [];

  const [selectedObject, setSelectedObject] = useState(null);

  if (!analysis || !architecture) {
    return (
      <div className="codescape3d-page">
        <div className="codescape3d-empty">
          <h2>No architecture data found</h2>

          <p>
            Please analyze a project before opening the 3D software building.
          </p>

          <button onClick={() => navigate("/upload")}>Go to Upload</button>
        </div>
      </div>
    );
  }

  return (
    <div className="codescape3d-page">
      {/* HEADER */}

      <header className="codescape3d-header">
        <div>
          <div className="codescape3d-eyebrow">CODESCAPE · STRUCTURAL VIEW</div>

          <h1>Software Building</h1>

          <p>Explore your software architecture as a 3D structural model.</p>
        </div>

        <button
          className="architecture-back-button"
          onClick={() =>
            navigate("/architecture", {
              state: {
                analysis,
              },
            })
          }
        >
          ← Architecture
        </button>
      </header>

      {/* 3D VIEW */}

      <main className="codescape3d-view">
        <Canvas
          camera={{
            position: [15, 12, 15],
            fov: 45,
            near: 0.1,
            far: 150,
          }}
          dpr={[1, 1.75]}
          gl={{
            antialias: true,
          }}
        >
          <color attach="background" args={["#020617"]} />

          <CodeScapeScene
            modules={modules}
            classes={classes}
            functions={functions}
            dependencies={dependencies}
            findings={findings}
            selectedObject={selectedObject}
            onSelect={setSelectedObject}
          />
        </Canvas>

        {/* =================================================
            STATS
           ================================================= */}

        <div className="codescape3d-stats">
          <div className="stat-item">
            <strong>{modules.length}</strong>

            <span>MODULES</span>
          </div>

          <div className="stat-item">
            <strong>{classes.length}</strong>

            <span>CLASSES</span>
          </div>

          <div className="stat-item">
            <strong>{functions.length}</strong>

            <span>FUNCTIONS</span>
          </div>

          <div className="stat-item">
            <strong>{dependencies.length}</strong>

            <span>DEPENDENCIES</span>
          </div>

          <div className="stat-item stat-danger">
            <strong>{findings.length}</strong>

            <span>FINDINGS</span>
          </div>
        </div>

        {/* CONTROLS */}

        <div className="codescape3d-controls">
          <div className="panel-title">CONTROLS</div>

          <div>🖱️ Drag · Rotate</div>

          <div>🔵 Scroll · Zoom</div>

          <div>🖐️ Right click · Pan</div>

          <div>👆 Click · Inspect</div>
        </div>

        {/* LEGEND */}

        <div className="codescape3d-legend">
          <div className="panel-title">STRUCTURAL LEGEND</div>

          <div className="legend-item">
            <span className="legend-box module-color" />
            Module
          </div>

          <div className="legend-item">
            <span className="legend-box class-color" />
            Class / Room
          </div>

          <div className="legend-item">
            <span className="legend-box function-color" />
            Function
          </div>

          <div className="legend-item">
            <span className="legend-box dependency-color" />
            Dependency
          </div>

          <div className="legend-item">
            <span className="legend-box damage-color" />
            Security Damage
          </div>
        </div>

        {/* =================================================
            INSPECTOR
           ================================================= */}

        {selectedObject && (
          <div className="codescape3d-inspector">
            <div className="inspector-header">
              <div>
                <div className="inspector-eyebrow">STRUCTURAL INSPECTOR</div>

                <h2>
                  {selectedObject.type === "module" && "Module"}

                  {selectedObject.type === "class" && "Class"}

                  {selectedObject.type === "method" && "Method"}

                  {selectedObject.type === "function" && "Function"}
                </h2>
              </div>

              <button
                className="inspector-close"
                onClick={() => setSelectedObject(null)}
              >
                ×
              </button>
            </div>

            <div className="inspector-content">
              <div className="inspector-main-name">
                {getItemName(selectedObject.data, "Unnamed Component")}
              </div>

              {/* MODULE */}

              {selectedObject.type === "module" && (
                <>
                  <div className="inspector-row">
                    <span>Type</span>

                    <strong>Module</strong>
                  </div>

                  <div className="inspector-row">
                    <span>File</span>

                    <strong>
                      {selectedObject.data?.path ||
                        selectedObject.data?.file ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div className="inspector-row">
                    <span>Classes</span>

                    <strong>
                      {getModuleClasses(selectedObject.data, classes).length}
                    </strong>
                  </div>
                </>
              )}

              {/* CLASS */}

              {selectedObject.type === "class" && (
                <>
                  <div className="inspector-row">
                    <span>Type</span>

                    <strong>Class</strong>
                  </div>

                  <div className="inspector-row">
                    <span>File</span>

                    <strong>
                      {selectedObject.data?.file ||
                        selectedObject.data?.path ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div className="inspector-row">
                    <span>Methods</span>

                    <strong>
                      {getClassMethods(selectedObject.data).length}
                    </strong>
                  </div>
                </>
              )}

              {/* METHOD */}

              {selectedObject.type === "method" && (
                <>
                  <div className="inspector-row">
                    <span>Type</span>

                    <strong>Class Method</strong>
                  </div>

                  <div className="inspector-row">
                    <span>File</span>

                    <strong>
                      {selectedObject.data?.file ||
                        selectedObject.data?.path ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div className="inspector-row">
                    <span>Line</span>

                    <strong>{getLine(selectedObject.data) || "Unknown"}</strong>
                  </div>
                </>
              )}

              {/* FUNCTION */}

              {selectedObject.type === "function" && (
                <>
                  <div className="inspector-row">
                    <span>Type</span>

                    <strong>Top-Level Function</strong>
                  </div>

                  <div className="inspector-row">
                    <span>File</span>

                    <strong>
                      {selectedObject.data?.file ||
                        selectedObject.data?.path ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div className="inspector-row">
                    <span>Line</span>

                    <strong>{getLine(selectedObject.data) || "Unknown"}</strong>
                  </div>
                </>
              )}

              {/* =================================================
                  SECURITY FINDINGS
                 ================================================= */}

              {selectedObject.findings?.length > 0 && (
                <div className="inspector-security">
                  <div className="security-title">⚠ SECURITY FINDINGS</div>

                  {selectedObject.findings.map((finding, index) => {
                    const severity = String(
                      finding?.severity || "Informational",
                    ).toLowerCase();

                    return (
                      <div
                        key={finding?.id || index}
                        className={`finding-card finding-${severity}`}
                      >
                        <div className="finding-top">
                          <strong>{finding?.id || "Finding"}</strong>

                          <span>{finding?.severity || "Informational"}</span>
                        </div>

                        <div className="finding-title">
                          {finding?.title || "Security issue detected"}
                        </div>

                        {finding?.file && (
                          <div className="finding-meta">
                            File: {finding.file}
                          </div>
                        )}

                        {finding?.line && (
                          <div className="finding-meta">
                            Line: {finding.line}
                          </div>
                        )}

                        {finding?.evidence && (
                          <div className="finding-evidence">
                            {finding.evidence}
                          </div>
                        )}

                        {finding?.description && (
                          <div className="finding-description">
                            {finding.description}
                          </div>
                        )}

                        {finding?.recommendation && (
                          <div className="finding-recommendation">
                            <strong>Recommendation</strong>

                            <p>{finding.recommendation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!selectedObject.findings?.length && (
                <div className="inspector-healthy">
                  ✓ No security findings mapped to this component.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CodeScape3DPage;
