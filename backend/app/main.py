from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.projects import router as projects_router


app = FastAPI(
    title="CodeScape API",
    description="Backend API for the CodeScape intelligent code analysis platform.",
    version="0.2.0",
)


app.add_middleware(
    CORSMiddleware,
  allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://code-scape.netlify.app",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(projects_router)


@app.get("/")
def root():
    return {
        "project": "CodeScape",
        "message": "CodeScape backend is running!",
        "version": "0.2.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }