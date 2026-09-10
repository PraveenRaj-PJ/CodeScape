const API_BASE_URL = "http://127.0.0.1:8000";

// ============================================================
// UPLOAD PROJECT
// ============================================================

export async function uploadProject(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/projects/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to upload project.");
  }

  return data;
}

// ============================================================
// ANALYZE PROJECT
// ============================================================

export async function analyzeProject(projectId, filename) {
  const params = new URLSearchParams({
    filename,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/projects/${projectId}/analyze?${params.toString()}`,
    {
      method: "POST",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to analyze project.");
  }

  return data;
}

// ============================================================
// GET SOURCE CODE
// ============================================================

export async function getSourceFile(projectId, filePath) {
  if (!projectId) {
    throw new Error("Project ID is required to load source code.");
  }

  if (!filePath) {
    throw new Error("Source file path is required.");
  }

  const params = new URLSearchParams({
    path: filePath,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/projects/${projectId}/source?${params.toString()}`,
    {
      method: "GET",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to load source code.");
  }

  return data;
}
