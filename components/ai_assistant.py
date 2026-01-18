"""
AI Naveen - Premium AI Business Intelligence Assistant
Combines premium UI with robust chat features including summarization and fallbacks.
"""

from typing import Dict, List, Optional
import time
import random
import streamlit as st
import google.genai as genai

from analytics import calculate_summary_stats, calculate_program_stats, get_funnel_by_category
from utils.formatting import format_number, format_percent, format_currency
from utils.constants import STEVENS_RED, CHART_SUCCESS, BACKGROUND_CARD, STEVENS_WHITE, STEVENS_GRAY_LIGHT
from components.ai_insights import (
    InsightCard, analyze_data_for_insights, get_cached_insights,
    get_data_hash, get_suggestion_chips, get_time_greeting
)


GEMINI_MODEL = "gemini-3-flash-preview"


# Premium CSS Styles - Applied to Streamlit's native containers
PREMIUM_CSS = """
<style>
/* -------- Design tokens -------- */
:root {
    --ai-radius-sm: 10px;
    --ai-radius-md: 12px;
    --ai-radius-lg: 16px;
    --ai-gap-xs: 8px;
    --ai-gap-sm: 12px;
    --ai-gap-md: 16px;
    --ai-gap-lg: 24px;
    --ai-border-subtle: rgba(255, 255, 255, 0.10);
    --ai-border-accent: rgba(164, 16, 52, 0.35);
    --ai-surface-0: rgba(14, 17, 23, 0.92);
    --ai-surface-1: rgba(26, 31, 46, 0.92);
    --ai-surface-2: rgba(255, 255, 255, 0.04);
    --ai-text: rgba(255, 255, 255, 0.92);
    --ai-text-muted: rgba(255, 255, 255, 0.72);
    --ai-text-faint: rgba(255, 255, 255, 0.55);
    --ai-shadow: 0 10px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* -------- Glass effect on main content area -------- */
.main .block-container {
    background: linear-gradient(135deg, rgba(26, 31, 46, 0.92) 0%, rgba(14, 17, 23, 0.96) 100%);
    border: 1px solid var(--ai-border-accent);
    border-radius: var(--ai-radius-lg);
    padding: 24px !important;
    box-shadow: var(--ai-shadow);
    backdrop-filter: blur(10px);
    max-width: 1200px;
    margin: 0 auto;
}

@media (max-width: 768px) {
    .main .block-container {
        padding: 16px !important;
        border-radius: 14px;
        margin: 0 8px;
    }
}

/* Header section - STICKY */
.ai-header-wrapper {
    position: sticky;
    top: 0;
    z-index: 100;
    background: linear-gradient(135deg, rgba(26, 31, 46, 0.98) 0%, rgba(14, 17, 23, 0.98) 100%);
    margin: -24px -24px 16px -24px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--ai-border-subtle);
    backdrop-filter: blur(12px);
}

.ai-header {
    background: linear-gradient(90deg, rgba(164, 16, 52, 0.15) 0%, rgba(164, 16, 52, 0.02) 70%, transparent 100%);
    padding: 14px 18px;
    border: 1px solid var(--ai-border-subtle);
    border-radius: var(--ai-radius-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ai-gap-md);
}

.ai-header-left {
    display: flex;
    align-items: center;
    gap: var(--ai-gap-sm);
    min-width: 0;
}

.ai-header-content {
    flex: 1;
    min-width: 0;
}

.ai-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ai-header .greeting {
    font-size: 12px;
    color: var(--ai-text-muted);
    margin-top: 2px;
}

/* New Chat button in header */
.new-chat-btn {
    background: rgba(164, 16, 52, 0.2);
    border: 1px solid rgba(164, 16, 52, 0.4);
    color: #fff;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}
.new-chat-btn:hover {
    background: rgba(164, 16, 52, 0.35);
    border-color: rgba(164, 16, 52, 0.6);
}

/* Suggested questions - pill style */
.suggestion-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
}
.suggestion-pill {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    padding: 8px 14px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
}
.suggestion-pill:hover {
    background: rgba(164, 16, 52, 0.2);
    border-color: rgba(164, 16, 52, 0.4);
    color: #fff;
}

/* Style the New Chat button to match header */
.new-chat-streamlit-btn button {
    background: rgba(164, 16, 52, 0.2) !important;
    border: 1px solid rgba(164, 16, 52, 0.4) !important;
    color: #fff !important;
    padding: 8px 16px !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
}
.new-chat-streamlit-btn button:hover {
    background: rgba(164, 16, 52, 0.35) !important;
    border-color: rgba(164, 16, 52, 0.6) !important;
}

/* Suggestion chips row styling */
.suggestion-row {
    margin-bottom: 8px;
}
.suggestion-row button {
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    color: rgba(255, 255, 255, 0.85) !important;
    border-radius: 20px !important;
    font-size: 12px !important;
    padding: 6px 12px !important;
}
.suggestion-row button:hover {
    background: rgba(164, 16, 52, 0.2) !important;
    border-color: rgba(164, 16, 52, 0.4) !important;
    color: #fff !important;
}

/* Avatar with animation */
.avatar-container {
    position: relative;
    width: 44px;
    height: 44px;
}

.avatar-container img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(164, 16, 52, 0.5);
    object-fit: cover;
}

.avatar-ring {
    position: absolute;
    top: -4px;
    left: -4px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: #A41034;
    animation: none;
}

.avatar-ring.thinking {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Insight cards */
.insight-card {
    background: var(--ai-surface-2);
    border: 1px solid var(--ai-border-subtle);
    border-radius: var(--ai-radius-md);
    padding: 12px;
    border-left: 3px solid;
    cursor: pointer;
    transition: all 0.2s ease;
}

/* Insights header (custom accordion affordance) */
.ai-accordion {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 12px;
    padding: 10px 12px;
}
.ai-accordion-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
}
.ai-accordion-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 650;
    color: rgba(255,255,255,0.92);
}
.ai-accordion-summary {
    font-size: 12px;
    color: rgba(255,255,255,0.70);
    margin-top: 2px;
}
.ai-accordion-chevron {
    font-size: 14px;
    color: rgba(255,255,255,0.75);
}

.insight-card:hover {
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(-2px);
}

/* Section labels */
.section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.75);
    margin-bottom: 8px;
}

/* Empty state */
.empty-state {
    text-align: left;
    padding: 10px 2px 14px 2px;
    color: var(--ai-text-muted);
}

.empty-state .icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

.empty-state p {
    font-size: 14px;
    margin: 0;
    color: var(--ai-text);
}

/* Status badge */
.status-badge {
    display: inline-block;
    font-size: 11px;
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    padding: 2px 8px;
    border-radius: 12px;
    margin-left: 8px;
}

/* Buttons + focus (accessibility) */
button:focus-visible,
[role="button"]:focus-visible,
input:focus-visible,
textarea:focus-visible {
    outline: 3px solid rgba(164, 16, 52, 0.65) !important;
    outline-offset: 2px !important;
    border-radius: 10px;
}

/* Quick-question chips style */
div[data-testid="stButton"] > button {
    min-height: 44px;
}

/* Make buttons/chips feel clickable (hover/active) */
div[data-testid="stButton"] > button {
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    background: rgba(255, 255, 255, 0.04) !important;
    color: rgba(255, 255, 255, 0.92) !important;
    border-radius: 12px !important;
    transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
}
div[data-testid="stButton"] > button:hover {
    background: rgba(164, 16, 52, 0.18) !important;
    border-color: rgba(164, 16, 52, 0.35) !important;
    transform: translateY(-1px);
}
div[data-testid="stButton"] > button:active {
    transform: translateY(0px);
}

@media (max-width: 768px) {
    div[data-testid="stButton"] > button {
        min-height: 48px;
        font-size: 0.95rem;
    }
}

/* Chat input width alignment */
div[data-testid="stChatInput"] {
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
}

/* Composer polish */
div[data-testid="stChatInput"] textarea {
    border-radius: 14px !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    background: rgba(255, 255, 255, 0.03) !important;
}
div[data-testid="stChatInput"] textarea:focus {
    border-color: rgba(164, 16, 52, 0.45) !important;
}
div[data-testid="stChatInput"] button[aria-label="Send message"] {
    border-radius: 12px !important;
}

@media (max-width: 768px) {
    div[data-testid="stChatInput"] {
        max-width: 100%;
    }
    .avatar-ring {
        display: none;
    }
}
</style>
"""


def build_context(data: dict) -> str:
    """Build a comprehensive context string from dashboard data."""
    apps_data = data.get('applications', {})
    census_data = data.get('census', {})

    summary_stats = calculate_summary_stats(
        apps_data.get('current'),
        apps_data.get('previous'),
        apps_data.get('two_years_ago'),
        census_data
    )

    current = summary_stats['overall'][2026]
    previous = summary_stats['overall'][2025]
    breakdown = summary_stats.get('enrollment_breakdown')

    # Program stats (include more detail for richer AI context)
    program_stats = calculate_program_stats(apps_data.get('current'), apps_data.get('previous'))
    top_programs = []
    all_programs = []
    if program_stats is not None and not program_stats.empty:
        top_programs = program_stats.nlargest(10, 'Enrollments 2026')[
            ['Program', 'Enrollments 2026', 'Yield Rate 2026']
        ].to_dict('records')
        # Include a larger list for deeper AI context (cap to avoid huge prompts)
        max_programs = 60
        subset = program_stats.head(max_programs)
        all_programs = subset[
            ['Program', 'Applications 2026', 'Admits 2026', 'Enrollments 2026', 'Admit Rate 2026', 'Yield Rate 2026', 'Apps YoY %']
        ].to_dict('records')

    # Funnel by category (Slate)
    funnel_by_category = []
    if apps_data.get('current') is not None and not apps_data.get('current').empty:
        funnel_by_category_df = get_funnel_by_category(apps_data.get('current'))
        if funnel_by_category_df is not None and not funnel_by_category_df.empty:
            funnel_by_category = funnel_by_category_df.sort_values(
                'Enrollments', ascending=False
            ).head(10).to_dict('records')

    # By school / by degree / by category breakdown
    by_school = summary_stats.get('by_school', {})
    by_degree = summary_stats.get('by_degree', {})
    by_category = summary_stats.get('by_category', {})

    # Corporate cohorts from census
    cohort_top = []
    census_df = census_data.get('raw_df')
    if census_df is not None and not census_df.empty and 'Census_1_CORPORATE_COHORT' in census_df.columns:
        cohort_df = census_df[
            census_df['Census_1_CORPORATE_COHORT'].notna() & (census_df['Census_1_CORPORATE_COHORT'] != '')
        ].copy()
        if not cohort_df.empty:
            cohort_summary = (
                cohort_df.groupby('Census_1_CORPORATE_COHORT')
                .agg(Enrollments=('Census_1_STUDENT_ID', 'nunique'))
                .reset_index()
                .sort_values('Enrollments', ascending=False)
                .head(5)
            )
            cohort_top = cohort_summary.to_dict('records')

    # Census category counts (for broader context)
    census_by_category = {}
    if census_df is not None and not census_df.empty:
        if 'Student_Category' in census_df.columns:
            census_by_category = census_df['Student_Category'].value_counts().to_dict()

    # NTR summary + breakdown (from census)
    ntr_summary = data.get('ntr_summary')
    ntr_text = "NTR data not available."
    if ntr_summary:
        ntr_text = (
            f"Total NTR: {format_currency(ntr_summary.total_ntr)}; "
            f"NTR Goal: {format_currency(ntr_summary.ntr_goal)}; "
            f"Progress: {format_percent(ntr_summary.percentage_of_goal)}; "
            f"New NTR: {format_currency(ntr_summary.new_ntr)}; "
            f"Current NTR: {format_currency(ntr_summary.current_ntr)}."
        )
    ntr_breakdown_text = ""
    if census_df is not None and not census_df.empty:
        try:
            from ntr_calculator import calculate_ntr_from_census
            _, _, breakdown_df = calculate_ntr_from_census(census_df)
            if breakdown_df is not None and not breakdown_df.empty:
                lines = []
                for _, row in breakdown_df.iterrows():
                    if row.get('Category') == 'Grand Total':
                        continue
                    lines.append(
                        f"- {row.get('Category')} / {row.get('Degree Type')}: "
                        f"Students {row.get('Total Students')}, Credits {row.get('Total Credits')}, "
                        f"NTR {format_currency(row.get('Total NTR'))}"
                    )
                if lines:
                    ntr_breakdown_text = "NTR by Category/Degree:\n" + "\n".join(lines)
        except Exception:
            ntr_breakdown_text = ""

    enrollment_text = "Enrollment breakdown not available."
    if breakdown:
        enrollment_text = (
            f"Enrollment Breakdown - New (Slate): {format_number(breakdown.slate_new)}, "
            f"Continuing (Census): {format_number(breakdown.continuing)}, "
            f"Returning (Census): {format_number(breakdown.returning)}, "
            f"Total: {format_number(breakdown.total)}."
        )

    context = [
        "CPE Graduate Online Dashboard Context (Spring 2026):",
        "Data limits: There is no program-level NTR or cohort-level NTR in this context.",
        "Do not infer or fabricate dollar amounts by program or cohort.",
        f"Applications: {format_number(current.applications)}",
        f"Admits: {format_number(current.admits)}",
        f"Offers Accepted: {format_number(current.offers_accepted)}",
        f"Enrollments (Slate New): {format_number(current.enrollments)}",
        f"Yield Rate: {format_percent(current.yield_rate)}",
        f"YoY Apps Change: {format_percent(summary_stats['yoy']['2026_vs_2025'].apps_change)}",
        f"YoY Admits Change: {format_percent(summary_stats['yoy']['2026_vs_2025'].admits_change)}",
        f"YoY Enrollments Change: {format_percent(summary_stats['yoy']['2026_vs_2025'].enrollments_change)}",
        enrollment_text,
        ntr_text,
    ]
    if ntr_breakdown_text:
        context.append(ntr_breakdown_text)

    if by_school:
        context.append("By School (Funnel Metrics, 2026):")
        for school, metrics in by_school.items():
            m = metrics.get(2026)
            if m:
                context.append(
                    f"- {school}: Apps {m.applications}, Admits {m.admits}, Enrolls {m.enrollments}, "
                    f"Yield {m.yield_rate:.0f}%"
                )

    if by_degree:
        context.append("By Degree Type (Funnel Metrics, 2026):")
        for degree, metrics in by_degree.items():
            m = metrics.get(2026)
            if m:
                context.append(
                    f"- {degree}: Apps {m.applications}, Admits {m.admits}, Enrolls {m.enrollments}, "
                    f"Yield {m.yield_rate:.0f}%"
                )

    if by_category:
        context.append("By Application Category (Funnel Metrics, 2026):")
        for category, metrics in by_category.items():
            m = metrics.get(2026)
            if m and category:
                context.append(
                    f"- {category}: Apps {m.applications}, Admits {m.admits}, Enrolls {m.enrollments}, "
                    f"Yield {m.yield_rate:.0f}%"
                )

    if census_by_category:
        context.append("Census Student Category Counts (2026):")
        for category, count in census_by_category.items():
            context.append(f"- {category}: {count}")

    if funnel_by_category:
        context.append("Funnel by Category (Slate, top 10 by enrollments):")
        for item in funnel_by_category:
            context.append(
                f"- {item['Category']}: Apps {item['Applications']}, Admits {item['Admits']}, "
                f"Enrolls {item['Enrollments']}, Yield {item['Yield Rate']:.0f}%"
            )

    if top_programs:
        context.append("Top Programs by Enrollments (2026):")
        for item in top_programs:
            context.append(
                f"- {item['Program']}: {item['Enrollments 2026']} enrollments, "
                f"Yield {item['Yield Rate 2026']:.0f}%"
            )

    if all_programs:
        context.append("Program Stats (2026, capped list):")
        for item in all_programs:
            context.append(
                f"- {item['Program']}: Apps {item['Applications 2026']}, "
                f"Admits {item['Admits 2026']}, Enrolls {item['Enrollments 2026']}, "
                f"Admit {item['Admit Rate 2026']:.0f}%, Yield {item['Yield Rate 2026']:.0f}%, "
                f"Apps YoY {item['Apps YoY %']:.0f}%"
            )

    if cohort_top:
        context.append("Top Corporate Cohorts (Census):")
        for item in cohort_top:
            context.append(f"- {item['Census_1_CORPORATE_COHORT']}: {item['Enrollments']} enrollments")

    return "\n".join(context)


def query_gemini(question: str, context: str, api_key: str) -> str:
    """Send question to Gemini API with context. Retries on 429."""
    prompt = (
        "You are Naveen, the AI and BI Engineering Manager for Stevens CPE. "
        "Tone: fun but realistic, avoid hype, and keep a grounded, practical voice. "
        "Use only the provided context. "
        "Do not infer or fabricate numbers or dollar amounts not present. "
        "If a breakdown is missing, say so and explain what data is needed. "
        "Provide concise, actionable recommendations grounded in the context. "
        "Format using clean Markdown with short sections and '-' bullets only. "
        "Use **bold** only for short labels; avoid italics. "
        "Keep paragraphs short and avoid long run-on lines.\n\n"
        f"Context:\n{context}\n\nQuestion: {question}"
    )

    client = genai.Client(api_key=api_key)
    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            if not response or not response.text:
                raise RuntimeError("Empty response from AI service.")
            return response.text
        except Exception as e:
            last_error = e
            if "429" in str(e) or "Too Many Requests" in str(e):
                time.sleep(1 + attempt)
                continue
            raise

    if last_error is not None:
        raise last_error
    raise RuntimeError("AI service unavailable.")


def summarize_chat(history: List[Dict], api_key: str) -> str:
    """Summarize the chat history for context compression."""
    if not history:
        return ""
    # Keep last 12 messages to summarize
    recent = history[-12:]
    transcript = "\n".join([f"{m['role']}: {m['content']}" for m in recent])
    prompt = (
        "Summarize this conversation in 4-6 short bullet points. "
        "Focus on user intent, key facts, and decisions. "
        "No fluff, no new facts.\n\n"
        f"Transcript:\n{transcript}"
    )
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        return (response.text or "").strip()
    except Exception:
        return ""


def fallback_response(prompt: str, data: dict) -> str:
    """Provide a local response for common questions when API is rate-limited."""
    prompt_lower = prompt.lower()
    apps_data = data.get('applications', {})
    program_stats = calculate_program_stats(apps_data.get('current'), apps_data.get('previous'))
    if program_stats is None or program_stats.empty:
        return "I couldn't access program stats locally. Please try again shortly."

    if "top" in prompt_lower and "program" in prompt_lower:
        top_programs = program_stats.nlargest(5, 'Enrollments 2026')
        lines = ["**Top programs by enrollments** (local data):"]
        for _, row in top_programs.iterrows():
            lines.append(
                f"- {row['Program']}: {int(row['Enrollments 2026'])} enrollments, "
                f"Yield {row['Yield Rate 2026']:.0f}%"
            )
        return "\n".join(lines)
    
    if "yield" in prompt_lower:
        by_yield = program_stats.nlargest(5, 'Yield Rate 2026')
        lines = ["**Top programs by yield** (local data):"]
        for _, row in by_yield.iterrows():
            lines.append(
                f"- {row['Program']}: {row['Yield Rate 2026']:.0f}% yield, "
                f"{int(row['Enrollments 2026'])} enrollments"
            )
        return "\n".join(lines)

    return "The AI service is rate-limited right now. Please try again in a moment."


def clean_markdown(text: str) -> str:
    """Clean up markdown artifacts: remove single '*' but keep '**bold**'."""
    result = []
    i = 0
    while i < len(text):
        if text[i] == "*":
            # Keep double-asterisks
            if i + 1 < len(text) and text[i + 1] == "*":
                result.append("**")
                i += 2
                continue
            # Drop single asterisk
            i += 1
            continue
        result.append(text[i])
        i += 1
    return "".join(result)


def get_avatar_base64() -> str:
    """Load avatar image and convert to base64 for inline display."""
    import base64
    from pathlib import Path
    import os
    
    # Get the dashboard root directory
    dashboard_root = Path(__file__).parent.parent.resolve()
    
    # Try multiple paths relative to dashboard root
    possible_paths = [
        dashboard_root / "naveen-headshot.png",
        dashboard_root / ".streamlit" / "static" / "naveen-headshot.png",
    ]
    
    for img_path in possible_paths:
        if img_path.exists():
            try:
                with open(img_path, "rb") as f:
                    return base64.b64encode(f.read()).decode()
            except Exception:
                continue
    
    return ""


def _get_summary_stats_for_ui(data: dict) -> Optional[dict]:
    """Compute summary stats for AI Naveen UI. Returns None if data missing."""
    apps_data = data.get("applications", {})
    census_data = data.get("census", {})
    current_df = apps_data.get("current")
    prev_df = apps_data.get("previous")
    two_df = apps_data.get("two_years_ago")
    if current_df is None or getattr(current_df, "empty", True):
        return None
    try:
        return calculate_summary_stats(current_df, prev_df, two_df, census_data)
    except Exception:
        return None


def render_kpi_bar(data: dict):
    """Render compact KPI summary bar (NTR | Apps | Admits | Enrolls)."""
    summary_stats = _get_summary_stats_for_ui(data)
    ntr_summary = data.get("ntr_summary")
    if summary_stats is None:
        return

    current = summary_stats["overall"][2026]
    yoy = summary_stats["yoy"]["2026_vs_2025"]

    # KPIs: NTR progress + key funnel counts with YoY deltas
    ntr_progress = ""
    if ntr_summary is not None:
        ntr_progress = f"{ntr_summary.percentage_of_goal:.0f}% of goal"

    kpis = [
        ("NTR", ntr_progress or "—", ""),
        ("Applications", format_number(current.applications), f"{yoy.apps_change:+.0f}% YoY"),
        ("Admits", format_number(current.admits), f"{yoy.admits_change:+.0f}% YoY"),
        ("Enrollments", format_number(current.enrollments), f"{yoy.enrollments_change:+.0f}% YoY"),
    ]

    cols = st.columns(4)
    for i, (label, value, delta) in enumerate(kpis):
        with cols[i]:
            st.markdown(
                f"""
                <div style="
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.10);
                    border-radius: 12px;
                    padding: 12px 12px;
                    height: 86px;
                ">
                    <div style="font-size:10px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.70);">
                        {label}
                    </div>
                    <div style="font-size:20px; font-weight: 700; color: rgba(255,255,255,0.95); margin-top: 6px;">
                        {value}
                    </div>
                    <div style="font-size:11px; color: rgba(255,255,255,0.65); margin-top: 4px;">
                        {delta}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def _get_insights_summary_text(data: dict) -> str:
    """Build concise summary text for the Insights header."""
    summary_stats = _get_summary_stats_for_ui(data)
    if summary_stats is None:
        return "Insights unavailable"
    current = summary_stats["overall"][2026]
    yoy = summary_stats["yoy"]["2026_vs_2025"]
    ntr_summary = data.get("ntr_summary")
    ntr_part = ""
    if ntr_summary is not None:
        ntr_part = f"NTR {ntr_summary.percentage_of_goal:.0f}%"
    return " • ".join(
        [p for p in [ntr_part, f"Yield {current.yield_rate:.0f}%", f"Apps {yoy.apps_change:+.0f}% YoY"] if p]
    )


def render_empty_state(data: dict, suggestion_chips: List[str]):
    """Rich empty state: headline + mini KPIs + example prompts."""
    summary_stats = _get_summary_stats_for_ui(data)
    ntr_summary = data.get("ntr_summary")

    headline = "Ask about your data"
    sub = "Enrollment, yield, NTR, trends — I’ll cite drivers and deltas."

    st.markdown(
        f"""
        <div class="empty-state">
          <div style="font-size: 18px; font-weight: 750; color: rgba(255,255,255,0.95);">{headline}</div>
          <div style="margin-top: 6px; font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.5;">{sub}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if summary_stats is not None:
        current = summary_stats["overall"][2026]
        yoy = summary_stats["yoy"]["2026_vs_2025"]
        ntr_part = "—"
        if ntr_summary is not None:
            ntr_part = f"{ntr_summary.percentage_of_goal:.0f}% of goal"

        cols = st.columns(3)
        mini = [
            ("NTR", ntr_part, ""),
            ("Enrollments", format_number(current.enrollments), f"{yoy.enrollments_change:+.0f}% YoY"),
            ("Yield", f"{current.yield_rate:.0f}%", ""),
        ]
        for i, (label, value, delta) in enumerate(mini):
            with cols[i]:
                st.markdown(
                    f"""
                    <div style="
                        background: rgba(255,255,255,0.04);
                        border: 1px solid rgba(255,255,255,0.10);
                        border-radius: 12px;
                        padding: 12px;
                        height: 84px;
                    ">
                        <div style="font-size:10px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.72);">
                            {label}
                        </div>
                        <div style="font-size:20px; font-weight: 800; color: rgba(255,255,255,0.95); margin-top: 6px;">
                            {value}
                        </div>
                        <div style="font-size:11px; color: rgba(255,255,255,0.65); margin-top: 4px;">
                            {delta}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
    st.markdown('<div class="section-label">Start here</div>', unsafe_allow_html=True)

    # 2x2 prompt grid (reuses chips)
    prompts = suggestion_chips[:4]
    if prompts:
        if len(prompts) >= 2:
            row1 = st.columns(2)
            for i, p in enumerate(prompts[:2]):
                with row1[i]:
                    if st.button(p, key=f"empty_prompt_{i}", width="stretch", type="primary"):
                        st.session_state.pending_chip = p
                        st.rerun()
        if len(prompts) > 2:
            row2 = st.columns(2)
            for j, p in enumerate(prompts[2:4]):
                idx = j + 2
                with row2[j]:
                    if st.button(p, key=f"empty_prompt_{idx}", width="stretch"):
                        st.session_state.pending_chip = p
                        st.rerun()


def render(data: dict):
    """Render the premium AI Naveen chat interface."""
    
    # Inject premium CSS (applies glass effect to the page container)
    st.markdown(PREMIUM_CSS, unsafe_allow_html=True)
    
    avatar_path = "naveen-headshot.png"
    avatar_base64 = get_avatar_base64()
    fun_quotes = [
        "Thinking…",
        "Crunching the numbers…",
        "Running a quick sanity check…",
        "Finding signal in the noise…",
        "Let me be real for a second…",
        "Checking the funnel math…",
        "Crunching numbers so Rob can get more walks…",
        "Keeping the insights calm so Arshad doesn't jump off his chair…",
    ]
    
    # Get API key
    api_key = st.secrets.get("gemini_api_key", "")
    if not api_key:
        st.warning("Gemini API key not configured. Add `gemini_api_key` to secrets.")
        return
    
    # Prepare NTR summary
    if "ntr_summary" not in data:
        census_df = data.get('census', {}).get('raw_df')
        if census_df is not None and not census_df.empty:
            from ntr_calculator import calculate_ntr_from_census
            ntr_summary, _, _ = calculate_ntr_from_census(census_df)
            data['ntr_summary'] = ntr_summary
    
    # Get insights and suggestion chips
    data_hash = get_data_hash(data)
    insights = get_cached_insights(data_hash, data)
    suggestion_chips = get_suggestion_chips(data, insights)
    greeting = get_time_greeting()
    
    # Get key metric for greeting
    ntr_summary = data.get('ntr_summary')
    key_metric = ""
    if ntr_summary:
        key_metric = f"NTR at {ntr_summary.percentage_of_goal:.0f}% of goal"
    
    # Initialize session state
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []
    if "chat_summary" not in st.session_state:
        st.session_state.chat_summary = ""
    if "summary_tick" not in st.session_state:
        st.session_state.summary_tick = 0
    if "pending_chip" not in st.session_state:
        st.session_state.pending_chip = None

    # Avatar source
    if avatar_base64:
        avatar_src = f"data:image/png;base64,{avatar_base64}"
    else:
        avatar_src = "https://ui-avatars.com/api/?name=AI+Naveen&background=A41034&color=fff&size=48"

    # Sticky header with avatar, title, and New Chat button
    header_col1, header_col2 = st.columns([5, 1])
    
    with header_col1:
        st.markdown(
            f"""
            <div class="ai-header-wrapper">
              <div class="ai-header">
                <div class="ai-header-left">
                  <div class="avatar-container">
                    <img src="{avatar_src}" alt="AI Naveen"/>
                    <div class="avatar-ring"></div>
                  </div>
                  <div class="ai-header-content">
                    <h2 style="margin:0; color:#fff; border:none;">AI Naveen</h2>
                    <div class="greeting">Ask about enrollment, yield, NTR, and trends.</div>
                  </div>
                </div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    
    with header_col2:
        st.markdown('<div class="new-chat-streamlit-btn">', unsafe_allow_html=True)
        if st.button("✨ New Chat", key="new_chat_btn"):
            st.session_state.chat_history = []
            st.session_state.chat_summary = ""
            st.session_state.summary_tick = 0
            st.session_state.pending_chip = None
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    
    # Chat messages area
    chat_container = st.container()
    
    with chat_container:
        if not st.session_state.chat_history:
            st.markdown(
                "<div style='color: rgba(255,255,255,0.75); font-size: 13px;'>Type a question below or click a suggestion to start.</div>",
                unsafe_allow_html=True,
            )
        else:
            # Display chat history
            for msg in st.session_state.chat_history:
                avatar = avatar_path if msg["role"] == "assistant" else None
                with st.chat_message(msg["role"], avatar=avatar):
                    st.markdown(msg["content"])
    
    # Handle pending chip click
    if st.session_state.pending_chip:
        prompt = st.session_state.pending_chip
        st.session_state.pending_chip = None
        process_message(prompt, data, api_key, avatar_path, fun_quotes)
    
    # Suggested questions (pill-style, right above chat input)
    if not st.session_state.chat_history:
        st.markdown('<div class="section-label" style="margin-top: 16px;">Quick questions</div>', unsafe_allow_html=True)
        chips = suggestion_chips[:4]
        st.markdown('<div class="suggestion-row">', unsafe_allow_html=True)
        chip_cols = st.columns(len(chips)) if chips else []
        for i, chip in enumerate(chips):
            with chip_cols[i]:
                # Truncate long chips for display
                display_text = chip if len(chip) <= 35 else chip[:32] + "..."
                if st.button(display_text, key=f"chip_{i}", help=chip):
                    st.session_state.pending_chip = chip
                    st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    
    # Chat input
    if prompt := st.chat_input("Ask about enrollment, yield, NTR, or trends..."): 
        process_message(prompt, data, api_key, avatar_path, fun_quotes)


def process_message(prompt: str, data: dict, api_key: str, avatar_path: str, fun_quotes: List[str]):
    """Process a user message and generate AI response with summarization."""
    
    # Rate limiting
    last_call = st.session_state.get("last_ai_call")
    now = time.time()
    if last_call and (now - last_call) < 5:
        st.warning("Please wait a few seconds between questions to avoid rate limits.")
        return
    st.session_state.last_ai_call = now
    
    # Add user message
    st.session_state.chat_history.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # Pick a random fun quote for the spinner
    thinking_quote = random.choice(fun_quotes)
    
    # Create assistant placeholder for typing effect
    with st.chat_message("assistant", avatar=avatar_path):
        placeholder = st.empty()
        with st.spinner(thinking_quote):
            # Periodic chat summarization (every 2 turns when history >= 6)
            if len(st.session_state.chat_history) >= 6 and st.session_state.summary_tick % 2 == 0:
                summary = summarize_chat(st.session_state.chat_history, api_key)
                if summary:
                    st.session_state.chat_summary = summary
            st.session_state.summary_tick += 1

            # Build context with chat summary if available
            context = build_context(data)
            if st.session_state.chat_summary:
                context = (
                    context
                    + "\n\nChat Summary (use this for continuity):\n"
                    + st.session_state.chat_summary
                )
            
            try:
                response = query_gemini(prompt, context, api_key)
            except Exception as e:
                if "429" in str(e) or "Too Many Requests" in str(e):
                    response = fallback_response(prompt, data)
                else:
                    response = f"Error contacting AI service: {e}"

        # Clean markdown
        response = clean_markdown(response)

        # Typing effect
        typed = ""
        for chunk in response.split(" "):
            typed += chunk + " "
            placeholder.markdown(typed.strip())
            time.sleep(0.02)

    st.session_state.chat_history.append({"role": "assistant", "content": response})
    st.rerun()
