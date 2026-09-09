import ast
import re
from pathlib import Path


SECRET_PATTERN = re.compile(
    r"(?i)"
    r"(password|passwd|secret|api[_-]?key|"
    r"access[_-]?token|auth[_-]?token|private[_-]?key)"
    r"\s*=\s*"
    r"['\"][^'\"]{6,}['\"]"
)


class SecurityVisitor(ast.NodeVisitor):

    def __init__(self, file_path, source):
        self.file_path = file_path
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
        evidence=None,
    ):
        line_number = getattr(
            node,
            "lineno",
            1,
        )

        if evidence is None:
            lines = self.source.splitlines()

            if 0 < line_number <= len(lines):
                evidence = lines[line_number - 1].strip()
            else:
                evidence = ""

        self.findings.append({
            "id": rule_id,
            "title": title,
            "severity": severity,
            "file": self.file_path,
            "line": line_number,
            "evidence": evidence,
            "description": description,
            "recommendation": recommendation,
        })

    def visit_Call(self, node):

        function_name = self.get_function_name(
            node.func
        )

        # -------------------------------------------------
        # SEC001 - eval()
        # -------------------------------------------------

        if function_name == "eval":

            self.add_finding(
                rule_id="SEC001",
                title="Dynamic code execution using eval()",
                severity="Critical",
                description=(
                    "The application uses eval(), which can "
                    "execute dynamically supplied Python code. "
                    "If attacker-controlled input reaches this "
                    "function, arbitrary code execution may occur."
                ),
                recommendation=(
                    "Avoid eval(). Replace it with explicit "
                    "parsing or a safe allow-listed operation."
                ),
                node=node,
            )


        # -------------------------------------------------
        # SEC002 - exec()
        # -------------------------------------------------

        elif function_name == "exec":

            self.add_finding(
                rule_id="SEC002",
                title="Dynamic code execution using exec()",
                severity="Critical",
                description=(
                    "The application uses exec(), allowing "
                    "Python code to be executed dynamically."
                ),
                recommendation=(
                    "Avoid exec() for user-controlled or "
                    "externally supplied data."
                ),
                node=node,
            )


        # -------------------------------------------------
        # SEC003 - subprocess shell=True
        # -------------------------------------------------

        elif function_name in {
            "subprocess.run",
            "subprocess.call",
            "subprocess.Popen",
            "subprocess.check_output",
            "subprocess.check_call",
        }:

            for keyword in node.keywords:

                if (
                    keyword.arg == "shell"
                    and isinstance(
                        keyword.value,
                        ast.Constant,
                    )
                    and keyword.value.value is True
                ):

                    self.add_finding(
                        rule_id="SEC003",
                        title="Unsafe subprocess shell execution",
                        severity="High",
                        description=(
                            "A subprocess call uses shell=True. "
                            "If command content is influenced by "
                            "external input, this may enable "
                            "command injection."
                        ),
                        recommendation=(
                            "Avoid shell=True where possible. "
                            "Pass commands as argument lists and "
                            "validate external input."
                        ),
                        node=node,
                    )


        # -------------------------------------------------
        # SEC004 - os.system()
        # -------------------------------------------------

        elif function_name == "os.system":

            self.add_finding(
                rule_id="SEC004",
                title="Operating system command execution",
                severity="High",
                description=(
                    "os.system() executes a command through the "
                    "operating system shell."
                ),
                recommendation=(
                    "Prefer subprocess with shell=False and "
                    "an explicit argument list."
                ),
                node=node,
            )


        # -------------------------------------------------
        # SEC005 - Weak hashing
        # -------------------------------------------------

        elif function_name in {
            "hashlib.md5",
            "hashlib.sha1",
        }:

            algorithm = (
                "MD5"
                if function_name.endswith("md5")
                else "SHA-1"
            )

            self.add_finding(
                rule_id="SEC005",
                title=f"Weak cryptographic hash: {algorithm}",
                severity="Medium",
                description=(
                    f"{algorithm} is considered weak for "
                    "security-sensitive cryptographic purposes."
                ),
                recommendation=(
                    "Use a modern cryptographic hash such as "
                    "SHA-256 or SHA-3 where appropriate."
                ),
                node=node,
            )


        # -------------------------------------------------
        # SEC006 - Unsafe pickle
        # -------------------------------------------------

        elif function_name in {
            "pickle.load",
            "pickle.loads",
        }:

            self.add_finding(
                rule_id="SEC006",
                title="Unsafe deserialization using pickle",
                severity="High",
                description=(
                    "Python pickle deserialization can execute "
                    "arbitrary code when processing untrusted data."
                ),
                recommendation=(
                    "Do not deserialize untrusted data with pickle. "
                    "Use a safe data format such as JSON when possible."
                ),
                node=node,
            )


        # -------------------------------------------------
        # SEC008 - Potential SQL injection
        # -------------------------------------------------

        elif function_name.endswith(".execute"):

            if node.args:

                query_argument = node.args[0]

                if self.is_dynamic_string(
                    query_argument
                ):

                    self.add_finding(
                        rule_id="SEC008",
                        title="Potential SQL injection",
                        severity="Critical",
                        description=(
                            "A SQL execution call appears to "
                            "construct its query dynamically. "
                            "Unvalidated external input may "
                            "allow SQL injection."
                        ),
                        recommendation=(
                            "Use parameterized queries instead "
                            "of dynamically constructing SQL strings."
                        ),
                        node=node,
                    )

        self.generic_visit(node)


    def get_function_name(self, node):

        if isinstance(node, ast.Name):
            return node.id

        if isinstance(node, ast.Attribute):

            parent = self.get_function_name(
                node.value
            )

            if parent:
                return f"{parent}.{node.attr}"

            return node.attr

        return ""


    def is_dynamic_string(self, node):

        # f"SELECT ... {user_input}"
        if isinstance(
            node,
            ast.JoinedStr,
        ):
            return True

        # "SELECT..." + variable
        if isinstance(
            node,
            ast.BinOp,
        ) and isinstance(
            node.op,
            ast.Add,
        ):
            return True

        # "SELECT %s" % variable
        if isinstance(
            node,
            ast.BinOp,
        ) and isinstance(
            node.op,
            ast.Mod,
        ):
            return True

        # "SELECT {}".format(variable)
        if isinstance(
            node,
            ast.Call,
        ):
            function_name = self.get_function_name(
                node.func
            )

            if function_name.endswith(".format"):
                return True

        return False


def detect_hardcoded_secrets(
    file_path,
    source,
):
    findings = []

    lines = source.splitlines()

    for index, line in enumerate(lines):

        match = SECRET_PATTERN.search(line)

        if not match:
            continue

        line_number = index + 1

        findings.append({
            "id": "SEC007",
            "title": "Potential hardcoded secret",
            "severity": "High",
            "file": file_path,
            "line": line_number,
            "evidence": line.strip(),
            "description": (
                "A variable name suggests that a secret, "
                "password, token, or API key may be stored "
                "directly in source code."
            ),
            "recommendation": (
                "Move secrets to environment variables or "
                "a dedicated secrets-management system. "
                "Never commit production secrets to source control."
            ),
        })

    return findings


def analyze_security(
    file_path: Path,
    project_root: Path,
):
    relative_path = file_path.relative_to(
        project_root
    ).as_posix()

    source = file_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    findings = []

    # AST-based rules
    try:

        tree = ast.parse(
            source,
            filename=relative_path,
        )

        visitor = SecurityVisitor(
            relative_path,
            source,
        )

        visitor.visit(tree)

        findings.extend(
            visitor.findings
        )

    except SyntaxError:
        # Structural analyzer already records
        # syntax errors. Security analysis simply
        # skips files that cannot be parsed.
        pass

    # Regex-based hardcoded secret detection
    findings.extend(
        detect_hardcoded_secrets(
            relative_path,
            source,
        )
    )

    return findings