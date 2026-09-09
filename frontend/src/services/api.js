const API_BASE_URL = "http://127.0.0.1:8000";

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
