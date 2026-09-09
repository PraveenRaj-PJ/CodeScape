import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadProject } from "../services/api";
import "./UploadPage.css";

function UploadPage() {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFile = (file) => {
    if (!file) {
      return;
    }

    const isZip = file.name.toLowerCase().endsWith(".zip");

    if (!isZip) {
      setErrorMessage("Please select a ZIP file containing your project.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage("The project ZIP must be smaller than 50 MB.");
      return;
    }

    setErrorMessage("");
    setSelectedFile(file);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];

    handleFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();

    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    handleFile(file);
  };

  const openFilePicker = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const removeFile = () => {
    if (isUploading) {
      return;
    }

    setSelectedFile(null);
    setErrorMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a ZIP project first.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const project = await uploadProject(selectedFile);

      navigate("/analysis", {
        state: {
          project,
        },
      });
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong while uploading.");

      setIsUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <header className="upload-navbar">
        <button
          className="back-button"
          onClick={() => navigate("/")}
          disabled={isUploading}
        >
          ← Back
        </button>

        <div className="upload-logo">
          <span className="upload-logo-mark">C</span>
          <span>CODESCAPE</span>
        </div>

        <div className="upload-step">
          STEP <strong>01</strong> / 03
        </div>
      </header>

      <main className="upload-main">
        <div className="upload-heading">
          <div className="upload-eyebrow">PROJECT ANALYSIS</div>

          <h1>
            Bring your
            <br />
            <span>codebase.</span>
          </h1>

          <p>
            Upload your project and let CodeScape examine its structure,
            security, quality, and dependencies.
          </p>
        </div>

        <div
          className={`drop-zone ${isDragging ? "dragging" : ""} ${
            selectedFile ? "has-file" : ""
          } ${isUploading ? "uploading" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();

            if (!isUploading) {
              setIsDragging(true);
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={!selectedFile ? openFilePicker : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleInputChange}
            hidden
          />

          {!selectedFile ? (
            <div>
              <div className="upload-icon">↑</div>

              <h2>Drop your project here</h2>

              <p>or click to browse your files</p>

              <span className="file-type">ZIP PROJECT • MAX 50 MB</span>
            </div>
          ) : (
            <div className="selected-file">
              <div className="file-icon">ZIP</div>

              <div className="file-details">
                <strong>{selectedFile.name}</strong>

                <span>
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)}
                  {" MB"}
                </span>
              </div>

              <button
                className="remove-file"
                onClick={(event) => {
                  event.stopPropagation();
                  removeFile();
                }}
                disabled={isUploading}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="upload-error">
            <span>!</span>
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="upload-actions">
          <button
            className="upload-analyze-button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isUploading}
          >
            <span>
              {isUploading ? "Uploading Project..." : "Analyze Project"}
            </span>

            <span>{isUploading ? "..." : "→"}</span>
          </button>
        </div>

        <div className="upload-note">
          <span>ⓘ</span>

          <p>
            CodeScape currently accepts ZIP project archives. Your source code
            will be analyzed locally by the project analysis pipeline.
          </p>
        </div>
      </main>

      <footer className="upload-footer">
        <span>CODESCAPE ANALYSIS PIPELINE</span>

        <div className="pipeline">
          <span className="active">UPLOAD</span>

          <i></i>

          <span>ANALYZE</span>

          <i></i>

          <span>VISUALIZE</span>
        </div>
      </footer>
    </div>
  );
}

export default UploadPage;
