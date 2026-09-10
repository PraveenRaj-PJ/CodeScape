from typing import Any, Dict, List


SEVERITY_PRIORITY = {
    "Critical": 1,
    "High": 2,
    "Medium": 3,
    "Low": 4,
    "Informational": 5,
}


def _priority_from_severity(severity: str) -> str:
    severity = (severity or "").lower()

    if severity == "critical":
        return "Critical"

    if severity == "high":
        return "High"

    if severity == "medium":
        return "Medium"

    if severity == "low":
        return "Low"

    return "Informational"


def _security_recommendation(finding: Dict[str, Any]) -> Dict[str, Any]:
    finding_id = finding.get("id", "SEC-UNKNOWN")
    title = finding.get("title", "Security issue")
    severity = finding.get("severity", "Informational")
    file_path = finding.get("file", finding.get("path", "Unknown file"))
    line = finding.get("line", 0)

    recommendation = finding.get(
        "recommendation",
        "Review this security issue and replace the unsafe implementation with a safer alternative.",
    )

    description = finding.get(
        "description",
        "A security-related code pattern was detected by the static analysis engine.",
    )

    return {
        "id": f"REC-{finding_id}",
        "category": "Security",
        "priority": _priority_from_severity(severity),
        "title": f"Remediate: {title}",
        "problem": description,
        "why_it_matters": (
            f"This issue was detected with {severity} severity and "
            "should be reviewed as part of the project's security hardening."
        ),
        "recommendation": recommendation,
        "target": file_path,
        "line": line,
        "source_finding_ids": [finding_id],
        "source_type": "security_finding",
    }


def _quality_recommendation(finding: Dict[str, Any]) -> Dict[str, Any]:
    finding_id = finding.get("id", "QUALITY-UNKNOWN")
    title = finding.get("title", "Code quality issue")
    severity = finding.get("severity", "Medium")
    file_path = finding.get("file", finding.get("path", "Unknown file"))
    line = finding.get("line", 0)

    recommendation = finding.get(
        "recommendation",
        "Refactor the affected code to improve readability, maintainability, and reliability.",
    )

    description = finding.get(
        "description",
        "A measurable code quality weakness was detected.",
    )

    return {
        "id": f"REC-{finding_id}",
        "category": "Code Quality",
        "priority": _priority_from_severity(severity),
        "title": f"Improve: {title}",
        "problem": description,
        "why_it_matters": (
            "Reducing structural complexity makes the code easier to "
            "understand, test, maintain, and extend."
        ),
        "recommendation": recommendation,
        "target": file_path,
        "line": line,
        "source_finding_ids": [finding_id],
        "source_type": "quality_finding",
    }


def _architecture_recommendations(
    architecture: Dict[str, Any],
) -> List[Dict[str, Any]]:
    recommendations = []

    summary = architecture.get("summary", {}) or {}

    modules = summary.get(
        "modules",
        len(architecture.get("modules", []) or []),
    )

    classes = summary.get(
        "classes",
        len(architecture.get("classes", []) or []),
    )

    functions = summary.get(
        "functions",
        len(architecture.get("functions", []) or []),
    )

    internal_dependencies = summary.get(
        "internal_dependencies",
        0,
    )

    external_dependencies = summary.get(
        "external_dependencies",
        0,
    )

    total_dependencies = summary.get(
        "total_dependencies",
        internal_dependencies + external_dependencies,
    )

    if modules >= 10:
        recommendations.append(
            {
                "id": "REC-ARCH-001",
                "category": "Architecture",
                "priority": "Medium",
                "title": "Consider modularizing the project",
                "problem": (
                    f"The project contains {modules} modules, indicating "
                    "a relatively large structural surface."
                ),
                "why_it_matters": (
                    "Clear module boundaries reduce coupling and make "
                    "individual components easier to test and maintain."
                ),
                "recommendation": (
                    "Review module responsibilities and group related "
                    "functionality into clearly defined components. "
                    "Avoid modules that combine unrelated responsibilities."
                ),
                "target": "Project architecture",
                "line": 0,
                "source_finding_ids": [],
                "source_type": "architecture_insight",
            }
        )

    if internal_dependencies >= 8:
        recommendations.append(
            {
                "id": "REC-ARCH-002",
                "category": "Architecture",
                "priority": "Medium",
                "title": "Review internal dependency coupling",
                "problem": (
                    f"The architecture contains {internal_dependencies} "
                    "internal dependencies."
                ),
                "why_it_matters": (
                    "High internal coupling can make changes propagate "
                    "across multiple modules and increase maintenance cost."
                ),
                "recommendation": (
                    "Review highly connected modules and introduce clearer "
                    "interfaces or service boundaries where appropriate."
                ),
                "target": "Internal dependency graph",
                "line": 0,
                "source_finding_ids": [],
                "source_type": "architecture_insight",
            }
        )

    if total_dependencies >= 15:
        recommendations.append(
            {
                "id": "REC-ARCH-003",
                "category": "Architecture",
                "priority": "Low",
                "title": "Review dependency footprint",
                "problem": (
                    f"The project currently has approximately "
                    f"{total_dependencies} detected dependencies."
                ),
                "why_it_matters": (
                    "A large dependency footprint can increase maintenance, "
                    "compatibility, and security-management overhead."
                ),
                "recommendation": (
                    "Review dependencies periodically and remove packages "
                    "that are unused, duplicated, or unnecessary."
                ),
                "target": "Project dependencies",
                "line": 0,
                "source_finding_ids": [],
                "source_type": "architecture_insight",
            }
        )

    if functions >= 30 and classes == 0:
        recommendations.append(
            {
                "id": "REC-ARCH-004",
                "category": "Architecture",
                "priority": "Low",
                "title": "Consider introducing stronger component boundaries",
                "problem": (
                    f"The project contains {functions} functions but no "
                    "detected classes."
                ),
                "why_it_matters": (
                    "Large function-oriented projects can become harder to "
                    "organize as the codebase grows."
                ),
                "recommendation": (
                    "Evaluate whether related functionality should be grouped "
                    "behind clearer modules, services, or domain components."
                ),
                "target": "Project architecture",
                "line": 0,
                "source_finding_ids": [],
                "source_type": "architecture_insight",
            }
        )

    return recommendations


def _project_summary_recommendation(
    architecture: Dict[str, Any],
    security_findings: List[Dict[str, Any]],
    quality_findings: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    recommendations = []

    if not security_findings:
        recommendations.append(
            {
                "id": "REC-SEC-BASELINE",
                "category": "Security",
                "priority": "Informational",
                "title": "Maintain the current security baseline",
                "problem": (
                    "No supported security patterns were detected by the "
                    "current static security rules."
                ),
                "why_it_matters": (
                    "A clean result indicates that the implemented rules "
                    "did not identify the currently supported risky patterns."
                ),
                "recommendation": (
                    "Continue using secure coding practices and periodically "
                    "extend the security rule set as the project evolves."
                ),
                "target": "Project security",
                "line": 0,
                "source_finding_ids": [],
                "source_type": "project_insight",
            }
        )

    if security_findings and quality_findings:
        recommendations.append(
            {
                "id": "REC-PROCESS-001",
                "category": "Engineering",
                "priority": "Medium",
                "title": "Address security and quality issues together",
                "problem": (
                    "The analysis identified both security findings and "
                    "code-quality weaknesses."
                ),
                "why_it_matters": (
                    "Complex or poorly structured code can make security "
                    "issues harder to identify, test, and maintain."
                ),
                "recommendation": (
                    "Prioritize critical and high-severity security findings "
                    "first, then refactor the affected code while preserving "
                    "the security fixes."
                ),
                "target": "Project remediation plan",
                "line": 0,
                "source_finding_ids": [
                    finding.get("id")
                    for finding in security_findings[:5]
                    if finding.get("id")
                ],
                "source_type": "cross_analysis_insight",
            }
        )

    return recommendations


def generate_recommendations(
    architecture: Dict[str, Any] | None = None,
    security_findings: List[Dict[str, Any]] | None = None,
    quality_findings: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """
    Generate contextual recommendations from CodeScape analysis results.

    Security and quality findings are produced by deterministic analysis
    engines. This module interprets those findings and produces structured
    remediation recommendations.

    This function does not claim to detect vulnerabilities itself.
    """

    architecture = architecture or {}
    security_findings = security_findings or []
    quality_findings = quality_findings or []

    recommendations: List[Dict[str, Any]] = []

    for finding in security_findings:
        recommendations.append(
            _security_recommendation(finding)
        )

    for finding in quality_findings:
        recommendations.append(
            _quality_recommendation(finding)
        )

    recommendations.extend(
        _architecture_recommendations(architecture)
    )

    recommendations.extend(
        _project_summary_recommendation(
            architecture,
            security_findings,
            quality_findings,
        )
    )

    recommendations.sort(
        key=lambda item: (
            SEVERITY_PRIORITY.get(
                item.get("priority", "Informational"),
                5,
            ),
            item.get("category", ""),
            item.get("title", ""),
        )
    )

    priority_counts = {
        "Critical": 0,
        "High": 0,
        "Medium": 0,
        "Low": 0,
        "Informational": 0,
    }

    category_counts: Dict[str, int] = {}

    for recommendation in recommendations:
        priority = recommendation.get(
            "priority",
            "Informational",
        )

        category = recommendation.get(
            "category",
            "Other",
        )

        priority_counts[priority] = (
            priority_counts.get(priority, 0) + 1
        )

        category_counts[category] = (
            category_counts.get(category, 0) + 1
        )

    return {
        "recommendations": recommendations,
        "summary": {
            "total": len(recommendations),
            "priority_counts": priority_counts,
            "category_counts": category_counts,
        },
    }