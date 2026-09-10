import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Grid,
  Html,
  Line,
} from "@react-three/drei";

import { getSourceFile } from "../services/api";

import "./CodeScape3DPage.css";

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function getItemName(item, fallback = "Unnamed") {
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

  if (value === "critical") return 5;
  if (value === "high") return 4;
  if (value === "medium") return 3;
  if (value === "low") return 2;

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

function getSeverityColor(severity) {
  const rank = severityRank(severity);

  if (rank >= 5) return "#ff1744";
  if (rank >= 4) return "#ff4d4d";
  if (rank >= 3) return "#ff9f43";
  if (rank >= 2) return "#ffd166";

  return "#94a3b8";
}

function getSeverityGlow(severity) {
  const rank = severityRank(severity);

  if (rank >= 5) return "#8b001c";
  if (rank >= 4) return "#8f1d1d";
  if (rank >= 3) return "#8a4b08";
  if (rank >= 2) return "#806400";

  return "#334155";
}

/* =========================================================
   FINDING MATCHING
   ========================================================= */

function findingMatchesFile(finding, filePath) {
  return (
    pathsMatch(finding?.file, filePath) || pathsMatch(finding?.path, filePath)
  );
}

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

function getModuleFindings(module, findings) {
  if (!module || !findings) {
    return [];
  }

  const modulePath =
    module?.path || module?.file || module?.name || module?.module_name;

  return findings.filter((finding) => findingMatchesFile(finding, modulePath));
}

function getClassFindings(classItem, findings) {
  if (!classItem || !findings) {
    return [];
  }

  return findings.filter((finding) => findingMatchesItem(finding, classItem));
}

function getMethodFindings(method, findings) {
  if (!method || !findings) {
    return [];
  }

  return findings.filter((finding) => findingMatchesItem(finding, method));
}

function getFunctionFindings(functionItem, findings) {
  if (!functionItem || !findings) {
    return [];
  }

  return findings.filter((finding) =>
    findingMatchesItem(finding, functionItem),
  );
}

/* =========================================================
   ARCHITECTURE RELATION HELPERS
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
   TEXT LABEL
   ========================================================= */

function FloatingLabel({ children, className = "", position = [0, 0, 0] }) {
  return (
    <Html position={position} center distanceFactor={10} transform sprite>
      <div className={`scene-label ${className}`}>{children}</div>
    </Html>
  );
}

/* =========================================================
   WINDOWS
   ========================================================= */

function Window({ position, rotation = [0, 0, 0], damaged = false }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[0.42, 0.58, 0.055]} />

      <meshStandardMaterial
        color={damaged ? "#5b2020" : "#67d9ff"}
        emissive={damaged ? "#5b2020" : "#0b6685"}
        emissiveIntensity={damaged ? 0.15 : 0.65}
        metalness={0.45}
        roughness={0.25}
      />
    </mesh>
  );
}

/* =========================================================
   BUILDING DOOR
   ========================================================= */

function BuildingDoor({ position, damaged = false }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.9, 1.45, 0.12]} />

        <meshStandardMaterial
          color={damaged ? "#6f2020" : "#172033"}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>

      <mesh position={[0.28, 0, 0.08]}>
        <sphereGeometry args={[0.045, 10, 10]} />

        <meshStandardMaterial
          color="#f6c453"
          emissive="#8a6500"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   FLOOR BAND
   ========================================================= */

function FloorBand({ width, depth, y, damaged = false }) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[width + 0.08, 0.08, depth + 0.08]} />

      <meshStandardMaterial
        color={damaged ? "#7f1d1d" : "#26364d"}
        metalness={0.55}
        roughness={0.45}
      />
    </mesh>
  );
}

/* =========================================================
   BUILDING DAMAGE
   ========================================================= */

function BuildingCrack({ position, rotation = [0, 0, 0], severity }) {
  const color = getSeverityColor(severity);
  const glow = getSeverityGlow(severity);

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[0.08, 1.1, 0.035]} />

        <meshStandardMaterial
          color={color}
          emissive={glow}
          emissiveIntensity={1.2}
        />
      </mesh>

      <mesh position={[0.13, -0.28, 0.01]} rotation={[0, 0, -0.65]}>
        <boxGeometry args={[0.07, 0.55, 0.035]} />

        <meshStandardMaterial
          color={color}
          emissive={glow}
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   SECURITY BEACON
   ========================================================= */

function SecurityBeacon({ severity, count }) {
  if (!severity) {
    return null;
  }

  const color = getSeverityColor(severity);

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.65, 16]} />

        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>

      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />

        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
        />
      </mesh>

      <FloatingLabel position={[0, 1.4, 0]} className="security-label">
        <span>⚠ {count}</span>
        <small>{severity}</small>
      </FloatingLabel>
    </group>
  );
}

/* =========================================================
   METHOD / FUNCTION BLOCK
   ========================================================= */

function CodeBlock({
  item,
  index,
  type,
  moduleIndex,
  classIndex,
  selectedObject,
  onSelect,
  findings,
  position,
}) {
  const name = getItemName(item, `${type}_${index + 1}()`);

  const itemFindings =
    type === "method"
      ? getMethodFindings(item, findings)
      : getFunctionFindings(item, findings);

  const severity = getHighestSeverity(itemFindings);

  const damaged = itemFindings.length > 0;

  const isSelected =
    selectedObject?.type === type &&
    selectedObject?.moduleIndex === moduleIndex &&
    selectedObject?.classIndex === classIndex &&
    selectedObject?.childIndex === index;

  const color = damaged
    ? getSeverityColor(severity)
    : isSelected
      ? "#ffffff"
      : "#9fb3c8";

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();

          onSelect({
            type,
            moduleIndex,
            classIndex,
            childIndex: index,
            data: item,
            findings: itemFindings,
          });
        }}
      >
        <boxGeometry args={[0.78, 0.48, 0.62]} />

        <meshStandardMaterial
          color={color}
          emissive={
            damaged
              ? getSeverityGlow(severity)
              : isSelected
                ? "#64748b"
                : "#000000"
          }
          emissiveIntensity={damaged ? 1 : isSelected ? 0.7 : 0}
          metalness={0.35}
          roughness={0.48}
        />
      </mesh>

      {/* Method indicator */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.56, 0.035, 0.08]} />

        <meshStandardMaterial
          color={damaged ? color : "#38bdf8"}
          emissive={damaged ? color : "#0e7490"}
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* Name appears ONLY on hover/selection */}
      {isSelected && (
        <FloatingLabel
          position={[0, 0.55, 0]}
          className="code-block-label selected"
        >
          <strong>{name}</strong>

          <span>{type === "method" ? "METHOD" : "FUNCTION"}</span>

          {getLine(item) > 0 && <small>Line {getLine(item)}</small>}
        </FloatingLabel>
      )}

      {damaged && (
        <mesh position={[0.31, 0.3, 0.31]}>
          <sphereGeometry args={[0.07, 10, 10]} />

          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.8}
          />
        </mesh>
      )}
    </group>
  );
}

/* =========================================================
   CLASS / ROOM
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

  const damaged = classFindings.length > 0;

  const selected =
    selectedObject?.type === "class" &&
    selectedObject?.moduleIndex === moduleIndex &&
    selectedObject?.classIndex === classIndex;

  /*
   * Six methods per floor.
   * This means ALL methods can be displayed.
   */
  const methodsPerFloor = 6;

  const floorCount = Math.max(1, Math.ceil(methods.length / methodsPerFloor));

  const roomWidth = 3.65;
  const roomDepth = 2.75;
  const floorHeight = 1.05;

  const roomHeight = 0.35 + floorCount * floorHeight;

  return (
    <group>
      {/* Room foundation */}
      <mesh
        position={[0, 0.08, 0]}
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
        <boxGeometry args={[roomWidth, 0.16, roomDepth]} />

        <meshStandardMaterial
          color={damaged ? "#57252b" : selected ? "#075985" : "#16324a"}
          emissive={damaged ? "#4c0519" : selected ? "#075985" : "#06283d"}
          emissiveIntensity={damaged ? 0.8 : selected ? 0.8 : 0.25}
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>

      {/* Room walls */}
      <mesh position={[0, roomHeight / 2, -roomDepth / 2]}>
        <boxGeometry args={[roomWidth, roomHeight, 0.1]} />

        <meshStandardMaterial
          color={damaged ? "#71313a" : "#174766"}
          transparent
          opacity={0.92}
          metalness={0.25}
          roughness={0.55}
        />
      </mesh>

      <mesh position={[-roomWidth / 2, roomHeight / 2, 0]}>
        <boxGeometry args={[0.1, roomHeight, roomDepth]} />

        <meshStandardMaterial
          color={damaged ? "#71313a" : "#174766"}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh position={[roomWidth / 2, roomHeight / 2, 0]}>
        <boxGeometry args={[0.1, roomHeight, roomDepth]} />

        <meshStandardMaterial
          color={damaged ? "#71313a" : "#174766"}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Floors */}
      {Array.from({
        length: floorCount,
      }).map((_, floorIndex) => (
        <FloorBand
          key={`floor-${floorIndex}`}
          width={roomWidth}
          depth={roomDepth}
          y={0.2 + floorIndex * floorHeight}
          damaged={damaged}
        />
      ))}

      {/* Windows */}
      {Array.from({
        length: Math.min(4, floorCount),
      }).map((_, windowIndex) => (
        <Window
          key={`window-${windowIndex}`}
          position={[
            -1.1 + (windowIndex % 3) * 1.1,
            0.7 + Math.floor(windowIndex / 3) * 1.0,
            -roomDepth / 2 - 0.07,
          ]}
          damaged={damaged}
        />
      ))}

      {/* Door */}
      <BuildingDoor
        position={[0, 0.78, roomDepth / 2 + 0.08]}
        damaged={damaged}
      />

      {/* Class sign */}
      <FloatingLabel
        position={[0, roomHeight + 0.45, -0.15]}
        className={selected ? "class-label selected" : "class-label"}
      >
        <strong>{className}</strong>

        <span>
          {methods.length} {methods.length === 1 ? "method" : "methods"}
        </span>

        {floorCount > 1 && <small>{floorCount} floors</small>}

        {damaged && (
          <small className="label-danger">
            ⚠ {classFindings.length} findings
          </small>
        )}
      </FloatingLabel>

      {/* Methods */}
      <group>
        {methods.map((method, methodIndex) => {
          const floor = Math.floor(methodIndex / methodsPerFloor);

          const positionOnFloor = methodIndex % methodsPerFloor;

          const column = positionOnFloor % 3;

          const row = Math.floor(positionOnFloor / 3);

          const x = -1.1 + column * 1.1;

          const z = -0.55 + row * 0.9;

          const y = 0.42 + floor * floorHeight;

          return (
            <CodeBlock
              key={
                `method-${moduleIndex}-` + `${classIndex}-` + `${methodIndex}`
              }
              item={method}
              index={methodIndex}
              type="method"
              moduleIndex={moduleIndex}
              classIndex={classIndex}
              selectedObject={selectedObject}
              onSelect={onSelect}
              findings={findings}
              position={[x, y, z]}
            />
          );
        })}
      </group>

      {/* Damage crack */}
      {damaged && (
        <BuildingCrack
          position={[roomWidth / 2 + 0.08, roomHeight * 0.55, 0]}
          rotation={[0, Math.PI / 2, 0]}
          severity={severity}
        />
      )}
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
  const moduleName = getItemName(module, `Module ${index + 1}`);

  const moduleClasses = getModuleClasses(module, classes);

  const moduleFunctions = getModuleFunctions(module, functions);

  const moduleFindings = getModuleFindings(module, findings);

  const severity = getHighestSeverity(moduleFindings);

  const damaged = moduleFindings.length > 0;

  const selected =
    selectedObject?.type === "module" && selectedObject?.index === index;

  /*
   * Layout:
   * Four class rooms per floor.
   * Extra classes create additional depth.
   */
  const classesPerRow = 2;

  const classRows = Math.max(
    1,
    Math.ceil(moduleClasses.length / classesPerRow),
  );

  const moduleWidth = 9.4;

  const moduleDepth = Math.max(8.2, classRows * 4.0 + 1.8);

  /*
   * Height depends on the most complex class.
   */
  const largestMethodCount = moduleClasses.reduce(
    (max, classItem) => Math.max(max, getClassMethods(classItem).length),
    0,
  );

  const methodFloors = Math.max(1, Math.ceil(largestMethodCount / 6));

  const buildingHeight = 4.2 + Math.max(0, methodFloors - 1) * 1.05;

  /*
   * Main city layout.
   */
  const columns = Math.min(3, Math.max(1, modules.length));

  const rows = Math.ceil(modules.length / columns);

  const spacingX = 12;
  const spacingZ = 11;

  const totalWidth = (columns - 1) * spacingX;

  const totalDepth = (rows - 1) * spacingZ;

  const x = (index % columns) * spacingX - totalWidth / 2;

  const z = Math.floor(index / columns) * spacingZ - totalDepth / 2;

  /*
   * Top-level function annex.
   */
  const functionColumns = 5;

  return (
    <group position={[x, 0, z]}>
      {/* =================================================
          FOUNDATION
         ================================================= */}

      <mesh
        position={[0, 0.12, 0]}
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
        <boxGeometry args={[moduleWidth, 0.24, moduleDepth]} />

        <meshStandardMaterial
          color={damaged ? "#441b22" : selected ? "#163d70" : "#111c2d"}
          emissive={damaged ? "#450a0a" : selected ? "#0b3b82" : "#000000"}
          emissiveIntensity={damaged ? 0.8 : selected ? 0.8 : 0}
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>

      {/* =================================================
          BUILDING BODY
         ================================================= */}

      <mesh position={[0, buildingHeight / 2, 0]}>
        <boxGeometry args={[moduleWidth, buildingHeight, moduleDepth]} />

        <meshStandardMaterial
          color={damaged ? "#4d2229" : selected ? "#173d68" : "#172538"}
          transparent
          opacity={0.2}
          metalness={0.35}
          roughness={0.6}
        />
      </mesh>

      {/* =================================================
          CORNER COLUMNS
         ================================================= */}

      {[
        [-moduleWidth / 2 + 0.2, -moduleDepth / 2 + 0.2],
        [moduleWidth / 2 - 0.2, -moduleDepth / 2 + 0.2],
        [-moduleWidth / 2 + 0.2, moduleDepth / 2 - 0.2],
        [moduleWidth / 2 - 0.2, moduleDepth / 2 - 0.2],
      ].map(([pillarX, pillarZ], pillarIndex) => (
        <mesh
          key={`pillar-${pillarIndex}`}
          position={[pillarX, buildingHeight / 2, pillarZ]}
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
          <boxGeometry args={[0.3, buildingHeight, 0.3]} />

          <meshStandardMaterial
            color={damaged ? "#a7373f" : selected ? "#3b82f6" : "#33445c"}
            emissive={damaged ? "#64151d" : "#000000"}
            emissiveIntensity={damaged ? 0.8 : 0}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* =================================================
          FLOOR STRUCTURE
         ================================================= */}

      {Array.from({
        length: Math.max(2, Math.ceil(buildingHeight / 1.4)),
      }).map((_, floorIndex) => (
        <FloorBand
          key={`module-floor-${floorIndex}`}
          width={moduleWidth}
          depth={moduleDepth}
          y={0.5 + floorIndex * 1.25}
          damaged={damaged}
        />
      ))}

      {/* =================================================
          WINDOWS
         ================================================= */}

      {Array.from({
        length: Math.max(4, Math.min(12, Math.ceil(moduleWidth / 0.9))),
      }).map((_, windowIndex) => {
        const column = windowIndex % 6;

        const row = Math.floor(windowIndex / 6);

        return (
          <Window
            key={`module-window-${windowIndex}`}
            position={[
              -3.4 + column * 1.35,
              1.35 + row * 1.25,
              -moduleDepth / 2 - 0.08,
            ]}
            damaged={damaged}
          />
        );
      })}

      {/* =================================================
          MAIN DOOR
         ================================================= */}

      <BuildingDoor
        position={[0, 0.85, moduleDepth / 2 + 0.08]}
        damaged={damaged}
      />

      {/* =================================================
          ROOFTOP
         ================================================= */}

      <mesh position={[0, buildingHeight + 0.12, 0]}>
        <boxGeometry args={[moduleWidth + 0.4, 0.25, moduleDepth + 0.4]} />

        <meshStandardMaterial
          color={damaged ? "#a7373f" : selected ? "#3b82f6" : "#385272"}
          emissive={damaged ? "#64151d" : selected ? "#0b3b82" : "#000000"}
          emissiveIntensity={damaged ? 0.9 : selected ? 0.7 : 0}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* =================================================
          MODULE NAME
         ================================================= */}

      <FloatingLabel
        position={[0, buildingHeight + 0.72, 0]}
        className={selected ? "module-label selected" : "module-label"}
      >
        <strong>{moduleName}</strong>

        <span>
          {moduleClasses.length} classes
          {" · "}
          {moduleFunctions.length} functions
        </span>

        {moduleFindings.length > 0 && (
          <small className="label-danger">
            ⚠ {moduleFindings.length} findings
          </small>
        )}
      </FloatingLabel>

      {/* =================================================
          SECURITY BEACON
         ================================================= */}

      {damaged && (
        <group position={[0, buildingHeight, 0]}>
          <SecurityBeacon severity={severity} count={moduleFindings.length} />
        </group>
      )}

      {/* =================================================
          STRUCTURAL CRACKS
         ================================================= */}

      {damaged && (
        <>
          <BuildingCrack
            position={[moduleWidth / 2 + 0.04, buildingHeight * 0.45, -1.1]}
            rotation={[0, Math.PI / 2, 0]}
            severity={severity}
          />

          <BuildingCrack
            position={[-moduleWidth / 2 - 0.04, buildingHeight * 0.68, 0.9]}
            rotation={[0, -Math.PI / 2, 0]}
            severity={severity}
          />
        </>
      )}

      {/* =================================================
          CLASS ROOMS
         ================================================= */}

      {moduleClasses.map((classItem, classIndex) => {
        const column = classIndex % classesPerRow;

        const row = Math.floor(classIndex / classesPerRow);

        const classX = column === 0 ? -2.35 : 2.35;

        const classZ = -moduleDepth / 2 + 2.2 + row * 4.0;

        return (
          <group
            key={`class-${index}-${classIndex}`}
            position={[classX, 0.25, classZ]}
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
          TOP LEVEL FUNCTION ANNEX
         ================================================= */}

      {moduleFunctions.length > 0 && (
        <group position={[0, 0.38, moduleDepth / 2 - 0.9]}>
          {moduleFunctions.map((functionItem, functionIndex) => {
            const column = functionIndex % functionColumns;

            const row = Math.floor(functionIndex / functionColumns);

            const x = -2.55 + column * 1.28;

            const z = row * 0.92;

            const functionFindings = getFunctionFindings(
              functionItem,
              findings,
            );

            const severity = getHighestSeverity(functionFindings);

            const damaged = functionFindings.length > 0;

            const selectedFunction =
              selectedObject?.type === "function" &&
              selectedObject?.index === index &&
              selectedObject?.childIndex === functionIndex;

            return (
              <CodeBlock
                key={`function-${index}-${functionIndex}`}
                item={functionItem}
                index={functionIndex}
                type="function"
                moduleIndex={index}
                classIndex={null}
                selectedObject={selectedObject}
                onSelect={onSelect}
                findings={findings}
                position={[x, row * 0.12, z]}
              />
            );
          })}

          <FloatingLabel
            position={[0, 0.82, 0]}
            className="function-zone-label"
          >
            <strong>FUNCTIONS</strong>

            <span>{moduleFunctions.length} top-level</span>
          </FloatingLabel>
        </group>
      )}
    </group>
  );
}

/* =========================================================
   DEPENDENCY CONNECTION
   ========================================================= */

function DependencyConnection({ from, to, index }) {
  if (!from || !to) {
    return null;
  }

  const start = [from[0], 0.65, from[2]];

  const end = [to[0], 0.65, to[2]];

  const middle = [(start[0] + end[0]) / 2, 1.8, (start[2] + end[2]) / 2];

  return (
    <group>
      <Line
        points={[start, middle, end]}
        color="#e6a52e"
        lineWidth={1.2}
        transparent
        opacity={0.65}
      />

      <mesh position={middle}>
        <sphereGeometry args={[0.1, 12, 12]} />

        <meshStandardMaterial
          color="#f5b83d"
          emissive="#7a4c00"
          emissiveIntensity={1}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   CITY LAYOUT
   ========================================================= */

function createCityLayout(modules) {
  if (!modules.length) {
    return {
      positions: [],
      width: 30,
      depth: 30,
      center: [0, 2, 0],
    };
  }

  const columns = Math.min(3, Math.max(1, modules.length));

  const rows = Math.ceil(modules.length / columns);

  const spacingX = 12;
  const spacingZ = 11;

  const totalWidth = (columns - 1) * spacingX;

  const totalDepth = (rows - 1) * spacingZ;

  const positions = modules.map((_, index) => {
    const column = index % columns;

    const row = Math.floor(index / columns);

    return [
      column * spacingX - totalWidth / 2,
      0,
      row * spacingZ - totalDepth / 2,
    ];
  });

  return {
    positions,

    width: Math.max(30, totalWidth + 20),

    depth: Math.max(30, totalDepth + 20),

    center: [0, 2.8, 0],
  };
}

/* =========================================================
   DEPENDENCY RESOLUTION
   ========================================================= */

function resolveModuleIndex(value, modules) {
  if (value === null || value === undefined) {
    return -1;
  }

  const text = String(value);

  const numeric = Number(value);

  if (Number.isInteger(numeric) && numeric >= 0 && numeric < modules.length) {
    return numeric;
  }

  return modules.findIndex((module) => {
    const candidates = [
      module?.name,
      module?.module_name,
      module?.path,
      module?.file,
    ];

    return candidates.some(
      (candidate) =>
        pathsMatch(candidate, text) ||
        String(candidate || "").toLowerCase() === text.toLowerCase(),
    );
  });
}

function getDependencyEndpoints(dependency, modules, index) {
  const fromValue =
    dependency?.from ??
    dependency?.source ??
    dependency?.source_module ??
    dependency?.sourceModule ??
    dependency?.importer ??
    dependency?.parent;

  const toValue =
    dependency?.to ??
    dependency?.target ??
    dependency?.target_module ??
    dependency?.targetModule ??
    dependency?.imported ??
    dependency?.dependency;

  let fromIndex = resolveModuleIndex(fromValue, modules);

  let toIndex = resolveModuleIndex(toValue, modules);

  /*
   * Older architecture output may not
   * contain explicit endpoints.
   * Preserve the visual connection in
   * that case rather than hiding dependencies.
   */
  if (fromIndex < 0 || toIndex < 0) {
    if (modules.length > 1) {
      fromIndex = index % modules.length;

      toIndex = (index + 1) % modules.length;
    }
  }

  return {
    fromIndex,
    toIndex,
  };
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
  const layout = useMemo(() => createCityLayout(modules), [modules]);

  const dependencyConnections = useMemo(() => {
    return dependencies
      .map((dependency, index) => {
        const { fromIndex, toIndex } = getDependencyEndpoints(
          dependency,
          modules,
          index,
        );

        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return null;
        }

        return {
          dependency,
          index,
          from: layout.positions[fromIndex],
          to: layout.positions[toIndex],
        };
      })
      .filter(Boolean);
  }, [dependencies, modules, layout.positions]);

  return (
    <>
      {/* =================================================
          WORLD LIGHTING
         ================================================= */}

      <ambientLight intensity={1.15} />

      <directionalLight position={[12, 24, 14]} intensity={2.8} castShadow />

      <directionalLight position={[-15, 14, -12]} intensity={1.1} />

      <pointLight position={[0, 10, 0]} intensity={0.7} distance={35} />

      <Environment preset="city" />

      {/* =================================================
          GROUND
         ================================================= */}

      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[layout.width, 0.18, layout.depth]} />

        <meshStandardMaterial
          color="#07101e"
          metalness={0.55}
          roughness={0.65}
        />
      </mesh>

      <Grid
        position={[0, -0.1, 0]}
        args={[layout.width, layout.depth]}
        cellSize={1}
        cellThickness={0.45}
        cellColor="#16405f"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#24658c"
        fadeDistance={42}
        fadeStrength={1.2}
        infiniteGrid={false}
      />

      {/* =================================================
          BUILDINGS
         ================================================= */}

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

      {/* =================================================
          DEPENDENCIES
         ================================================= */}

      {dependencyConnections.map(({ dependency, index, from, to }) => (
        <DependencyConnection
          key={`dependency-${index}`}
          from={from}
          to={to}
          index={index}
        />
      ))}

      {/* =================================================
          CAMERA
         ================================================= */}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={60}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.05}
        target={layout.center}
        enablePan
        panSpeed={0.45}
        rotateSpeed={0.55}
        zoomSpeed={0.75}
      />
    </>
  );
}

/* =========================================================
   SOURCE CODE VIEWER
   ========================================================= */

function SourceCodeViewer({ sourceViewer, onClose }) {
  if (!sourceViewer) {
    return null;
  }

  const lines = String(sourceViewer.content || "").split("\n");

  const highlightedLine = Number(sourceViewer.line || 0);

  return (
    <div className="source-overlay">
      <div className="source-panel">
        <div className="source-header">
          <div>
            <div className="source-eyebrow">CODESCAPE · SOURCE INSPECTOR</div>

            <h2>{sourceViewer.filePath || "Source File"}</h2>

            {highlightedLine > 0 && <span>Focused line {highlightedLine}</span>}
          </div>

          <button className="source-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="source-code">
          {lines.map((line, index) => {
            const lineNumber = index + 1;

            const active = lineNumber === highlightedLine;

            return (
              <div
                key={`source-line-${lineNumber}`}
                className={active ? "source-line active" : "source-line"}
              >
                <span className="line-number">
                  {String(lineNumber).padStart(4, " ")}
                </span>

                <code>{line || " "}</code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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

  const recommendations =
    analysis?.structure?.recommendations?.recommendations ||
    analysis?.recommendations?.recommendations ||
    [];

  const [selectedObject, setSelectedObject] = useState(null);

  const [sourceViewer, setSourceViewer] = useState(null);

  const [sourceLoading, setSourceLoading] = useState(false);

  const [sourceError, setSourceError] = useState("");

  if (!analysis || !architecture) {
    return (
      <div className="codescape3d-page">
        <div className="codescape3d-empty">
          <div className="empty-icon">◈</div>

          <h2>No architecture data</h2>

          <p>Analyze a project before opening the CodeScape structural city.</p>

          <button onClick={() => navigate("/upload")}>Analyze Project</button>
        </div>
      </div>
    );
  }

  const openSourceViewer = async () => {
    const selected = selectedObject?.data;

    if (!selected) {
      return;
    }

    const filePath =
      selected?.file ||
      selected?.path ||
      selected?.module ||
      selected?.module_name;

    if (!filePath) {
      setSourceError("No source file path is available for this component.");

      return;
    }

    setSourceLoading(true);
    setSourceError("");

    try {
      const projectId =
        analysis?.project_id ||
        analysis?.project?.project_id ||
        location.state?.project?.project_id;

      if (!projectId) {
        throw new Error("Project ID is not available.");
      }

      const result = await getSourceFile(projectId, filePath);

      setSourceViewer({
        filePath,
        content: result?.content || result?.source || result?.text || "",
        line: getLine(selected),
      });
    } catch (error) {
      setSourceError(error?.message || "Unable to load source file.");
    } finally {
      setSourceLoading(false);
    }
  };

  const recommendationForSelected =
    selectedObject?.findings?.length > 0
      ? recommendations.find((recommendation) =>
          recommendation?.source_finding_ids?.some((id) =>
            selectedObject.findings.some((finding) => finding?.id === id),
          ),
        )
      : null;

  return (
    <div className="codescape3d-page">
      {/* =================================================
          HEADER
         ================================================= */}

      <header className="codescape3d-header">
        <div>
          <div className="codescape3d-eyebrow">
            CODESCAPE
            <span>/</span>
            SOFTWARE CITY
          </div>

          <h1>Structural Software View</h1>

          <p>
            Explore modules, classes, functions, dependencies and security
            damage as an interactive 3D architecture.
          </p>
        </div>

        <div className="header-actions">
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
        </div>
      </header>

      {/* =================================================
          3D VIEW
         ================================================= */}

      <main className="codescape3d-view">
        <Canvas
          shadows
          camera={{
            position: [16, 12, 17],
            fov: 45,
            near: 0.1,
            far: 180,
          }}
          dpr={[1, 1.75]}
          gl={{
            antialias: true,
          }}
        >
          <color attach="background" args={["#020617"]} />

          <fog attach="fog" args={["#020617", 38, 95]} />

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
            TOP STAT BAR
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

        {/* =================================================
            VIEW INFORMATION
           ================================================= */}

        <div className="codescape3d-controls">
          <div className="panel-title">NAVIGATION</div>

          <div>
            <span>Drag</span>
            Rotate
          </div>

          <div>
            <span>Scroll</span>
            Zoom
          </div>

          <div>
            <span>Right Drag</span>
            Pan
          </div>

          <div>
            <span>Click</span>
            Inspect
          </div>

          <div>
            <span>Hover</span>
            Identify
          </div>
        </div>

        {/* =================================================
            LEGEND
           ================================================= */}

        <div className="codescape3d-legend">
          <div className="panel-title">ARCHITECTURE</div>

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
            Function / Method
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
            SECURITY STATUS
           ================================================= */}

        <div className="security-summary">
          <div className="panel-title">SECURITY STATUS</div>

          {findings.length === 0 ? (
            <div className="security-clean">
              <span>✓</span>
              No supported security findings
            </div>
          ) : (
            <div className="security-warning">
              <span>!</span>

              <div>
                <strong>{findings.length} findings</strong>

                <small>Structural damage detected</small>
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            INSPECTOR
           ================================================= */}

        {selectedObject && (
          <aside className="codescape3d-inspector">
            <div className="inspector-header">
              <div>
                <div className="inspector-eyebrow">STRUCTURAL INSPECTOR</div>

                <h2>
                  {selectedObject.type === "module" && "Module"}

                  {selectedObject.type === "class" && "Class / Room"}

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

              <div className="inspector-type-pill">
                {selectedObject.type.toUpperCase()}
              </div>

              {/* DETAILS */}

              <div className="inspector-details">
                <div className="inspector-row">
                  <span>File</span>

                  <strong>
                    {selectedObject.data?.file ||
                      selectedObject.data?.path ||
                      selectedObject.data?.module ||
                      "Unknown"}
                  </strong>
                </div>

                {selectedObject.type !== "module" && (
                  <div className="inspector-row">
                    <span>Line</span>

                    <strong>{getLine(selectedObject.data) || "Unknown"}</strong>
                  </div>
                )}

                {selectedObject.type === "module" && (
                  <>
                    <div className="inspector-row">
                      <span>Classes</span>

                      <strong>
                        {getModuleClasses(selectedObject.data, classes).length}
                      </strong>
                    </div>

                    <div className="inspector-row">
                      <span>Functions</span>

                      <strong>
                        {
                          getModuleFunctions(selectedObject.data, functions)
                            .length
                        }
                      </strong>
                    </div>
                  </>
                )}

                {selectedObject.type === "class" && (
                  <div className="inspector-row">
                    <span>Methods</span>

                    <strong>
                      {getClassMethods(selectedObject.data).length}
                    </strong>
                  </div>
                )}
              </div>

              {/* SOURCE BUTTON */}

              {selectedObject.type !== "module" && (
                <button
                  className="source-button"
                  onClick={openSourceViewer}
                  disabled={sourceLoading}
                >
                  {sourceLoading ? "Loading Source..." : "View Source Code"}
                </button>
              )}

              {sourceError && <div className="source-error">{sourceError}</div>}

              {/* SECURITY */}

              {selectedObject.findings?.length > 0 ? (
                <div className="inspector-security">
                  <div className="security-title">⚠ SECURITY FINDINGS</div>

                  {selectedObject.findings.map((finding, findingIndex) => {
                    const severity = finding?.severity || "Informational";

                    return (
                      <div
                        key={finding?.id || findingIndex}
                        className={`finding-card finding-${String(
                          severity,
                        ).toLowerCase()}`}
                      >
                        <div className="finding-top">
                          <strong>{finding?.id || "Finding"}</strong>

                          <span>{severity}</span>
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
              ) : (
                <div className="inspector-healthy">
                  <span>✓</span>
                  No security findings mapped to this component.
                </div>
              )}

              {/* RECOMMENDATION */}

              {recommendationForSelected && (
                <div className="inspector-recommendation">
                  <div className="recommendation-heading">
                    RECOMMENDED ACTION
                  </div>

                  <strong>{recommendationForSelected.title}</strong>

                  <p>{recommendationForSelected.recommendation}</p>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* =================================================
            SOURCE VIEWER
           ================================================= */}

        <SourceCodeViewer
          sourceViewer={sourceViewer}
          onClose={() => setSourceViewer(null)}
        />
      </main>
    </div>
  );
}

export default CodeScape3DPage;
