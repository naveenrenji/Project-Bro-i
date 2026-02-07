"""
Program Financial Estimation – Streamlit UI component.

Provides an interactive interface for modelling the financial viability
of a new graduate programme: inputs, cohort matrix, revenue/cost
breakdown, P&L summary, scenario comparison, and PDF/Excel export.
"""

from __future__ import annotations
import copy, io
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from components.financial_engine import (
    get_default_inputs,
    compute_scenario,
    generate_term_labels,
    program_duration_terms,
    generate_default_graduation_curve,
)
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_COLORS,
)
from utils.formatting import format_currency

# Brand colours for charts
_RED   = "#A32638"
_DGRAY = "#363D45"
_GRAY  = "#7F7F7F"
_LGRAY = "#E4E5E6"
_GREEN = "#2E7D32"

_CHART_TEMPLATE = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font_color="#FAFAFA",
    font_family="IBM Plex Sans, Arial, sans-serif",
)


# ────────────────────────── session-state helpers ──────────────────────
_SS_KEY = "fin_est"


def _ss():
    """Return the financial-estimation sub-dict of session_state."""
    if _SS_KEY not in st.session_state:
        st.session_state[_SS_KEY] = {
            "inputs": get_default_inputs(),
            "scenarios": [],      # list of {name, inputs, results}
        }
    return st.session_state[_SS_KEY]


def _inputs() -> dict:
    return _ss()["inputs"]


# ────────────────────────── formatting helpers ────────────────────────

def _fmt_cur(v: float) -> str:
    if v < 0:
        return f"(${abs(v):,.0f})"
    return f"${v:,.0f}"


def _kpi_card(label: str, value: str, accent: str = _RED):
    st.markdown(f"""
    <div class="cpe-card cpe-card--accent-left" style="--cpe-accent:{accent};padding:18px 16px;">
        <div style="font-size:12px;color:{STEVENS_GRAY_LIGHT};text-transform:uppercase;letter-spacing:.5px;">{label}</div>
        <div style="font-size:28px;font-weight:700;color:#FAFAFA;margin-top:4px;">{value}</div>
    </div>""", unsafe_allow_html=True)


# ═══════════════════════════ INPUT SECTION ═════════════════════════════

def _render_inputs() -> dict:
    """Render all input controls and return the current inputs dict."""
    inp = _inputs()

    with st.expander("Program Structure", expanded=True):
        c1, c2, c3 = st.columns(3)
        with c1:
            inp["program_name"] = st.text_input("Program Name", inp["program_name"])
            inp["total_courses"] = st.number_input("Total Courses in Program", 1, 50, int(inp["total_courses"]))
        with c2:
            inp["credits_per_course"] = st.number_input("Credits per Course", 1, 12, int(inp["credits_per_course"]))
            inp["delivery_format"] = st.radio(
                "Delivery Format",
                ["8-week", "16-week"],
                index=0 if inp["delivery_format"] == "8-week" else 1,
                horizontal=True,
            )
        with c3:
            inp["projection_years"] = st.number_input("Projection Horizon (years)", 1, 10, int(inp["projection_years"]))
            inp["start_fy"] = st.number_input("Starting Fiscal Year", 2024, 2035, int(inp.get("start_fy", 2026)))
            inp["include_summer"] = st.checkbox("Include Summer Term", value=inp.get("include_summer", True))

        total_credits = inp["total_courses"] * inp["credits_per_course"]
        sessions = 2 if inp["delivery_format"] == "8-week" else 1
        st.caption(
            f"Total program credits: **{total_credits}** · "
            f"Sessions/term: **{sessions}** · "
            f"Terms/year: **{3 if inp['include_summer'] else 2}**"
        )

    with st.expander("Course Development"):
        c1, c2 = st.columns(2)
        with c1:
            inp["courses_to_develop"] = st.number_input("New Courses to Develop", 0, 50, int(inp["courses_to_develop"]))
            inp["dev_cost_per_course"] = st.number_input("Dev Cost per Course ($)", 0, 500_000, int(inp["dev_cost_per_course"]), step=5000)
        with c2:
            inp["courses_to_revise"] = st.number_input("Courses to Revise", 0, 50, int(inp["courses_to_revise"]))
            inp["revision_cost_pct"] = st.slider("Revision Cost (% of Dev Cost)", 0, 100, int(inp["revision_cost_pct"] * 100)) / 100.0
        inp["dev_amortization_terms"] = st.number_input("Amortise Dev Cost Over (terms)", 1, 10, int(inp["dev_amortization_terms"]))
        total_dev = inp["courses_to_develop"] * inp["dev_cost_per_course"]
        total_rev = inp["courses_to_revise"] * inp["dev_cost_per_course"] * inp["revision_cost_pct"]
        st.caption(f"Total dev: **{_fmt_cur(total_dev)}** · Revision: **{_fmt_cur(total_rev)}** · Amortised/term: **{_fmt_cur((total_dev + total_rev) / max(inp['dev_amortization_terms'], 1))}**")

    with st.expander("Enrollment & Growth"):
        c1, c2 = st.columns(2)
        with c1:
            inp["initial_intake"] = st.number_input("Initial Fall-1 Intake (students)", 1, 1000, int(inp["initial_intake"]))
        with c2:
            pass
        c1, c2, c3 = st.columns(3)
        with c1:
            inp["fall_growth_rate"] = st.number_input("Fall Growth %", -50.0, 200.0, float(inp["fall_growth_rate"] * 100), step=1.0) / 100
        with c2:
            inp["spring_growth_rate"] = st.number_input("Spring Growth %", -50.0, 200.0, float(inp["spring_growth_rate"] * 100), step=1.0) / 100
        with c3:
            if inp.get("include_summer", True):
                inp["summer_growth_rate"] = st.number_input("Summer Growth %", -50.0, 200.0, float(inp["summer_growth_rate"] * 100), step=1.0) / 100

    with st.expander("Retention"):
        c1, c2, c3 = st.columns(3)
        with c1:
            inp["early_retention_rate"] = st.number_input("Early Retention %", 0.0, 100.0, float(inp["early_retention_rate"] * 100), step=1.0) / 100
        with c2:
            inp["late_retention_rate"] = st.number_input("Late Retention %", 0.0, 100.0, float(inp["late_retention_rate"] * 100), step=1.0) / 100
        with c3:
            inp["retention_threshold_term"] = st.number_input("Switch After Term", 1, 20, int(inp["retention_threshold_term"]))

    with st.expander("Graduation Curve"):
        prog_t = program_duration_terms(inp)
        gc = inp.get("graduation_curve")
        if gc is None or len(gc) == 0:
            gc = generate_default_graduation_curve(prog_t)
        max_t = len(gc)
        gc_df = pd.DataFrame({
            "Term": [f"T{i + 1}" for i in range(max_t)],
            "Cumulative Graduation %": [round(v * 100, 1) for v in gc],
        })
        edited = st.data_editor(
            gc_df,
            use_container_width=True,
            num_rows="dynamic",
            column_config={
                "Term": st.column_config.TextColumn(disabled=True),
                "Cumulative Graduation %": st.column_config.NumberColumn(min_value=0, max_value=100, step=1),
            },
            key="grad_curve_editor",
        )
        inp["graduation_curve"] = [v / 100.0 for v in edited["Cumulative Graduation %"].tolist()]
        st.caption(f"Min. programme length: **{prog_t} terms**. Curve spans **{len(inp['graduation_curve'])} terms**.")

    with st.expander("Tuition & Revenue"):
        c1, c2, c3 = st.columns(3)
        with c1:
            inp["tuition_per_credit"] = st.number_input("Tuition per Credit ($)", 0, 10_000, int(inp["tuition_per_credit"]), step=50)
        with c2:
            suggested = 6 if inp["delivery_format"] == "8-week" else 3
            inp["credits_per_term"] = st.number_input("Avg Credits per Term", 1, 24, int(inp["credits_per_term"]))
        with c3:
            inp["tuition_inflation_pct"] = st.number_input("Tuition Inflation % / year", 0.0, 20.0, float(inp["tuition_inflation_pct"] * 100), step=0.5) / 100
        st.caption(f"Revenue/student/term ≈ **{_fmt_cur(inp['tuition_per_credit'] * inp['credits_per_term'])}**")

    with st.expander("Faculty & TA Costs"):
        c1, c2 = st.columns(2)
        with c1:
            inp["faculty_cost_per_section"] = st.number_input("Faculty $ per Section/Term", 0, 100_000, int(inp["faculty_cost_per_section"]), step=1000)
            inp["sections_per_term"] = st.number_input("Sections Offered per Term", 1, 50, int(inp["sections_per_term"]))
        with c2:
            inp["ta_student_ratio"] = st.number_input("TA : Student Ratio", 1, 200, int(inp["ta_student_ratio"]))
            inp["ta_hourly_rate"] = st.number_input("TA Hourly Rate ($)", 0, 200, int(inp["ta_hourly_rate"]))
        c1, c2 = st.columns(2)
        with c1:
            inp["ta_hours_per_week"] = st.number_input("TA Hours / Week", 0, 60, int(inp["ta_hours_per_week"]))
        with c2:
            inp["weeks_per_session"] = st.number_input("Weeks per Session", 1, 20, int(inp["weeks_per_session"]))

    with st.expander("Overhead & Marketing"):
        c1, c2 = st.columns(2)
        with c1:
            inp["variable_overhead_per_student"] = st.number_input("Variable OH per Student ($)", 0, 10_000, int(inp["variable_overhead_per_student"]), step=10)
            inp["fixed_overhead_per_term"] = st.number_input("Fixed OH per Term ($)", 0, 500_000, int(inp["fixed_overhead_per_term"]), step=5000)
        with c2:
            inp["cac_per_student"] = st.number_input("CAC per New Student ($)", 0, 50_000, int(inp["cac_per_student"]), step=500)
            inp["cost_inflation_pct"] = st.number_input("Cost Inflation % / year", 0.0, 30.0, float(inp["cost_inflation_pct"] * 100), step=0.5) / 100

    return inp


# ═══════════════════════════ RESULTS SECTION ══════════════════════════

def _render_results(inputs: dict, results: dict):
    tab_exec, tab_cohort, tab_detail, tab_compare = st.tabs([
        "Executive Summary",
        "Cohort Details",
        "Revenue & Cost Breakdown",
        "Scenario Comparison",
    ])

    with tab_exec:
        _render_executive_summary(inputs, results)
    with tab_cohort:
        _render_cohort_details(inputs, results)
    with tab_detail:
        _render_revenue_cost_detail(inputs, results)
    with tab_compare:
        _render_scenario_comparison()


# ── Executive Summary ─────────────────────────────────────────────────

def _render_executive_summary(inputs: dict, results: dict):
    pl = results["pl_summary"]

    # KPI cards
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        _kpi_card("Total Revenue", _fmt_cur(results["total_revenue"]))
    with c2:
        _kpi_card("Total Cost", _fmt_cur(results["total_cost"]), _DGRAY)
    with c3:
        colour = _GREEN if results["total_net"] >= 0 else _RED
        _kpi_card("Net P&L", _fmt_cur(results["total_net"]), colour)
    with c4:
        be = results["break_even_year"] or "N/A"
        _kpi_card("Break-Even", be, _GREEN if be != "N/A" else _RED)

    st.markdown("")

    # P&L table
    display = pl.copy()
    for col in ["Revenue", "Cost", "Net", "Cumulative"]:
        display[col] = display[col].apply(_fmt_cur)
    display["Net Margin %"] = display["Net Margin %"].apply(lambda v: f"{v:.1f}%")
    st.dataframe(display, use_container_width=True, hide_index=True)

    # Charts: Revenue vs Cost + Cumulative P&L
    fy_data = pl[pl["Fiscal Year"] != "Total"]
    c1, c2 = st.columns(2)

    with c1:
        fig = go.Figure()
        fig.add_trace(go.Bar(x=fy_data["Fiscal Year"], y=fy_data["Revenue"], name="Revenue", marker_color=_RED))
        fig.add_trace(go.Bar(x=fy_data["Fiscal Year"], y=fy_data["Cost"], name="Cost", marker_color=_DGRAY))
        fig.update_layout(barmode="group", title="Revenue vs Cost by Fiscal Year",
                          **_CHART_TEMPLATE, legend=dict(orientation="h", y=-0.15))
        fig.update_yaxes(tickprefix="$", tickformat=",")
        st.plotly_chart(fig, use_container_width=True)

    with c2:
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=fy_data["Fiscal Year"], y=fy_data["Cumulative"],
                                 mode="lines+markers", name="Cumulative Net",
                                 line=dict(color=_RED, width=3)))
        fig.add_hline(y=0, line_dash="dash", line_color=_GRAY, annotation_text="Break-Even")
        fig.update_layout(title="Cumulative Net P&L", **_CHART_TEMPLATE)
        fig.update_yaxes(tickprefix="$", tickformat=",")
        st.plotly_chart(fig, use_container_width=True)

    # Net Margin trend
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=fy_data["Fiscal Year"], y=fy_data["Net Margin %"],
                             mode="lines+markers", fill="tozeroy",
                             line=dict(color=_RED, width=2),
                             fillcolor="rgba(163,38,56,0.15)"))
    fig.update_layout(title="Net Margin % Trend", **_CHART_TEMPLATE, height=300)
    fig.update_yaxes(ticksuffix="%")
    st.plotly_chart(fig, use_container_width=True)


# ── Cohort Details ────────────────────────────────────────────────────

def _render_cohort_details(inputs: dict, results: dict):
    cm = results["cohort_matrix"]
    t_cols = [c for c in cm.columns if c.startswith("T")]

    # Heatmap
    z = cm[t_cols].values
    fig = go.Figure(go.Heatmap(
        z=z, x=t_cols, y=cm.index.tolist(),
        colorscale=[[0, "#1A1F2E"], [1, _RED]],
        hovertemplate="Cohort %{y}<br>%{x}: %{z:.1f} students<extra></extra>",
    ))
    fig.update_layout(title="Cohort Enrollment Matrix", height=max(400, len(cm) * 28),
                      **_CHART_TEMPLATE, yaxis_autorange="reversed")
    st.plotly_chart(fig, use_container_width=True)

    # Stacked area: total active per calendar term
    labels = results["term_labels"]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=labels, y=results["total_active"],
                             fill="tozeroy", mode="lines",
                             line=dict(color=_RED, width=2),
                             fillcolor="rgba(163,38,56,0.25)",
                             name="Total Active"))
    fig.update_layout(title="Total Active Students per Term", **_CHART_TEMPLATE)
    st.plotly_chart(fig, use_container_width=True)

    # Raw matrix table
    with st.expander("Full Cohort Matrix"):
        st.dataframe(cm.round(1), use_container_width=True)


# ── Revenue & Cost Breakdown ─────────────────────────────────────────

def _render_revenue_cost_detail(inputs: dict, results: dict):
    rev = results["revenue_df"]
    cost = results["cost_df"]
    labels = results["term_labels"]

    st.markdown("### Revenue per Term")
    rev_display = rev.copy()
    for col in ["Base Revenue", "Revenue", "Tuition/Credit"]:
        rev_display[col] = rev_display[col].apply(_fmt_cur)
    st.dataframe(rev_display, use_container_width=True, hide_index=True)

    st.markdown("### Cost Breakdown per Term")
    cost_display = cost.copy()
    for col in ["Faculty", "TA", "Course Dev", "Variable OH", "Fixed OH", "CAC", "Base Total", "Total Cost"]:
        cost_display[col] = cost_display[col].apply(_fmt_cur)
    st.dataframe(cost_display, use_container_width=True, hide_index=True)

    # Stacked cost bar chart
    cost_cols = ["Faculty", "TA", "Course Dev", "Variable OH", "Fixed OH", "CAC"]
    colours = [_RED, _DGRAY, _GRAY, _LGRAY, "#5A6577", _GREEN]
    fig = go.Figure()
    for i, col in enumerate(cost_cols):
        fig.add_trace(go.Bar(x=labels, y=cost[col], name=col,
                             marker_color=colours[i % len(colours)]))
    fig.update_layout(barmode="stack", title="Cost Components by Term",
                      **_CHART_TEMPLATE, legend=dict(orientation="h", y=-0.2))
    fig.update_yaxes(tickprefix="$", tickformat=",")
    st.plotly_chart(fig, use_container_width=True)

    # Revenue vs Cost line
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=labels, y=rev["Revenue"], mode="lines+markers",
                             name="Revenue", line=dict(color=_RED, width=2)))
    fig.add_trace(go.Scatter(x=labels, y=cost["Total Cost"], mode="lines+markers",
                             name="Total Cost", line=dict(color=_DGRAY, width=2, dash="dash")))
    fig.update_layout(title="Revenue vs Cost per Term", **_CHART_TEMPLATE,
                      legend=dict(orientation="h", y=-0.15))
    fig.update_yaxes(tickprefix="$", tickformat=",")
    st.plotly_chart(fig, use_container_width=True)


# ── Scenario Comparison ──────────────────────────────────────────────

def _render_scenario_comparison():
    scenarios = _ss()["scenarios"]
    if len(scenarios) < 2:
        st.info("Save at least 2 scenarios to compare them here.")
        return

    names = [s["name"] for s in scenarios]
    selected = st.multiselect("Select Scenarios to Compare", names, default=names[:3])
    chosen = [s for s in scenarios if s["name"] in selected]
    if len(chosen) < 2:
        return

    # Side-by-side P&L tables
    cols = st.columns(len(chosen))
    for i, sc in enumerate(chosen):
        with cols[i]:
            st.markdown(f"**{sc['name']}**")
            pl = sc["results"]["pl_summary"].copy()
            for col in ["Revenue", "Cost", "Net", "Cumulative"]:
                pl[col] = pl[col].apply(_fmt_cur)
            pl["Net Margin %"] = pl["Net Margin %"].apply(lambda v: f"{v:.1f}%")
            st.dataframe(pl, hide_index=True, use_container_width=True)

    # Overlay charts
    fig = go.Figure()
    line_styles = ["solid", "dash", "dot"]
    for i, sc in enumerate(chosen):
        fy = sc["results"]["pl_summary"]
        fy = fy[fy["Fiscal Year"] != "Total"]
        fig.add_trace(go.Scatter(
            x=fy["Fiscal Year"], y=fy["Cumulative"],
            mode="lines+markers", name=sc["name"],
            line=dict(dash=line_styles[i % len(line_styles)], width=2),
        ))
    fig.add_hline(y=0, line_dash="dash", line_color=_GRAY)
    fig.update_layout(title="Cumulative Net P&L Comparison", **_CHART_TEMPLATE)
    fig.update_yaxes(tickprefix="$", tickformat=",")
    st.plotly_chart(fig, use_container_width=True)


# ═══════════════════════════ SCENARIO CONTROLS ════════════════════════

def _render_scenario_controls(inputs: dict, results: dict):
    st.markdown("---")
    st.markdown("### Scenario Management")
    c1, c2, c3 = st.columns([2, 1, 1])
    with c1:
        name = st.text_input("Scenario Name", value=inputs.get("program_name", "Scenario"),
                             key="scenario_name_input")
    with c2:
        st.markdown("")
        st.markdown("")
        if st.button("Save Scenario", use_container_width=True, type="primary"):
            _ss()["scenarios"].append({
                "name": name,
                "inputs": copy.deepcopy(inputs),
                "results": results,
            })
            st.success(f"Saved '{name}'")
    with c3:
        st.markdown("")
        st.markdown("")
        if st.button("Clear All Scenarios", use_container_width=True):
            _ss()["scenarios"] = []
            st.rerun()

    if _ss()["scenarios"]:
        st.caption(f"Saved scenarios: {', '.join(s['name'] for s in _ss()['scenarios'])}")


# ═══════════════════════════ EXPORT BUTTONS ═══════════════════════════

def _render_export_buttons(inputs: dict, results: dict):
    c1, c2, _ = st.columns([1, 1, 2])
    with c1:
        try:
            from components.financial_export_pdf import generate_pdf
            pdf_bytes = generate_pdf(inputs, results)
            st.download_button(
                "Download PDF Report",
                data=pdf_bytes,
                file_name=f"{inputs['program_name'].replace(' ','_')}_Financial_Report.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
        except Exception as e:
            st.button("Download PDF Report", disabled=True, use_container_width=True,
                      help=f"PDF generation error: {e}")

    with c2:
        try:
            from components.financial_export_excel import generate_excel
            xl_bytes = generate_excel(inputs, results)
            st.download_button(
                "Download Excel Workbook",
                data=xl_bytes,
                file_name=f"{inputs['program_name'].replace(' ','_')}_Financial_Model.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
        except Exception as e:
            st.button("Download Excel Workbook", disabled=True, use_container_width=True,
                      help=f"Excel generation error: {e}")


# ═══════════════════════════ MAIN RENDER ══════════════════════════════

def render(data: dict):
    """Entry-point called by app.py."""
    st.markdown("## Program Financial Estimation")
    st.caption("Model the financial viability of a new graduate programme over a multi-year horizon.")

    # Inputs
    inputs = _render_inputs()

    # Compute
    results = compute_scenario(inputs)

    # Export buttons
    _render_export_buttons(inputs, results)

    st.markdown("---")

    # Results
    _render_results(inputs, results)

    # Scenario management
    _render_scenario_controls(inputs, results)
