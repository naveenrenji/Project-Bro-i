"""
Financial Estimation Engine – pure computation, no Streamlit dependency.

Replicates and corrects the Excel financial model for graduate program
P&L estimation.  Every public function takes a plain dict of inputs and
returns pandas DataFrames or scalars.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from math import ceil
from typing import Any


# ─────────────────────────────────────────────────────────────────────
# Default Inputs
# ─────────────────────────────────────────────────────────────────────

def get_default_inputs() -> dict[str, Any]:
    """Return default input parameters (aligned with the original Excel)."""
    return {
        # Program Structure
        "program_name": "New Graduate Program",
        "total_courses": 10,
        "credits_per_course": 3,
        "delivery_format": "8-week",       # "8-week" or "16-week"
        "include_summer": True,
        "projection_years": 5,
        "start_fy": 2026,

        # Course Development
        "courses_to_develop": 3,
        "dev_cost_per_course": 50_000,
        "courses_to_revise": 0,
        "revision_cost_pct": 0.30,         # 30 % of new-development cost
        "dev_amortization_terms": 2,

        # Enrollment & Growth
        "initial_intake": 25,
        "fall_growth_rate": 0.25,
        "spring_growth_rate": 0.01,
        "summer_growth_rate": 0.01,

        # Retention
        "early_retention_rate": 0.85,
        "late_retention_rate": 0.90,
        "retention_threshold_term": 4,     # first N terms use early rate

        # Graduation Curve (auto-generated when None or empty)
        "graduation_curve": None,

        # Tuition & Revenue
        "tuition_per_credit": 1_395,
        "credits_per_term": 6,             # 6 for 8-week, 3 for 16-week
        "tuition_inflation_pct": 0.00,

        # Faculty & TA
        "faculty_cost_per_section": 12_000,
        "sections_per_term": 3,
        "ta_student_ratio": 30,
        "ta_hourly_rate": 21,
        "ta_hours_per_week": 20,
        "weeks_per_session": 8,

        # Overhead & Marketing
        "variable_overhead_per_student": 50,
        "fixed_overhead_per_term": 50_000,
        "cac_per_student": 3_000,
        "cost_inflation_pct": 0.07,
    }


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def _terms_per_year(inputs: dict) -> int:
    return 3 if inputs.get("include_summer", True) else 2


def _term_names(inputs: dict) -> list[str]:
    return ["Fall", "Spring", "Summer"] if inputs.get("include_summer", True) \
        else ["Fall", "Spring"]


def generate_term_labels(inputs: dict) -> list[str]:
    """E.g. ['Fall-1', 'Spring-1', 'Summer-1', 'Fall-2', …]."""
    names = _term_names(inputs)
    tpy = _terms_per_year(inputs)
    labels: list[str] = []
    for y in range(1, inputs["projection_years"] + 1):
        for t in range(tpy):
            labels.append(f"{names[t]}-{y}")
    return labels


def get_term_type(term_index: int, inputs: dict) -> str:
    names = _term_names(inputs)
    tpy = _terms_per_year(inputs)
    return names[term_index % tpy]


def get_year_index(term_index: int, inputs: dict) -> int:
    """0-based year index for a calendar-term index."""
    return term_index // _terms_per_year(inputs)


def program_duration_terms(inputs: dict) -> int:
    """Minimum terms to complete the programme."""
    total_credits = inputs["total_courses"] * inputs["credits_per_course"]
    cpt = inputs["credits_per_term"]
    return max(1, ceil(total_credits / cpt)) if cpt > 0 else 1


# ─────────────────────────────────────────────────────────────────────
# Graduation curve
# ─────────────────────────────────────────────────────────────────────

def generate_default_graduation_curve(prog_terms: int) -> list[float]:
    """
    Build a sensible cumulative-graduation curve.

    Index i  →  cumulative fraction graduated by end of internal term i+1.
    E.g. for a 5-term programme:
        T1-T4  = 0 %  (still in programme)
        T5     = 30 %
        T6     = 55 %
        T7     = 70 %
        T8     = 85 %
        T9     = 95 %
        T10    = 100 %
    """
    max_terms = prog_terms + 5
    curve = [0.0] * max_terms
    ramp = [0.30, 0.55, 0.70, 0.85, 0.95, 1.0]
    ramp_start = max(0, prog_terms - 1)          # 0-indexed
    for i, pct in enumerate(ramp):
        idx = ramp_start + i
        if idx < max_terms:
            curve[idx] = pct
    # Ensure final value is 1.0
    if curve[-1] < 1.0:
        curve[-1] = 1.0
    return curve


def _get_graduation_curve(inputs: dict) -> list[float]:
    gc = inputs.get("graduation_curve")
    if gc and len(gc) > 0:
        return list(gc)
    return generate_default_graduation_curve(program_duration_terms(inputs))


# ─────────────────────────────────────────────────────────────────────
# Cohort model
# ─────────────────────────────────────────────────────────────────────

def compute_cohort_intakes(inputs: dict) -> list[float]:
    """Initial-intake sizes for each calendar-term cohort."""
    tpy = _terms_per_year(inputs)
    n = inputs["projection_years"] * tpy
    intakes = [0.0] * n
    intakes[0] = float(inputs["initial_intake"])
    growth = {
        "Fall":   inputs["fall_growth_rate"],
        "Spring": inputs["spring_growth_rate"],
        "Summer": inputs["summer_growth_rate"],
    }
    for t in range(1, n):
        tt = get_term_type(t, inputs)
        intakes[t] = intakes[t - 1] * (1 + growth.get(tt, 0))
    return intakes


def _compute_single_cohort(
    initial: float,
    grad_curve: list[float],
    inputs: dict,
    max_terms: int,
) -> list[float]:
    """Active students for ONE cohort over its internal terms."""
    ret_early = inputs["early_retention_rate"]
    ret_late  = inputs["late_retention_rate"]
    threshold = inputs["retention_threshold_term"]

    active = [0.0] * max_terms
    active[0] = initial

    for t in range(1, max_terms):
        retention = ret_early if t < threshold else ret_late
        retained = active[t - 1] * retention

        # Graduates leaving at end of term t  (the transition t-1 → t)
        cum_now  = grad_curve[t - 1] if (t - 1) < len(grad_curve) else 1.0
        cum_prev = grad_curve[t - 2] if (t - 2) >= 0 and (t - 2) < len(grad_curve) else 0.0
        graduates = max(0.0, (cum_now - cum_prev) * initial)

        active[t] = max(0.0, retained - min(retained, graduates))
    return active


def compute_cohort_matrix(inputs: dict) -> tuple[pd.DataFrame, list[float], list[float], int]:
    """
    Returns
    -------
    cohort_df : DataFrame  – rows = cohort labels, cols = [Initial Intake, T1, T2, …]
    intakes   : list       – per-cohort initial intake
    grad_curve: list       – cumulative graduation fractions
    prog_terms: int        – minimum programme length in terms
    """
    tpy = _terms_per_year(inputs)
    n_cal = inputs["projection_years"] * tpy
    prog_terms = program_duration_terms(inputs)
    grad_curve = _get_graduation_curve(inputs)
    max_active = len(grad_curve)
    intakes = compute_cohort_intakes(inputs)

    matrix = np.zeros((n_cal, max_active))
    for c in range(n_cal):
        matrix[c] = _compute_single_cohort(intakes[c], grad_curve, inputs, max_active)

    labels = generate_term_labels(inputs)
    cols = [f"T{i + 1}" for i in range(max_active)]
    df = pd.DataFrame(matrix, index=labels, columns=cols)
    df.insert(0, "Initial Intake", [round(x, 2) for x in intakes])
    return df, intakes, grad_curve, prog_terms


# ─────────────────────────────────────────────────────────────────────
# Aggregation helpers
# ─────────────────────────────────────────────────────────────────────

def compute_active_per_calendar_term(
    cohort_df: pd.DataFrame,
    inputs: dict,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Total active students and new-cohort students for every calendar term.
    """
    t_cols = [c for c in cohort_df.columns if c.startswith("T")]
    mat = cohort_df[t_cols].values
    n_cal = mat.shape[0]

    total_active = np.zeros(n_cal)
    for t in range(n_cal):
        for c in range(n_cal):
            internal = t - c
            if 0 <= internal < mat.shape[1]:
                total_active[t] += mat[c, internal]

    new_students = cohort_df["Initial Intake"].values.astype(float)
    return total_active, new_students


# ─────────────────────────────────────────────────────────────────────
# Revenue
# ─────────────────────────────────────────────────────────────────────

def compute_revenue(total_active: np.ndarray, inputs: dict) -> pd.DataFrame:
    tpy = _terms_per_year(inputs)
    n = inputs["projection_years"] * tpy
    tuition = inputs["tuition_per_credit"]
    credits = inputs["credits_per_term"]
    t_infl  = inputs["tuition_inflation_pct"]
    labels  = generate_term_labels(inputs)

    rows: list[dict] = []
    for t in range(n):
        yr = get_year_index(t, inputs)
        mult = (1 + t_infl) ** yr
        students = round(total_active[t], 2)
        base = students * tuition * credits
        rows.append({
            "Term": labels[t],
            "Active Students": students,
            "Tuition/Credit": round(tuition * mult, 2),
            "Credits/Term": credits,
            "Base Revenue": round(base, 2),
            "Revenue": round(base * mult, 2),
        })
    return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────
# Costs
# ─────────────────────────────────────────────────────────────────────

def compute_costs(
    total_active: np.ndarray,
    new_students: np.ndarray,
    inputs: dict,
) -> pd.DataFrame:
    tpy = _terms_per_year(inputs)
    n = inputs["projection_years"] * tpy
    sessions = 2 if inputs["delivery_format"] == "8-week" else 1
    weeks    = inputs["weeks_per_session"]
    labels   = generate_term_labels(inputs)

    # TA constant  (cost per student per term)
    ta_ratio = inputs["ta_student_ratio"]
    ta_const = (
        inputs["ta_hourly_rate"]
        * inputs["ta_hours_per_week"]
        * weeks * sessions
    ) / ta_ratio if ta_ratio > 0 else 0.0

    # Course-development amortisation
    total_dev = inputs["courses_to_develop"] * inputs["dev_cost_per_course"]
    total_rev = (inputs["courses_to_revise"]
                 * inputs["dev_cost_per_course"]
                 * inputs["revision_cost_pct"])
    total_course = total_dev + total_rev
    amort = max(inputs["dev_amortization_terms"], 1)
    amort_per = total_course / amort

    c_infl = inputs["cost_inflation_pct"]

    rows: list[dict] = []
    for t in range(n):
        yr   = get_year_index(t, inputs)
        mult = (1 + c_infl) ** yr
        stu  = round(total_active[t], 2)
        new  = round(new_students[t], 2)

        faculty    = inputs["faculty_cost_per_section"] * inputs["sections_per_term"]
        ta         = stu * ta_const
        course_dev = amort_per if t < amort else 0.0
        var_oh     = stu * inputs["variable_overhead_per_student"]
        fix_oh     = inputs["fixed_overhead_per_term"]
        cac        = new * inputs["cac_per_student"]

        base = faculty + ta + course_dev + var_oh + fix_oh + cac
        rows.append({
            "Term": labels[t],
            "Faculty":     round(faculty * mult, 2),
            "TA":          round(ta * mult, 2),
            "Course Dev":  round(course_dev * mult, 2),
            "Variable OH": round(var_oh * mult, 2),
            "Fixed OH":    round(fix_oh * mult, 2),
            "CAC":         round(cac * mult, 2),
            "Base Total":  round(base, 2),
            "Total Cost":  round(base * mult, 2),
        })
    return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────
# P&L summary
# ─────────────────────────────────────────────────────────────────────

def compute_pl_summary(
    revenue_df: pd.DataFrame,
    cost_df: pd.DataFrame,
    inputs: dict,
) -> pd.DataFrame:
    tpy   = _terms_per_year(inputs)
    years = inputs["projection_years"]
    start = inputs.get("start_fy", 2026)

    rows: list[dict] = []
    cumulative = 0.0
    for y in range(years):
        s = y * tpy
        e = s + tpy
        rev  = revenue_df["Revenue"].iloc[s:e].sum()
        cost = cost_df["Total Cost"].iloc[s:e].sum()
        net  = rev - cost
        cumulative += net
        margin = (net / rev * 100) if rev else 0.0
        rows.append({
            "Fiscal Year":  f"FY{start + y}",
            "Revenue":      round(rev, 2),
            "Cost":         round(cost, 2),
            "Net":          round(net, 2),
            "Cumulative":   round(cumulative, 2),
            "Net Margin %": round(margin, 2),
        })

    total_rev  = sum(r["Revenue"] for r in rows)
    total_cost = sum(r["Cost"] for r in rows)
    total_net  = total_rev - total_cost
    total_margin = (total_net / total_rev * 100) if total_rev else 0.0
    rows.append({
        "Fiscal Year":  "Total",
        "Revenue":      round(total_rev, 2),
        "Cost":         round(total_cost, 2),
        "Net":          round(total_net, 2),
        "Cumulative":   round(cumulative, 2),
        "Net Margin %": round(total_margin, 2),
    })
    return pd.DataFrame(rows)


def find_break_even_year(pl: pd.DataFrame) -> str | None:
    for _, row in pl.iterrows():
        if row["Fiscal Year"] == "Total":
            continue
        if row["Cumulative"] >= 0:
            return str(row["Fiscal Year"])
    return None


# ─────────────────────────────────────────────────────────────────────
# Scenario orchestrator
# ─────────────────────────────────────────────────────────────────────

def compute_scenario(inputs: dict) -> dict[str, Any]:
    """Run all computations and return a results dict."""
    cohort_df, intakes, grad_curve, prog_terms = compute_cohort_matrix(inputs)
    total_active, new_students = compute_active_per_calendar_term(cohort_df, inputs)
    revenue_df = compute_revenue(total_active, inputs)
    cost_df    = compute_costs(total_active, new_students, inputs)
    pl_summary = compute_pl_summary(revenue_df, cost_df, inputs)
    be = find_break_even_year(pl_summary)

    totals = pl_summary[pl_summary["Fiscal Year"] == "Total"].iloc[0]

    return {
        "cohort_matrix":    cohort_df,
        "intakes":          intakes,
        "graduation_curve": grad_curve,
        "program_terms":    prog_terms,
        "total_active":     total_active,
        "new_students":     new_students,
        "revenue_df":       revenue_df,
        "cost_df":          cost_df,
        "pl_summary":       pl_summary,
        "break_even_year":  be,
        "total_revenue":    totals["Revenue"],
        "total_cost":       totals["Cost"],
        "total_net":        totals["Net"],
        "total_margin":     totals["Net Margin %"],
        "term_labels":      generate_term_labels(inputs),
    }
