import ast
from pathlib import Path


class QualityVisitor(ast.NodeVisitor):

    def __init__(self, source):
        self.source = source
        self.findings = []

    def add_finding(
        self,
        rule_id,
        title,
        severity,
        description,
        recommendation,
        node,
        metric=None,
    ):
        line_number = getattr(
            node,
            "lineno",
            1,
        )

        finding = {
            "id": rule_id,
            "title": title,
            "severity": severity,
            "line": line_number,
            "description": description,
            "recommendation": recommendation,
        }

        if metric is not None:
            finding["metric"] = metric

        self.findings.append(finding)

    def visit_FunctionDef(self, node):

        # QUALITY001 - Long function
        end_line = getattr(
            node,
            "end_lineno",
            node.lineno,
        )

        function_length = (
            end_line - node.lineno + 1
        )

        if function_length > 50:

            self.add_finding(
                rule_id="QUALITY001",
                title="Long function",
                severity="Medium",
                description=(
                    f"Function '{node.name}' contains "
                    f"{function_length} lines of code."
                ),
                recommendation=(
                    "Break the function into smaller "
                    "single-responsibility functions."
                ),
                node=node,
                metric={
                    "name": "function_lines",
                    "value": function_length,
                },
            )

        # QUALITY002 - Too many arguments
        arguments = node.args

        argument_count = (
            len(arguments.posonlyargs)
            + len(arguments.args)
            + len(arguments.kwonlyargs)
        )

        if arguments.vararg is not None:
            argument_count += 1

        if arguments.kwarg is not None:
            argument_count += 1

        if argument_count > 5:

            self.add_finding(
                rule_id="QUALITY002",
                title="Too many function arguments",
                severity="Medium",
                description=(
                    f"Function '{node.name}' accepts "
                    f"{argument_count} arguments."
                ),
                recommendation=(
                    "Consider grouping related parameters "
                    "into a data structure or class."
                ),
                node=node,
                metric={
                    "name": "argument_count",
                    "value": argument_count,
                },
            )

        # QUALITY003 - Missing docstring
        if (
            ast.get_docstring(node) is None
            and not node.name.startswith("_")
        ):

            self.add_finding(
                rule_id="QUALITY003",
                title="Missing function docstring",
                severity="Low",
                description=(
                    f"Public function '{node.name}' "
                    "does not contain a docstring."
                ),
                recommendation=(
                    "Add a short docstring explaining "
                    "the function's purpose, parameters, "
                    "and return value."
                ),
                node=node,
            )

        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):

        # Apply the same function checks to async functions.
        self.visit_FunctionDef(node)

    def visit_ClassDef(self, node):

        # QUALITY004 - Long class
        end_line = getattr(
            node,
            "end_lineno",
            node.lineno,
        )

        class_length = (
            end_line - node.lineno + 1
        )

        if class_length > 300:

            self.add_finding(
                rule_id="QUALITY004",
                title="Large class",
                severity="High",
                description=(
                    f"Class '{node.name}' contains "
                    f"{class_length} lines of code."
                ),
                recommendation=(
                    "Split the class into smaller "
                    "cohesive classes with clear responsibilities."
                ),
                node=node,
                metric={
                    "name": "class_lines",
                    "value": class_length,
                },
            )

        self.generic_visit(node)


def calculate_complexity(node):
    """
    Calculate a simple cyclomatic complexity score
    for a function.
    """

    complexity = 1

    for child in ast.walk(node):

        if isinstance(
            child,
            (
                ast.If,
                ast.For,
                ast.AsyncFor,
                ast.While,
                ast.IfExp,
                ast.ExceptHandler,
                ast.With,
                ast.AsyncWith,
            ),
        ):
            complexity += 1

        elif isinstance(
            child,
            ast.BoolOp,
        ):
            complexity += (
                len(child.values) - 1
            )

        elif isinstance(
            child,
            ast.comprehension,
        ):
            complexity += 1

        elif isinstance(
            child,
            ast.Match,
        ):
            complexity += len(
                child.cases
            )

    return complexity


def calculate_max_nesting(node):
    """
    Calculate the maximum nesting depth
    inside a function.
    """

    nesting_nodes = (
        ast.If,
        ast.For,
        ast.AsyncFor,
        ast.While,
        ast.With,
        ast.AsyncWith,
        ast.Try,
    )

    maximum_depth = 0

    def walk(current_node, depth):

        nonlocal maximum_depth

        if isinstance(
            current_node,
            nesting_nodes,
        ):

            depth += 1

            maximum_depth = max(
                maximum_depth,
                depth,
            )

        for child in ast.iter_child_nodes(
            current_node
        ):
            walk(
                child,
                depth,
            )

    walk(node, 0)

    return maximum_depth


def analyze_imports(tree):
    """
    Count imported modules.
    """

    imports = set()

    for node in ast.walk(tree):

        if isinstance(
            node,
            ast.Import,
        ):

            for alias in node.names:
                imports.add(
                    alias.name
                )

        elif isinstance(
            node,
            ast.ImportFrom,
        ):

            if node.module:
                imports.add(
                    node.module
                )

    return imports


def analyze_quality(
    file_path: Path,
    project_root: Path,
):
    """
    Analyze Python source code for
    measurable code-quality characteristics.
    """

    relative_path = file_path.relative_to(
        project_root
    ).as_posix()

    source = file_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    result = {
        "file": relative_path,
        "lines": len(
            source.splitlines()
        ),
        "functions": 0,
        "classes": 0,
        "imports": 0,
        "complexity": [],
        "nesting": [],
        "findings": [],
    }

    try:

        tree = ast.parse(
            source,
            filename=relative_path,
        )

    except SyntaxError:

        return result

    visitor = QualityVisitor(
        source
    )

    visitor.visit(tree)

    result["findings"] = (
        visitor.findings
    )

    imports = analyze_imports(
        tree
    )

    result["imports"] = len(
        imports
    )

    for node in ast.walk(tree):

        if isinstance(
            node,
            (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
            ),
        ):

            result["functions"] += 1

            complexity = (
                calculate_complexity(
                    node
                )
            )

            nesting = (
                calculate_max_nesting(
                    node
                )
            )

            result["complexity"].append({
                "name": node.name,
                "line": node.lineno,
                "value": complexity,
            })

            result["nesting"].append({
                "name": node.name,
                "line": node.lineno,
                "value": nesting,
            })

            # QUALITY005 - High complexity
            if complexity > 10:

                result["findings"].append({
                    "id": "QUALITY005",
                    "title": (
                        "High cyclomatic complexity"
                    ),
                    "severity": "High",
                    "line": node.lineno,
                    "description": (
                        f"Function '{node.name}' "
                        f"has a cyclomatic complexity "
                        f"of {complexity}."
                    ),
                    "recommendation": (
                        "Simplify the function by "
                        "reducing branching and "
                        "extracting smaller functions."
                    ),
                    "metric": {
                        "name": "cyclomatic_complexity",
                        "value": complexity,
                    },
                })

            # QUALITY006 - Deep nesting
            if nesting > 4:

                result["findings"].append({
                    "id": "QUALITY006",
                    "title": (
                        "Deeply nested code"
                    ),
                    "severity": "Medium",
                    "line": node.lineno,
                    "description": (
                        f"Function '{node.name}' "
                        f"reaches a nesting depth "
                        f"of {nesting}."
                    ),
                    "recommendation": (
                        "Reduce nested control flow "
                        "using guard clauses, helper "
                        "functions, or simpler logic."
                    ),
                    "metric": {
                        "name": "nesting_depth",
                        "value": nesting,
                    },
                })

    for node in ast.walk(tree):

        if isinstance(
            node,
            ast.ClassDef,
        ):

            result["classes"] += 1

    # QUALITY007 - Large file
    if result["lines"] > 500:

        result["findings"].append({
            "id": "QUALITY007",
            "title": "Large source file",
            "severity": "Medium",
            "line": 1,
            "description": (
                f"The file contains "
                f"{result['lines']} lines."
            ),
            "recommendation": (
                "Consider splitting the file "
                "into smaller modules with "
                "clear responsibilities."
            ),
            "metric": {
                "name": "file_lines",
                "value": result["lines"],
            },
        })

    # QUALITY008 - Too many imports
    if result["imports"] > 15:

        result["findings"].append({
            "id": "QUALITY008",
            "title": "Too many imports",
            "severity": "Low",
            "line": 1,
            "description": (
                f"The file imports "
                f"{result['imports']} modules."
            ),
            "recommendation": (
                "Review whether all dependencies "
                "are necessary and consider "
                "splitting responsibilities."
            ),
            "metric": {
                "name": "import_count",
                "value": result["imports"],
            },
        })

    return result