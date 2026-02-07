"""
PDF report export for the Program Financial Estimation.

Generates a leadership-quality, multi-page branded PDF aligned with
the Stevens CPE Brand Guidelines (Oct 2025).

Uses fpdf2 for PDF layout and kaleido/plotly for chart images.
"""

from __future__ import annotations
import io, os, tempfile
from pathlib import Path
from typing import Any

from fpdf import FPDF
import plotly.graph_objects as go
import plotly.io as pio

# ── Brand colours (RGB tuples) ─────────────────────────────────────────
_RED   = (163, 38, 56)     # #A32638
_DGRAY = (54, 61, 69)      # #363D45
_GRAY  = (127, 127, 127)   # #7F7F7F
_LGRAY = (228, 229, 230)   # #E4E5E6
_WHITE = (255, 255, 255)
_BLACK = (0, 0, 0)
_GREEN = (46, 125, 50)     # #2E7D32

_RED_HEX   = "#A32638"
_DGRAY_HEX = "#363D45"
_GRAY_HEX  = "#7F7F7F"


# ── Helpers ────────────────────────────────────────────────────────────

def _fmt(v: float) -> str:
    if v < 0:
        return f"(${abs(v):,.0f})"
    return f"${v:,.0f}"


def _chart_to_png(fig: go.Figure, width: int = 700, height: int = 380) -> bytes:
    """Render a Plotly figure to PNG bytes."""
    fig.update_layout(
        paper_bgcolor="white",
        plot_bgcolor="white",
        font_color="#363D45",
        font_family="Arial, sans-serif",
        margin=dict(l=50, r=30, t=50, b=50),
    )
    return pio.to_image(fig, format="png", width=width, height=height, scale=2)


def _logo_path() -> str | None:
    """Attempt to find the CPE linear logo SVG and convert to PNG."""
    base = Path(__file__).resolve().parent.parent
    svg = base / "CPE-assets(logos)" / "CPE Canva" / "Stevens-CPE-logo-RGB_Linear-4C.svg"
    if not svg.exists():
        return None
    try:
        import cairosvg
        png = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        cairosvg.svg2png(url=str(svg), write_to=png.name, output_width=600)
        return png.name
    except Exception:
        return None


# ── Custom PDF class ──────────────────────────────────────────────────

class _Report(FPDF):
    """Custom FPDF subclass with Stevens CPE branding."""

    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="Letter")
        self.set_auto_page_break(auto=True, margin=20)
        # Register IBM Plex Sans if available, otherwise use Helvetica
        self._brand_font = "Helvetica"
        try:
            font_dir = Path(__file__).resolve().parent.parent / "fonts"
            if (font_dir / "IBMPlexSans-Regular.ttf").exists():
                self.add_font("IBMPlex", "", str(font_dir / "IBMPlexSans-Regular.ttf"), uni=True)
                self.add_font("IBMPlex", "B", str(font_dir / "IBMPlexSans-Bold.ttf"), uni=True)
                self._brand_font = "IBMPlex"
        except Exception:
            pass

    # ── Page furniture ─────────────────────────────────────────────
    def header(self):
        if self.page_no() == 1:
            return  # Cover page has its own header
        # Thin red accent bar
        self.set_fill_color(*_RED)
        self.rect(10, 8, self.w - 20, 1.5, "F")
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font(self._brand_font, "", 8)
        self.set_text_color(*_GRAY)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="R")

    # ── Branded helpers ────────────────────────────────────────────
    def section_title(self, text: str):
        self.set_font(self._brand_font, "B", 14)
        self.set_text_color(*_DGRAY)
        self.cell(0, 10, text, new_x="LMARGIN", new_y="NEXT")
        # Red underline
        self.set_draw_color(*_RED)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), self.w - 10, self.get_y())
        self.ln(4)

    def body_text(self, text: str, size: int = 10):
        self.set_font(self._brand_font, "", size)
        self.set_text_color(*_DGRAY)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def kpi_box(self, x: float, y: float, w: float, h: float,
                label: str, value: str, colour: tuple = _RED):
        self.set_xy(x, y)
        self.set_draw_color(*colour)
        self.set_line_width(0.8)
        self.rect(x, y, w, h, "D")
        # Left accent bar
        self.set_fill_color(*colour)
        self.rect(x, y, 2, h, "F")
        # Label
        self.set_xy(x + 5, y + 3)
        self.set_font(self._brand_font, "", 8)
        self.set_text_color(*_GRAY)
        self.cell(w - 10, 4, label.upper())
        # Value
        self.set_xy(x + 5, y + 9)
        self.set_font(self._brand_font, "B", 16)
        self.set_text_color(*_DGRAY)
        self.cell(w - 10, 8, value)

    def branded_table(self, headers: list[str], rows: list[list[str]],
                      col_widths: list[float] | None = None,
                      col_aligns: list[str] | None = None):
        if col_widths is None:
            avail = self.w - 20
            col_widths = [avail / len(headers)] * len(headers)
        if col_aligns is None:
            col_aligns = ["L"] + ["R"] * (len(headers) - 1)

        # Header
        self.set_font(self._brand_font, "B", 9)
        self.set_fill_color(*_RED)
        self.set_text_color(*_WHITE)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 7, h, border=0, align="C", fill=True)
        self.ln()

        # Data rows
        self.set_font(self._brand_font, "", 9)
        for r_idx, row in enumerate(rows):
            is_alt = r_idx % 2 == 1
            is_last = r_idx == len(rows) - 1
            if is_alt:
                self.set_fill_color(*_LGRAY)
            else:
                self.set_fill_color(*_WHITE)

            if is_last:
                self.set_font(self._brand_font, "B", 9)

            self.set_text_color(*_DGRAY)
            for i, val in enumerate(row):
                # Colour negative values red
                if isinstance(val, str) and val.startswith("("):
                    self.set_text_color(*_RED)
                self.cell(col_widths[i], 6, str(val), border=0,
                          align=col_aligns[i], fill=True)
                self.set_text_color(*_DGRAY)
            self.ln()

            if is_last:
                self.set_font(self._brand_font, "", 9)

    def add_chart_image(self, fig: go.Figure, w: float = 180, h: float = 95):
        """Render a Plotly figure and embed it."""
        png_bytes = _chart_to_png(fig, width=int(w * 4), height=int(h * 4))
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(png_bytes)
            tmp.flush()
            self.image(tmp.name, x=self.get_x(), y=self.get_y(), w=w)
            self.ln(h + 5)
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# ═══════════════════════════ PAGE BUILDERS ════════════════════════════

def _page_cover(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()

    # Red accent bar at top
    pdf.set_fill_color(*_RED)
    pdf.rect(0, 0, pdf.w, 12, "F")

    # Logo
    logo = _logo_path()
    if logo:
        try:
            pdf.image(logo, x=15, y=20, w=80)
        except Exception:
            pass
        try:
            os.unlink(logo)
        except OSError:
            pass

    # Title
    pdf.set_xy(15, 60)
    pdf.set_font(pdf._brand_font, "B", 28)
    pdf.set_text_color(*_BLACK)
    pdf.cell(0, 14, inputs["program_name"])
    pdf.ln(16)
    pdf.set_font(pdf._brand_font, "", 16)
    pdf.set_text_color(*_DGRAY)
    pdf.cell(0, 10, "Program Financial Estimation Report")
    pdf.ln(14)

    # Key info
    start = inputs.get("start_fy", 2026)
    info_lines = [
        f"{inputs['projection_years']}-Year Outlook: FY{start} - FY{start + inputs['projection_years'] - 1}",
        f"Delivery Format: {inputs['delivery_format']} courses",
        f"Total Courses: {inputs['total_courses']}  |  Credits/Course: {inputs['credits_per_course']}  |  Tuition/Credit: ${inputs['tuition_per_credit']:,}",
        f"Initial Cohort: {inputs['initial_intake']} students",
    ]
    pdf.set_font(pdf._brand_font, "", 11)
    pdf.set_text_color(*_DGRAY)
    for line in info_lines:
        pdf.cell(0, 7, line, new_x="LMARGIN", new_y="NEXT")

    # Thin asterism-style decorative line (CPE brand gesture)
    pdf.set_draw_color(*_LGRAY)
    pdf.set_line_width(0.3)
    pdf.line(15, 130, pdf.w - 15, 130)
    pdf.line(15, 130, 80, 170)  # 25-degree-ish angle

    # Footer
    pdf.set_xy(15, pdf.h - 30)
    pdf.set_font(pdf._brand_font, "", 9)
    pdf.set_text_color(*_GRAY)
    from datetime import datetime
    pdf.cell(0, 5, f"Generated: {datetime.now().strftime('%B %d, %Y')}")
    pdf.ln(5)
    pdf.cell(0, 5, "Stevens Institute of Technology - College of Professional Education")


def _page_executive_summary(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()
    pdf.section_title("Executive Summary")

    # KPI boxes
    box_w = 42
    box_h = 22
    y = pdf.get_y() + 2
    kpis = [
        ("Total Revenue", _fmt(results["total_revenue"]), _RED),
        ("Total Cost",    _fmt(results["total_cost"]),    _DGRAY),
        ("Net P&L",       _fmt(results["total_net"]),     _GREEN if results["total_net"] >= 0 else _RED),
        ("Break-Even",    results["break_even_year"] or "N/A", _GREEN),
    ]
    for i, (lbl, val, colour) in enumerate(kpis):
        pdf.kpi_box(12 + i * (box_w + 4), y, box_w, box_h, lbl, val, colour)

    pdf.set_y(y + box_h + 8)

    # Narrative
    be = results["break_even_year"] or "the projection horizon"
    margin = results["total_margin"]
    narrative = (
        f"The programme is projected to generate {_fmt(results['total_revenue'])} in total revenue "
        f"against {_fmt(results['total_cost'])} in costs over {inputs['projection_years']} years, "
        f"yielding a net of {_fmt(results['total_net'])} ({margin:.1f}% margin). "
        f"Break-even is reached in {be}."
    )
    pdf.body_text(narrative)


def _page_pl_summary(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()
    pdf.section_title("Profit & Loss Summary")

    pl = results["pl_summary"]
    headers = ["Fiscal Year", "Revenue", "Cost", "Net", "Cumulative", "Margin %"]
    rows = []
    for _, r in pl.iterrows():
        rows.append([
            str(r["Fiscal Year"]),
            _fmt(r["Revenue"]),
            _fmt(r["Cost"]),
            _fmt(r["Net"]),
            _fmt(r["Cumulative"]),
            f"{r['Net Margin %']:.1f}%",
        ])
    widths = [28, 32, 32, 32, 32, 24]
    pdf.branded_table(headers, rows, col_widths=widths)
    pdf.ln(6)

    # Revenue vs Cost chart
    fy = pl[pl["Fiscal Year"] != "Total"]
    fig = go.Figure()
    fig.add_trace(go.Bar(x=fy["Fiscal Year"], y=fy["Revenue"], name="Revenue",
                         marker_color=_RED_HEX))
    fig.add_trace(go.Bar(x=fy["Fiscal Year"], y=fy["Cost"], name="Cost",
                         marker_color=_DGRAY_HEX))
    fig.update_layout(barmode="group", title="Revenue vs Cost by Fiscal Year",
                      legend=dict(orientation="h", y=-0.15))
    fig.update_yaxes(tickprefix="$", tickformat=",")
    pdf.add_chart_image(fig)


def _page_trajectory(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()
    pdf.section_title("Financial Trajectory")

    pl = results["pl_summary"]
    fy = pl[pl["Fiscal Year"] != "Total"]

    # Cumulative chart
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=fy["Fiscal Year"], y=fy["Cumulative"],
                             mode="lines+markers", name="Cumulative Net",
                             line=dict(color=_RED_HEX, width=3)))
    fig.add_hline(y=0, line_dash="dash", line_color=_GRAY_HEX, annotation_text="Break-Even")
    fig.update_layout(title="Cumulative Net P&L")
    fig.update_yaxes(tickprefix="$", tickformat=",")
    pdf.add_chart_image(fig)

    # Net Margin chart
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=fy["Fiscal Year"], y=fy["Net Margin %"],
                             mode="lines+markers", fill="tozeroy",
                             line=dict(color=_RED_HEX, width=2),
                             fillcolor="rgba(163,38,56,0.15)"))
    fig.update_layout(title="Net Margin % Trend")
    fig.update_yaxes(ticksuffix="%")
    pdf.add_chart_image(fig)


def _page_cohort(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()
    pdf.section_title("Cohort Enrollment")

    labels = results["term_labels"]
    active = results["total_active"]

    # Condensed cohort summary table
    headers = ["Term", "New Students", "Total Active"]
    rows = []
    for i, lbl in enumerate(labels):
        rows.append([
            lbl,
            f"{results['new_students'][i]:.0f}",
            f"{active[i]:.0f}",
        ])
    widths = [35, 35, 35]
    pdf.branded_table(headers, rows, col_widths=widths)
    pdf.ln(4)

    # Area chart
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=labels, y=active.tolist(),
                             fill="tozeroy", mode="lines",
                             line=dict(color=_RED_HEX, width=2),
                             fillcolor="rgba(163,38,56,0.2)"))
    fig.update_layout(title="Total Active Students per Term")
    pdf.add_chart_image(fig)


def _page_costs(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()
    pdf.section_title("Cost Breakdown")

    cost = results["cost_df"]
    labels = results["term_labels"]

    # Summary table (condensed)
    headers = ["Term", "Faculty", "TA", "Dev", "OH", "CAC", "Total"]
    rows = []
    for _, r in cost.iterrows():
        rows.append([
            str(r["Term"]),
            _fmt(r["Faculty"]),
            _fmt(r["TA"]),
            _fmt(r["Course Dev"]),
            _fmt(r["Variable OH"] + r["Fixed OH"]),
            _fmt(r["CAC"]),
            _fmt(r["Total Cost"]),
        ])
    widths = [24, 22, 22, 22, 24, 22, 26]
    pdf.branded_table(headers, rows, col_widths=widths)
    pdf.ln(4)

    # Stacked bar chart
    cost_cols = ["Faculty", "TA", "Course Dev", "Variable OH", "Fixed OH", "CAC"]
    colours = [_RED_HEX, _DGRAY_HEX, _GRAY_HEX, "#E4E5E6", "#5A6577", "#2E7D32"]
    fig = go.Figure()
    for i, col in enumerate(cost_cols):
        fig.add_trace(go.Bar(x=labels, y=cost[col], name=col,
                             marker_color=colours[i]))
    fig.update_layout(barmode="stack", title="Cost Components by Term",
                      legend=dict(orientation="h", y=-0.2))
    fig.update_yaxes(tickprefix="$", tickformat=",")

    if pdf.get_y() + 100 > pdf.h - 20:
        pdf.add_page()
        pdf.section_title("Cost Breakdown (cont.)")

    pdf.add_chart_image(fig, w=185, h=90)


def _page_assumptions(pdf: _Report, inputs: dict, results: dict):
    pdf.add_page()
    pdf.section_title("Assumptions & Inputs")

    sections = [
        ("Program Structure", [
            ("Total Courses",       str(inputs["total_courses"])),
            ("Credits/Course",      str(inputs["credits_per_course"])),
            ("Delivery Format",     inputs["delivery_format"]),
            ("Include Summer",      "Yes" if inputs.get("include_summer") else "No"),
            ("Projection Years",    str(inputs["projection_years"])),
        ]),
        ("Enrollment", [
            ("Initial Intake",      str(inputs["initial_intake"])),
            ("Fall Growth",         f"{inputs['fall_growth_rate']*100:.0f}%"),
            ("Spring Growth",       f"{inputs['spring_growth_rate']*100:.0f}%"),
            ("Summer Growth",       f"{inputs.get('summer_growth_rate', 0)*100:.0f}%"),
            ("Early Retention",     f"{inputs['early_retention_rate']*100:.0f}%"),
            ("Late Retention",      f"{inputs['late_retention_rate']*100:.0f}%"),
        ]),
        ("Revenue", [
            ("Tuition/Credit",      f"${inputs['tuition_per_credit']:,}"),
            ("Credits/Term",        str(inputs["credits_per_term"])),
            ("Tuition Inflation",   f"{inputs['tuition_inflation_pct']*100:.1f}%"),
        ]),
        ("Costs", [
            ("Faculty/Section",     f"${inputs['faculty_cost_per_section']:,}"),
            ("Sections/Term",       str(inputs["sections_per_term"])),
            ("TA:Student Ratio",    f"1:{inputs['ta_student_ratio']}"),
            ("TA Hourly Rate",      f"${inputs['ta_hourly_rate']:,}"),
            ("Variable OH/Student", f"${inputs['variable_overhead_per_student']:,}"),
            ("Fixed OH/Term",       f"${inputs['fixed_overhead_per_term']:,}"),
            ("CAC/Student",         f"${inputs['cac_per_student']:,}"),
            ("Cost Inflation",      f"{inputs['cost_inflation_pct']*100:.0f}%"),
        ]),
        ("Course Development", [
            ("New Courses",         str(inputs["courses_to_develop"])),
            ("Dev Cost/Course",     f"${inputs['dev_cost_per_course']:,}"),
            ("Courses to Revise",   str(inputs["courses_to_revise"])),
            ("Revision %",          f"{inputs['revision_cost_pct']*100:.0f}%"),
            ("Amort. Terms",        str(inputs["dev_amortization_terms"])),
        ]),
    ]

    for section_name, params in sections:
        pdf.set_font(pdf._brand_font, "B", 10)
        pdf.set_text_color(*_DGRAY)
        pdf.set_fill_color(*_LGRAY)
        pdf.cell(0, 6, section_name, fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(pdf._brand_font, "", 9)
        for label, value in params:
            pdf.set_text_color(*_GRAY)
            pdf.cell(55, 5, f"  {label}")
            pdf.set_text_color(*_DGRAY)
            pdf.cell(0, 5, value, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    # Footer
    pdf.ln(6)
    pdf.set_font(pdf._brand_font, "", 8)
    pdf.set_text_color(*_GRAY)
    pdf.cell(0, 5, "Generated by CPE Analytics Dashboard - Stevens Institute of Technology",
             align="C")


# ═══════════════════════════ PUBLIC API ════════════════════════════════

def generate_pdf(inputs: dict, results: dict) -> bytes:
    """Build the full branded PDF report and return its bytes."""
    pdf = _Report()
    pdf.alias_nb_pages()

    _page_cover(pdf, inputs, results)
    _page_executive_summary(pdf, inputs, results)
    _page_pl_summary(pdf, inputs, results)
    _page_trajectory(pdf, inputs, results)
    _page_cohort(pdf, inputs, results)
    _page_costs(pdf, inputs, results)
    _page_assumptions(pdf, inputs, results)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return buf.getvalue()
