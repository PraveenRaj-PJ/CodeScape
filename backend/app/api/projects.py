from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Query,
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


# ============================================================
# READ SOURCE FILE
# ============================================================

@router.get(
    "/{project_id}/source"
)
async def get_source_file(
    project_id: str,
    path: str = Query(
        ...,
        description=(
            "Relative source-file path "
            "inside the uploaded ZIP."
        ),
    ),
):
    """
    Return the source code of a file from
    the uploaded project ZIP.

    This endpoint is used by the CodeScape
    Source Code Inspector.
    """

    # --------------------------------------------------------
    # Validate project ID
    # --------------------------------------------------------

    if (
        not project_id
        or "/" in project_id
        or "\\" in project_id
        or ".." in project_id
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Invalid project ID."
            ),
        )

    # --------------------------------------------------------
    # Locate uploaded ZIP
    # --------------------------------------------------------

    project_zip = (
        UPLOAD_DIR
        / f"{project_id}.zip"
    )

    if not project_zip.exists():

        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Project ZIP was not found."
            ),
        )

    # --------------------------------------------------------
    # Normalize source path
    # --------------------------------------------------------

    source_path = (
        path
        .replace("\\", "/")
        .lstrip("/")
    )

    # Prevent path traversal
    path_parts = Path(
        source_path
    ).parts

    if (
        not source_path
        or ".." in path_parts
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Invalid source file path."
            ),
        )

    # --------------------------------------------------------
    # Read source from ZIP
    # --------------------------------------------------------

    try:

        with ZipFile(
            project_zip,
            "r",
        ) as archive:

            # -----------------------------------------------
            # Find exact file
            # -----------------------------------------------

            archive_names = (
                archive.namelist()
            )

            if source_path not in archive_names:

                # Handle ZIP paths that may contain
                # a leading ./ prefix.
                alternative_path = (
                    source_path
                    if source_path.startswith("./")
                    else f"./{source_path}"
                )

                if alternative_path in archive_names:

                    source_path = (
                        alternative_path
                    )

                else:

                    raise HTTPException(
                        status_code=(
                            status.HTTP_404_NOT_FOUND
                        ),
                        detail=(
                            f"Source file '{path}' "
                            "was not found in "
                            "the project."
                        ),
                    )

            # -----------------------------------------------
            # Prevent reading directories
            # -----------------------------------------------

            info = archive.getinfo(
                source_path
            )

            if info.is_dir():

                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "The requested path "
                        "is a directory."
                    ),
                )

            # -----------------------------------------------
            # Read bytes
            # -----------------------------------------------

            source_bytes = (
                archive.read(
                    source_path
                )
            )

    except BadZipFile as error:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "The project ZIP is corrupted."
            ),
        ) from error

    except HTTPException:

        raise

    except OSError as error:

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Unable to read the project ZIP."
            ),
        ) from error

    # --------------------------------------------------------
    # Decode source
    # --------------------------------------------------------

    try:

        source_code = (
            source_bytes.decode(
                "utf-8"
            )
        )

    except UnicodeDecodeError:

        try:

            source_code = (
                source_bytes.decode(
                    "utf-8",
                    errors="replace",
                )
            )

        except Exception as error:

            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "The requested file "
                    "could not be decoded "
                    "as text."
                ),
            ) from error

    # --------------------------------------------------------
    # Success
    # --------------------------------------------------------

    return {
        "success": True,
        "project_id": project_id,
        "path": path,
        "content": source_code,
        "line_count": (
            len(
                source_code.splitlines()
            )
        ),
    }