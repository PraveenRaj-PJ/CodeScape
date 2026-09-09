import ast
import json
import shutil
from pathlib import Path
from zipfile import ZipFile

from app.services.architecture_analyzer import (
    build_architecture_model,
)
from app.services.quality_analyzer import (
    analyze_quality,
)
from app.services.security_analyzer import (
    analyze_security,
)


IGNORED_DIRECTORIES = {
    "__pycache__",
    ".git",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
}


def get_backend_directory():
    return Path(__file__).resolve().parents[2]


def get_upload_directory():
    return get_backend_directory() / "uploads"


def get_result_directory():
    return get_backend_directory() / "results"


def should_ignore(path):
    return any(
        part in IGNORED_DIRECTORIES
        for part in path.parts
    )


def safe_extract_zip(
    archive_path,
    extraction_directory,
):
    extraction_directory = extraction_directory.resolve()

    with ZipFile(
        archive_path,
        "r",
    ) as archive:

        for member in archive.infolist():

            member_path = (
                extraction_directory
                / member.filename
            ).resolve()

            if (
                member_path != extraction_directory
                and extraction_directory
                not in member_path.parents
            ):
                raise ValueError(
                    "Unsafe ZIP archive detected."
                )

        archive.extractall(
            extraction_directory
        )


def discover_python_files(
    project_directory,
):
    python_files = []

    for path in project_directory.rglob(
        "*.py"
    ):

        if should_ignore(path):
            continue

        python_files.append(path)

    return sorted(
        python_files
    )


def get_relative_path(
    file_path,
    project_directory,
):
    return file_path.relative_to(
        project_directory
    ).as_posix()


def analyze_python_file(
    file_path,
    project_directory,
):
    relative_path = get_relative_path(
        file_path,
        project_directory,
    )

    source = file_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    file_result = {
        "file": relative_path,
        "lines": len(
            source.splitlines()
        ),
        "imports": [],
        "classes": [],
        "functions": [],
        "parse_error": None,
    }

    try:

        tree = ast.parse(
            source,
            filename=relative_path,
        )

    except SyntaxError as error:

        file_result["parse_error"] = {
            "message": str(error),
            "line": error.lineno,
            "offset": error.offset,
        }

        return file_result

    for node in ast.walk(tree):

        if isinstance(
            node,
            ast.Import,
        ):

            for alias in node.names:

                file_result[
                    "imports"
                ].append(
                    alias.name
                )

        elif isinstance(
            node,
            ast.ImportFrom,
        ):

            if node.module:

                file_result[
                    "imports"
                ].append(
                    node.module
                )

        elif isinstance(
            node,
            ast.ClassDef,
        ):

            file_result[
                "classes"
            ].append({
                "name": node.name,
                "line": node.lineno,
            })

        elif isinstance(
            node,
            (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
            ),
        ):

            file_result[
                "functions"
            ].append({
                "name": node.name,
                "line": node.lineno,
                "async": isinstance(
                    node,
                    ast.AsyncFunctionDef,
                ),
            })

    file_result[
        "imports"
    ] = sorted(
        set(
            file_result["imports"]
        )
    )

    return file_result


def build_dependencies(
    files,
):
    dependencies = []

    known_modules = set()

    for file_data in files:

        file_path = file_data[
            "file"
        ]

        module_name = (
            Path(file_path)
            .with_suffix("")
            .as_posix()
            .replace(
                "/",
                ".",
            )
        )

        known_modules.add(
            module_name
        )

    for file_data in files:

        source_file = file_data[
            "file"
        ]

        for imported_module in file_data[
            "imports"
        ]:

            matching_module = None

            for known_module in known_modules:

                if (
                    imported_module
                    == known_module
                    or imported_module.startswith(
                        known_module + "."
                    )
                ):

                    matching_module = (
                        known_module
                    )
                    break

            if matching_module:

                dependencies.append({
                    "source": source_file,
                    "target": matching_module,
                    "type": "import",
                })

    return dependencies


def summarize_security_findings(
    findings,
):
    summary = {
        "total_findings": len(
            findings
        ),
        "critical_findings": 0,
        "high_findings": 0,
        "medium_findings": 0,
        "low_findings": 0,
    }

    for finding in findings:

        severity = (
            finding.get(
                "severity",
                "",
            )
            .lower()
        )

        if severity == "critical":
            summary[
                "critical_findings"
            ] += 1

        elif severity == "high":
            summary[
                "high_findings"
            ] += 1

        elif severity == "medium":
            summary[
                "medium_findings"
            ] += 1

        elif severity == "low":
            summary[
                "low_findings"
            ] += 1

    return summary


def summarize_quality_findings(
    findings,
):
    summary = {
        "total_findings": len(
            findings
        ),
        "high_findings": 0,
        "medium_findings": 0,
        "low_findings": 0,
    }

    for finding in findings:

        severity = (
            finding.get(
                "severity",
                "",
            )
            .lower()
        )

        if severity == "high":
            summary[
                "high_findings"
            ] += 1

        elif severity == "medium":
            summary[
                "medium_findings"
            ] += 1

        elif severity == "low":
            summary[
                "low_findings"
            ] += 1

    return summary


def merge_architecture_data(
    files,
    architecture_model,
):
    architecture_files = {
        item["file"]: item
        for item in architecture_model[
            "files"
        ]
    }

    for file_data in files:

        architecture_data = (
            architecture_files.get(
                file_data["file"]
            )
        )

        if not architecture_data:
            continue

        file_data[
            "module"
        ] = architecture_data.get(
            "module",
            "",
        )

        file_data[
            "architecture_classes"
        ] = architecture_data.get(
            "classes",
            [],
        )

        file_data[
            "architecture_functions"
        ] = architecture_data.get(
            "functions",
            [],
        )

        file_data[
            "architecture_imports"
        ] = architecture_data.get(
            "imports",
            [],
        )


def analyze_project(
    project_id,
    original_filename,
):
    upload_directory = (
        get_upload_directory()
    )

    result_directory = (
        get_result_directory()
        / project_id
    )

    archive_path = (
        upload_directory
        / f"{project_id}.zip"
    )

    if not archive_path.exists():

        raise FileNotFoundError(
            "Uploaded project archive was not found."
        )

    if result_directory.exists():

        shutil.rmtree(
            result_directory
        )

    result_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    extraction_directory = (
        result_directory
        / "source"
    )

    extraction_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    safe_extract_zip(
        archive_path,
        extraction_directory,
    )

    python_files = (
        discover_python_files(
            extraction_directory
        )
    )

    files = []

    security_findings = []

    quality_findings = []

    for file_path in python_files:

        file_data = analyze_python_file(
            file_path,
            extraction_directory,
        )

        files.append(
            file_data
        )

        security_findings.extend(
            analyze_security(
                file_path,
                extraction_directory,
            )
        )

        quality_result = (
            analyze_quality(
                file_path,
                extraction_directory,
            )
        )

        quality_findings.extend(
            [
                {
                    **finding,
                    "file": quality_result[
                        "file"
                    ],
                }
                for finding in quality_result[
                    "findings"
                ]
            ]
        )

        file_data[
            "quality"
        ] = {
            "lines": quality_result[
                "lines"
            ],
            "functions": quality_result[
                "functions"
            ],
            "classes": quality_result[
                "classes"
            ],
            "imports": quality_result[
                "imports"
            ],
            "complexity": quality_result[
                "complexity"
            ],
            "nesting": quality_result[
                "nesting"
            ],
        }

    # ========================================
    # ARCHITECTURE ANALYSIS
    # ========================================

    architecture_model = (
        build_architecture_model(
            python_files,
            extraction_directory,
        )
    )

    merge_architecture_data(
        files,
        architecture_model,
    )

    dependencies = (
        build_dependencies(
            files
        )
    )

    architecture_dependencies = (
        architecture_model.get(
            "dependencies",
            [],
        )
    )

    total_lines = sum(
        file_data["lines"]
        for file_data in files
    )

    total_classes = sum(
        len(
            file_data["classes"]
        )
        for file_data in files
    )

    total_functions = sum(
        len(
            file_data["functions"]
        )
        for file_data in files
    )

    total_imports = len(
        {
            imported
            for file_data in files
            for imported in file_data[
                "imports"
            ]
        }
    )

    total_methods = sum(
        len(
            class_data.get(
                "methods",
                [],
            )
        )
        for class_data in architecture_model[
            "classes"
        ]
    )

    security_summary = (
        summarize_security_findings(
            security_findings
        )
    )

    quality_summary = (
        summarize_quality_findings(
            quality_findings
        )
    )

    structure = {
        "project": {
            "id": project_id,
            "filename": original_filename,
        },

        "summary": {
            "python_files": len(
                files
            ),
            "lines_of_code": total_lines,
            "modules": len(
                architecture_model[
                    "modules"
                ]
            ),
            "classes": total_classes,
            "functions": total_functions,
            "methods": total_methods,
            "imports": total_imports,
            "dependencies": len(
                architecture_dependencies
            ),
        },

        "security_summary": (
            security_summary
        ),

        "quality_summary": (
            quality_summary
        ),

        "architecture": {
            "modules": architecture_model[
                "modules"
            ],
            "classes": architecture_model[
                "classes"
            ],
            "functions": architecture_model[
                "functions"
            ],
            "dependencies": architecture_dependencies,
            "summary": architecture_model[
                "summary"
            ],
        },

        "files": files,

        "dependencies": dependencies,

        "security_findings": (
            security_findings
        ),

        "quality_findings": (
            quality_findings
        ),
    }

    result_file = (
        result_directory
        / "structure.json"
    )

    result_file.write_text(
        json.dumps(
            structure,
            indent=2,
        ),
        encoding="utf-8",
    )

    return structure