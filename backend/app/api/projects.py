from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
    status,
)

from app.services.project_analyzer import (
    analyze_project,
)


router = APIRouter(
    prefix="/api/projects",
    tags=["Projects"],
)


BASE_DIR = Path(__file__).resolve().parents[2]

UPLOAD_DIR = (
    BASE_DIR / "uploads"
)

MAX_FILE_SIZE = (
    50 * 1024 * 1024
)


# ============================================================
# UPLOAD PROJECT
# ============================================================

@router.post("/upload")
async def upload_project(
    file: UploadFile = File(...),
):
    filename = (
        file.filename or ""
    )

    # --------------------------------------------------------
    # Validate extension
    # --------------------------------------------------------

    if not filename.lower().endswith(
        ".zip"
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Only ZIP project files "
                "are supported."
            ),
        )

    # --------------------------------------------------------
    # Create upload directory
    # --------------------------------------------------------

    UPLOAD_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Generate project ID
    # --------------------------------------------------------

    project_id = uuid4().hex

    saved_filename = (
        f"{project_id}.zip"
    )

    destination = (
        UPLOAD_DIR
        / saved_filename
    )

    total_size = 0

    # --------------------------------------------------------
    # Save upload
    # --------------------------------------------------------

    try:

        with destination.open(
            "wb"
        ) as output_file:

            while True:

                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                total_size += len(
                    chunk
                )

                if (
                    total_size
                    > MAX_FILE_SIZE
                ):

                    if destination.exists():
                        destination.unlink()

                    raise HTTPException(
                        status_code=(
                            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                        ),
                        detail=(
                            "Project ZIP must be "
                            "smaller than 50 MB."
                        ),
                    )

                output_file.write(
                    chunk
                )

    finally:

        await file.close()

    # --------------------------------------------------------
    # Validate ZIP
    # --------------------------------------------------------

    try:

        with ZipFile(
            destination,
            "r",
        ) as archive:

            bad_file = (
                archive.testzip()
            )

            if bad_file is not None:

                raise ValueError(
                    f"Corrupted ZIP entry: "
                    f"{bad_file}"
                )

    except (
        BadZipFile,
        OSError,
        ValueError,
    ) as error:

        if destination.exists():
            destination.unlink()

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "The uploaded file is not "
                "a valid ZIP archive."
            ),
        ) from error

    # --------------------------------------------------------
    # Success
    # --------------------------------------------------------

    return {
        "success": True,
        "project_id": project_id,
        "filename": filename,
        "size_bytes": total_size,
        "message": (
            "Project uploaded successfully."
        ),
    }


# ============================================================
# ANALYZE PROJECT
# ============================================================

@router.post(
    "/{project_id}/analyze"
)
async def analyze_uploaded_project(
    project_id: str,
    filename: str,
):
    try:

        structure = analyze_project(
            project_id,
            filename,
        )

        return {
            "success": True,
            "project_id": project_id,
            "structure": structure,
        }

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=str(error),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(error),
        ) from error

    except Exception as error:

        # IMPORTANT:
        # Show the real error in the terminal
        # during development.

        print(
            "\n========================================"
        )

        print(
            "CODESCAPE ANALYSIS ERROR"
        )

        print(
            "========================================"
        )

        print(
            f"Project ID: {project_id}"
        )

        print(
            f"Filename: {filename}"
        )

        print(
            f"Error type: {type(error).__name__}"
        )

        print(
            f"Error: {error}"
        )

        print(
            "========================================\n"
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "An unexpected error occurred "
                "while analyzing the project. "
                "Check the backend terminal "
                "for the detailed error."
            ),
        ) from error