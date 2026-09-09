import ast
from pathlib import Path


class ArchitectureVisitor(ast.NodeVisitor):
    """
    Extract architectural information from a Python AST.

    The analyzer identifies:
    - modules
    - classes
    - class methods
    - top-level functions
    - imports
    """

    def __init__(self):
        self.classes = []
        self.functions = []
        self.imports = []

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append({
                "name": alias.name,
                "module": alias.name,
                "type": "import",
                "line": node.lineno,
            })

    def visit_ImportFrom(self, node):
        module_name = node.module or ""

        for alias in node.names:
            imported_name = alias.name

            full_name = (
                f"{module_name}.{imported_name}"
                if module_name
                else imported_name
            )

            self.imports.append({
                "name": full_name,
                "module": module_name,
                "type": "from_import",
                "line": node.lineno,
            })

    def visit_ClassDef(self, node):
        methods = []

        for child in node.body:
            if isinstance(
                child,
                (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                ),
            ):
                methods.append(
                    self.build_function_data(
                        child,
                        is_method=True,
                    )
                )

        class_data = {
            "name": node.name,
            "line": node.lineno,
            "end_line": getattr(
                node,
                "end_lineno",
                node.lineno,
            ),
            "methods": methods,
        }

        self.classes.append(
            class_data
        )

        # Check for nested classes without
        # duplicating class methods/functions.
        for child in node.body:
            if isinstance(
                child,
                ast.ClassDef,
            ):
                self.visit(child)

    def visit_FunctionDef(self, node):
        """
        Collect top-level functions.
        """

        self.functions.append(
            self.build_function_data(
                node,
                is_method=False,
            )
        )

    def visit_AsyncFunctionDef(self, node):
        self.functions.append(
            self.build_function_data(
                node,
                is_method=False,
            )
        )

    def build_function_data(
        self,
        node,
        is_method,
    ):
        arguments = []

        for argument in (
            node.args.posonlyargs
            + node.args.args
            + node.args.kwonlyargs
        ):
            arguments.append(
                argument.arg
            )

        if node.args.vararg:
            arguments.append(
                f"*{node.args.vararg.arg}"
            )

        if node.args.kwarg:
            arguments.append(
                f"**{node.args.kwarg.arg}"
            )

        return {
            "name": node.name,
            "line": node.lineno,
            "end_line": getattr(
                node,
                "end_lineno",
                node.lineno,
            ),
            "async": isinstance(
                node,
                ast.AsyncFunctionDef,
            ),
            "is_method": is_method,
            "arguments": arguments,
            "argument_count": len(
                arguments
            ),
            "has_docstring": (
                ast.get_docstring(node)
                is not None
            ),
        }


def module_name_from_path(
    file_path,
    project_root,
):
    """
    Convert a Python file path into a
    Python-style module name.

    Example:

        app/services/auth.py

    becomes:

        app.services.auth
    """

    relative_path = file_path.relative_to(
        project_root
    )

    parts = list(
        relative_path.parts
    )

    if not parts:
        return ""

    filename = parts[-1]

    if filename == "__init__.py":
        parts = parts[:-1]
    else:
        parts[-1] = Path(
            filename
        ).stem

    return ".".join(parts)


def analyze_architecture(
    file_path: Path,
    project_root: Path,
):
    """
    Analyze one Python file.
    """

    relative_path = (
        file_path
        .relative_to(project_root)
        .as_posix()
    )

    source = file_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    result = {
        "file": relative_path,
        "module": module_name_from_path(
            file_path,
            project_root,
        ),
        "lines": len(
            source.splitlines()
        ),
        "classes": [],
        "functions": [],
        "imports": [],
        "parse_error": None,
    }

    try:
        tree = ast.parse(
            source,
            filename=relative_path,
        )

    except SyntaxError as error:
        result["parse_error"] = {
            "message": str(error),
            "line": error.lineno,
            "offset": error.offset,
        }

        return result

    visitor = ArchitectureVisitor()

    visitor.visit(tree)

    result["classes"] = visitor.classes
    result["functions"] = visitor.functions
    result["imports"] = visitor.imports

    return result


def resolve_internal_dependency(
    imported_module,
    internal_modules,
):
    """
    Determine whether an imported module belongs
    to the analyzed project.

    Returns the matching internal module or None.
    """

    if not imported_module:
        return None

    # Prefer the longest matching module.
    matches = [
        module
        for module in internal_modules
        if (
            imported_module == module
            or imported_module.startswith(
                module + "."
            )
        )
    ]

    if not matches:
        return None

    return max(
        matches,
        key=len,
    )


def build_architecture_model(
    python_files,
    project_root,
):
    """
    Analyze all Python files and construct
    a project-level architecture model.
    """

    files = []

    modules = []

    classes = []

    functions = []

    dependencies = []

    internal_modules = set()

    # ========================================
    # ANALYZE FILES
    # ========================================

    for file_path in python_files:

        architecture = analyze_architecture(
            file_path,
            project_root,
        )

        files.append(
            architecture
        )

        module_name = architecture[
            "module"
        ]

        if module_name:
            modules.append({
                "name": module_name,
                "file": architecture[
                    "file"
                ],
            })

            internal_modules.add(
                module_name
            )

        for class_data in architecture[
            "classes"
        ]:
            classes.append({
                "name": class_data[
                    "name"
                ],
                "file": architecture[
                    "file"
                ],
                "line": class_data[
                    "line"
                ],
                "end_line": class_data.get(
                    "end_line",
                    class_data["line"],
                ),
                "methods": class_data[
                    "methods"
                ],
            })

        for function_data in architecture[
            "functions"
        ]:
            functions.append({
                "name": function_data[
                    "name"
                ],
                "file": architecture[
                    "file"
                ],
                "line": function_data[
                    "line"
                ],
                "end_line": function_data.get(
                    "end_line",
                    function_data["line"],
                ),
                "arguments": function_data[
                    "arguments"
                ],
                "argument_count": function_data[
                    "argument_count"
                ],
                "has_docstring": function_data[
                    "has_docstring"
                ],
                "async": function_data[
                    "async"
                ],
            })

    # ========================================
    # BUILD DEPENDENCIES
    # ========================================

    for file_data in files:

        source_module = file_data[
            "module"
        ]

        for imported in file_data[
            "imports"
        ]:

            imported_module = imported.get(
                "module"
            )

            if not imported_module:
                imported_module = imported.get(
                    "name",
                    "",
                )

            target_module = (
                resolve_internal_dependency(
                    imported_module,
                    internal_modules,
                )
            )

            if target_module:

                dependency_type = "internal"

                target = target_module

            else:

                dependency_type = "external"

                target = imported_module

            dependencies.append({
                "source": source_module,
                "target": target,
                "type": dependency_type,
                "file": file_data[
                    "file"
                ],
                "line": imported[
                    "line"
                ],
                "import": imported[
                    "name"
                ],
            })

    # ========================================
    # SUMMARY
    # ========================================

    internal_dependency_count = sum(
        1
        for dependency in dependencies
        if dependency["type"] == "internal"
    )

    external_dependency_count = sum(
        1
        for dependency in dependencies
        if dependency["type"] == "external"
    )

    return {
        "files": files,

        "modules": modules,

        "classes": classes,

        "functions": functions,

        "dependencies": dependencies,

        "summary": {
            "files": len(files),
            "modules": len(modules),
            "classes": len(classes),
            "functions": len(functions),
            "methods": sum(
                len(
                    class_data.get(
                        "methods",
                        [],
                    )
                )
                for class_data in classes
            ),
            "internal_dependencies": (
                internal_dependency_count
            ),
            "external_dependencies": (
                external_dependency_count
            ),
            "total_dependencies": len(
                dependencies
            ),
        },
    }