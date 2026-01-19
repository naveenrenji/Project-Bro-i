"""
Ask Navs - Premium AI Business Intelligence Assistant
Combines premium UI with robust chat features including summarization and fallbacks.
"""

from typing import Dict, List, Optional
import re
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


# -----------------------------
# Two-stage context selection
# -----------------------------

DATA_CATEGORIES: Dict[str, str] = {
    "summary": "Overall funnel metrics (apps, admits, enrollments, yield) + enrollment breakdown + NTR headline",
    "yoy": "Year-over-year deltas for funnel metrics",
    "programs": "Program-level stats (apps/admits/enrollments/yield by program, top programs)",
    "ntr": "NTR breakdown by category and degree (from census)",
    "cohorts": "Corporate cohort enrollments (from census)",
    "by_school": "Breakdown by school (apps/admits/enrollments/yield)",
    "by_degree": "Breakdown by degree type (apps/admits/enrollments/yield)",
    "by_category": "Breakdown by application category + funnel by category (top categories)",
}

DEFAULT_CATEGORIES: List[str] = ["summary"]


def _normalize_question(q: str) -> str:
    return re.sub(r"\s+", " ", (q or "").strip().lower())


def _safe_int(x, default: int = 0) -> int:
    try:
        return int(x)
    except Exception:
        return default


def _brief_summary_for_planner(data: dict) -> str:
    """Tiny summary (low tokens) so planner knows what's available."""
    apps_data = data.get("applications", {})
    census_data = data.get("census", {})
    current_df = apps_data.get("current")
    prev_df = apps_data.get("previous")
    two_df = apps_data.get("two_years_ago")

    summary_stats = None
    try:
        if current_df is not None and not getattr(current_df, "empty", True):
            summary_stats = calculate_summary_stats(current_df, prev_df, two_df, census_data)
    except Exception:
        summary_stats = None

    ntr_summary = data.get("ntr_summary")
    ntr_part = "NTR: unavailable"
    if ntr_summary is not None:
        try:
            ntr_part = f"NTR: {ntr_summary.percentage_of_goal:.0f}% of goal"
        except Exception:
            ntr_part = "NTR: available"

    program_count = 0
    try:
        ps = calculate_program_stats(current_df, prev_df)
        if ps is not None and not ps.empty:
            program_count = len(ps)
    except Exception:
        program_count = 0

    if not summary_stats:
        return f"{ntr_part}; Programs tracked: {program_count}"

    current = summary_stats["overall"][2026]
    return (
        f"Apps {getattr(current, 'applications', '—')}, "
        f"Admits {getattr(current, 'admits', '—')}, "
        f"Enrolls {getattr(current, 'enrollments', '—')}, "
        f"Yield {getattr(current, 'yield_rate', 0):.0f}%; "
        f"{ntr_part}; Programs tracked: {program_count}"
    )


def query_gemini_light(prompt: str, api_key: str) -> str:
    """Small/cheap call used for planning; keep output short via instructions."""
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return (getattr(response, "text", "") or "").strip()


def plan_data_needs(question: str, data: dict, api_key: str, page_hint: str = "") -> List[str]:
    """Stage 1: pick which data categories are needed for this question."""
    cache = st.session_state.setdefault("planner_cache", {})
    key = _normalize_question(f"{page_hint}::{question}")
    if key in cache:
        return cache[key]

    brief = _brief_summary_for_planner(data)
    categories_list = "\n".join([f"- {k}: {v}" for k, v in DATA_CATEGORIES.items()])
    page_line = f"Current page context: {page_hint}" if page_hint else "Current page context: not specified"
    planner_prompt = f"""
You are a routing assistant for an analytics chatbot.

User question:
{question}

{page_line}

Available dashboard data (brief):
{brief}

Available data categories:
{categories_list}

Return ONLY a comma-separated list of category keys needed to answer well.
Rules:
- Always include summary unless the question is purely about programs.
- Use ONLY keys from the list above.
- Keep the list short (1-4 keys).
Example: summary,programs,yoy
"""

    raw = query_gemini_light(planner_prompt, api_key)
    raw_keys = re.split(r"[,\n]+", raw)
    chosen: List[str] = []
    allowed = set(DATA_CATEGORIES.keys())
    for k in raw_keys:
        kk = _normalize_question(k)
        if kk in allowed and kk not in chosen:
            chosen.append(kk)

    if not chosen:
        chosen = DEFAULT_CATEGORIES.copy()

    cache[key] = chosen
    return chosen


def _build_guardrails_context() -> str:
    return "\n".join(
        [
            "CPE Graduate Online Dashboard Context (Spring 2026).",
            "Data limits: There is no program-level NTR or cohort-level NTR in this context.",
            "Do not infer or fabricate dollar amounts by program or cohort.",
        ]
    )


def _get_summary_stats(data: dict) -> Optional[dict]:
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


def build_summary_context(data: dict, summary_stats: Optional[dict]) -> str:
    if not summary_stats:
        return "Summary: unavailable (applications data missing)."
    current = summary_stats["overall"][2026]
    breakdown = summary_stats.get("enrollment_breakdown")
    ntr_summary = data.get("ntr_summary")

    lines = [
        "Summary:",
        f"- Applications: {format_number(current.applications)}",
        f"- Admits: {format_number(current.admits)}",
        f"- Offers accepted: {format_number(current.offers_accepted)}",
        f"- Enrollments (Slate New): {format_number(current.enrollments)}",
        f"- Yield rate: {format_percent(current.yield_rate)}",
    ]

    if breakdown:
        lines.append(
            "- Enrollment breakdown:"
            f" New (Slate) {format_number(breakdown.slate_new)},"
            f" Continuing (Census) {format_number(breakdown.continuing)},"
            f" Returning (Census) {format_number(breakdown.returning)},"
            f" Total {format_number(breakdown.total)}"
        )

    if ntr_summary is not None:
        try:
            lines.append(f"- NTR progress: {ntr_summary.percentage_of_goal:.0f}% of goal")
        except Exception:
            lines.append("- NTR: available")

    return "\n".join(lines)


def build_yoy_context(summary_stats: Optional[dict]) -> str:
    if not summary_stats:
        return "YoY: unavailable."
    yoy = summary_stats["yoy"]["2026_vs_2025"]
    return "\n".join(
        [
            "YoY (2026 vs 2025):",
            f"- Applications change: {format_percent(yoy.apps_change)}",
            f"- Admits change: {format_percent(yoy.admits_change)}",
            f"- Enrollments change: {format_percent(yoy.enrollments_change)}",
        ]
    )


def build_programs_context(data: dict) -> str:
    apps_data = data.get("applications", {})
    current_df = apps_data.get("current")
    prev_df = apps_data.get("previous")
    program_stats = None
    try:
        program_stats = calculate_program_stats(current_df, prev_df)
    except Exception:
        program_stats = None

    if program_stats is None or getattr(program_stats, "empty", True):
        return "Programs: unavailable."

    # Keep this tight: top 12 by enrollments + top 8 by yield (min enrollments)
    lines = [f"Programs (tracked: {len(program_stats)}):"]
    top_enroll = program_stats.nlargest(12, "Enrollments 2026")[["Program", "Enrollments 2026", "Yield Rate 2026"]]
    lines.append("- Top by enrollments:")
    for _, row in top_enroll.iterrows():
        lines.append(
            f"  - {row['Program']}: {int(row['Enrollments 2026'])} enrollments, Yield {row['Yield Rate 2026']:.0f}%"
        )

    # Filter to avoid tiny-denominator yield noise if column exists
    try:
        filtered = program_stats[program_stats["Enrollments 2026"] >= 5]
    except Exception:
        filtered = program_stats
    top_yield = filtered.nlargest(8, "Yield Rate 2026")[["Program", "Enrollments 2026", "Yield Rate 2026"]]
    lines.append("- Top by yield (min 5 enrollments when available):")
    for _, row in top_yield.iterrows():
        lines.append(
            f"  - {row['Program']}: Yield {row['Yield Rate 2026']:.0f}%, {int(row['Enrollments 2026'])} enrollments"
        )

    return "\n".join(lines)


def build_ntr_context(data: dict) -> str:
    ntr_summary = data.get("ntr_summary")
    census_df = data.get("census", {}).get("raw_df")

    lines = ["NTR:"]
    if ntr_summary is None:
        lines.append("- NTR summary unavailable.")
    else:
        try:
            lines.append(f"- Total NTR: {format_currency(ntr_summary.total_ntr)}")
            lines.append(f"- Goal: {format_currency(ntr_summary.ntr_goal)}")
            lines.append(f"- Progress: {format_percent(ntr_summary.percentage_of_goal)}")
            lines.append(f"- New NTR: {format_currency(ntr_summary.new_ntr)}")
            lines.append(f"- Current NTR: {format_currency(ntr_summary.current_ntr)}")
        except Exception:
            lines.append("- NTR summary available (formatting failed).")

    if census_df is None or getattr(census_df, "empty", True):
        return "\n".join(lines)

    try:
        from ntr_calculator import calculate_ntr_from_census

        _, _, breakdown_df = calculate_ntr_from_census(census_df)
        if breakdown_df is None or breakdown_df.empty:
            return "\n".join(lines)

        # Cap rows to keep context bounded
        rows = []
        for _, row in breakdown_df.iterrows():
            if row.get("Category") == "Grand Total":
                continue
            rows.append(row)
            if len(rows) >= 20:
                break

        lines.append("- NTR by Category/Degree (capped):")
        for row in rows:
            lines.append(
                f"  - {row.get('Category')} / {row.get('Degree Type')}: "
                f"Students {row.get('Total Students')}, Credits {row.get('Total Credits')}, "
                f"NTR {format_currency(row.get('Total NTR'))}"
            )
    except Exception:
        # Silent fail; NTR summary still useful
        pass

    return "\n".join(lines)


def build_cohorts_context(data: dict) -> str:
    census_df = data.get("census", {}).get("raw_df")
    if census_df is None or getattr(census_df, "empty", True):
        return "Corporate cohorts: unavailable."
    if "Census_1_CORPORATE_COHORT" not in census_df.columns:
        return "Corporate cohorts: column not available in census."

    cohort_df = census_df[
        census_df["Census_1_CORPORATE_COHORT"].notna() & (census_df["Census_1_CORPORATE_COHORT"] != "")
    ].copy()
    if cohort_df.empty:
        return "Corporate cohorts: none found."

    summary = (
        cohort_df.groupby("Census_1_CORPORATE_COHORT")
        .agg(Enrollments=("Census_1_STUDENT_ID", "nunique"))
        .reset_index()
        .sort_values("Enrollments", ascending=False)
        .head(10)
    )

    lines = ["Corporate cohorts (top 10 by enrollments):"]
    for _, row in summary.iterrows():
        lines.append(f"- {row['Census_1_CORPORATE_COHORT']}: {int(row['Enrollments'])} enrollments")
    return "\n".join(lines)


def build_breakdowns_context(summary_stats: Optional[dict], key: str, title: str) -> str:
    if not summary_stats:
        return f"{title}: unavailable."
    block = summary_stats.get(key, {})
    if not block:
        return f"{title}: unavailable."

    lines = [f"{title} (2026):"]
    count = 0
    for name, metrics in block.items():
        m = metrics.get(2026) if hasattr(metrics, "get") else None
        if not m:
            continue
        lines.append(
            f"- {name}: Apps {m.applications}, Admits {m.admits}, Enrolls {m.enrollments}, Yield {m.yield_rate:.0f}%"
        )
        count += 1
        if count >= 15:
            break
    return "\n".join(lines)


def build_category_funnel_context(data: dict) -> str:
    apps_data = data.get("applications", {})
    current_df = apps_data.get("current")
    if current_df is None or getattr(current_df, "empty", True):
        return "Funnel by category: unavailable."
    try:
        df = get_funnel_by_category(current_df)
    except Exception:
        df = None
    if df is None or getattr(df, "empty", True):
        return "Funnel by category: unavailable."

    df = df.sort_values("Enrollments", ascending=False).head(12)
    lines = ["Funnel by category (top 12 by enrollments):"]
    for _, row in df.iterrows():
        lines.append(
            f"- {row['Category']}: Apps {int(row['Applications'])}, Admits {int(row['Admits'])}, "
            f"Enrolls {int(row['Enrollments'])}, Yield {row['Yield Rate']:.0f}%"
        )
    return "\n".join(lines)


def build_selective_context(data: dict, categories: List[str], page_hint: str = "") -> str:
    """Stage 2: build context from only selected categories."""
    summary_stats = _get_summary_stats(data)

    parts: List[str] = [_build_guardrails_context()]
    if page_hint:
        parts.append(f"Current page: {page_hint}")
    # Always include a tiny summary to anchor the model
    parts.append(f"Brief: {_brief_summary_for_planner(data)}")

    cat_set = set(categories or [])
    if "summary" in cat_set:
        parts.append(build_summary_context(data, summary_stats))
    if "yoy" in cat_set:
        parts.append(build_yoy_context(summary_stats))
    if "programs" in cat_set:
        parts.append(build_programs_context(data))
    if "ntr" in cat_set:
        parts.append(build_ntr_context(data))
    if "cohorts" in cat_set:
        parts.append(build_cohorts_context(data))
    if "by_school" in cat_set:
        parts.append(build_breakdowns_context(summary_stats, "by_school", "By school"))
    if "by_degree" in cat_set:
        parts.append(build_breakdowns_context(summary_stats, "by_degree", "By degree type"))
    if "by_category" in cat_set:
        parts.append(build_breakdowns_context(summary_stats, "by_category", "By application category"))
        parts.append(build_category_funnel_context(data))

    return "\n\n".join([p for p in parts if p])


def _init_global_chat_state():
    if "navs_widget_open" not in st.session_state:
        st.session_state.navs_widget_open = False
    if "navs_global_history" not in st.session_state:
        st.session_state.navs_global_history = []
    if "navs_global_summary" not in st.session_state:
        st.session_state.navs_global_summary = ""
    if "navs_global_pending" not in st.session_state:
        st.session_state.navs_global_pending = None
    if "navs_global_tick" not in st.session_state:
        st.session_state.navs_global_tick = 0


def render_floating_widget(data: dict, page_hint: str = ""):
    """Floating Ask Navs widget shown on every page."""
    _init_global_chat_state()

    api_key = st.secrets.get("gemini_api_key", "")
    if not api_key:
        return

    avatar_base64 = get_avatar_base64()
    if avatar_base64:
        avatar_src = f"data:image/png;base64,{avatar_base64}"
    else:
        avatar_src = "https://ui-avatars.com/api/?name=AI+Naveen&background=A41034&color=fff&size=56"

    # Always minimize by default when landing on a new page/tab
    last_page = st.session_state.get("navs_widget_last_page")
    if last_page != page_hint:
        st.session_state.navs_widget_open = False
        st.session_state.navs_widget_last_page = page_hint

    # Widget container (positioned via CSS from app.py)
    widget = st.container()
    with widget:
        if not st.session_state.navs_widget_open:
            st.markdown('<div class="navs-bubble-marker"></div>', unsafe_allow_html=True)
            if st.button("💬", key="navs_toggle", help="Ask Navs"):
                st.session_state.navs_widget_open = True
                st.rerun()
            return

        st.markdown('<div class="navs-panel-marker"></div>', unsafe_allow_html=True)

        header_cols = st.columns([1, 0.12])
        with header_cols[0]:
            st.markdown(
                f"""
                <div class='navs-panel-title'>
                  <img src="{avatar_src}" class="navs-title-avatar" alt="Naveen"/>
                  <span>Ask Navs</span>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with header_cols[1]:
            if st.button("✕", key="navs_close"):
                st.session_state.navs_widget_open = False
                st.rerun()

        # Messages panel
        panel = st.container(height=360)
        with panel:
            if not st.session_state.navs_global_history:
                st.markdown(
                    "<div style='color: rgba(255,255,255,0.7); font-size: 12px;'>"
                    "Ask me about this page. I can break down trends, yield, and headcount."
                    "</div>",
                    unsafe_allow_html=True,
                )
            for msg in st.session_state.navs_global_history:
                role = msg.get("role", "assistant")
                with st.chat_message(role):
                    st.markdown(msg.get("content", ""))

            # Pending response
            if st.session_state.navs_global_pending:
                prompt = st.session_state.navs_global_pending
                with st.chat_message("assistant"):
                    with st.spinner("Thinking..."):
                        categories = plan_data_needs(
                            prompt,
                            data,
                            api_key,
                            page_hint=page_hint,
                        )
                        context = build_selective_context(
                            data,
                            categories,
                            page_hint=page_hint,
                        )
                        if st.session_state.navs_global_summary:
                            context += "\n\nChat Summary:\n" + st.session_state.navs_global_summary
                        try:
                            response = query_gemini(prompt, context, api_key)
                        except Exception as e:
                            if "429" in str(e) or "Too Many Requests" in str(e):
                                response = fallback_response(prompt, data)
                            else:
                                response = f"Error: {e}"

                        response = clean_markdown(response)
                        st.session_state.navs_global_history.append({"role": "assistant", "content": response})
                        st.session_state.navs_global_pending = None

                        # periodic summarization
                        if len(st.session_state.navs_global_history) >= 6 and st.session_state.navs_global_tick % 2 == 0:
                            summary = summarize_chat(st.session_state.navs_global_history, api_key)
                            if summary:
                                st.session_state.navs_global_summary = summary
                        st.session_state.navs_global_tick += 1
                        st.rerun()

        # Input area
        with st.form("navs_widget_form", clear_on_submit=True):
            cols = st.columns([1, 0.38])
            with cols[0]:
                user_input = st.text_input(
                    "Message Naveen",
                    key="navs_widget_input",
                    label_visibility="collapsed",
                    placeholder="Message Naveen…",
                )
            with cols[1]:
                sent = st.form_submit_button("Send", use_container_width=True)
        if sent and user_input:
            st.session_state.navs_global_history.append({"role": "user", "content": user_input})
            st.session_state.navs_global_pending = user_input
            st.rerun()


# Premium CSS Styles - Clean and minimal
PREMIUM_CSS = """
<style>
/* -------- Glass effect on main content area -------- */
.main .block-container {
    background: linear-gradient(135deg, rgba(26, 31, 46, 0.95) 0%, rgba(14, 17, 23, 0.98) 100%);
    border: 1px solid rgba(164, 16, 52, 0.35);
    border-radius: 16px;
    padding: 20px !important;
    box-shadow: 0 10px 36px rgba(0, 0, 0, 0.45);
    max-width: 1000px;
    margin: 0 auto;
}

/* -------- Header -------- */
.ai-header {
    background: linear-gradient(90deg, rgba(164, 16, 52, 0.15) 0%, rgba(164, 16, 52, 0.02) 70%, transparent 100%);
    padding: 14px 18px;
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
}

.ai-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
}

.ai-header .greeting {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
    margin-top: 2px;
}

/* Avatar - no cropping */
.avatar-container {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
}

.avatar-container img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid rgba(164, 16, 52, 0.5);
    object-fit: contain;
    background: rgba(255,255,255,0.05);
}

/* New Chat button - positioned to align with header */
.new-chat-row {
    display: flex;
    justify-content: flex-end;
    margin-top: -60px;
    margin-bottom: 16px;
    padding-right: 18px;
    position: relative;
    z-index: 10;
}
.new-chat-row button {
    background: rgba(164, 16, 52, 0.25) !important;
    border: 1px solid rgba(164, 16, 52, 0.5) !important;
    color: #fff !important;
    padding: 8px 16px !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
}
.new-chat-row button:hover {
    background: rgba(164, 16, 52, 0.4) !important;
    border-color: rgba(164, 16, 52, 0.7) !important;
}

/* Scrollable chat container */
[data-testid="stVerticalBlockBorderWrapper"] {
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 12px !important;
    background: rgba(0, 0, 0, 0.15) !important;
}

/* Chat input styling */
[data-testid="stChatInput"] {
    border-color: rgba(255, 255, 255, 0.15) !important;
}
[data-testid="stChatInput"]:focus-within {
    border-color: rgba(255, 255, 255, 0.3) !important;
    box-shadow: none !important;
}
div[data-testid="stChatInput"] textarea {
    border-radius: 14px !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    background: rgba(255, 255, 255, 0.03) !important;
    caret-color: #fff !important;
}

/* Suggestion buttons */
div[data-testid="stButton"] > button {
    min-height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    background: rgba(255, 255, 255, 0.04) !important;
    color: rgba(255, 255, 255, 0.92) !important;
    border-radius: 10px !important;
    transition: all 120ms ease;
}
div[data-testid="stButton"] > button:hover {
    background: rgba(164, 16, 52, 0.18) !important;
    border-color: rgba(164, 16, 52, 0.35) !important;
}

/* Mobile adjustments */
@media (max-width: 768px) {
    .main .block-container {
        padding: 16px !important;
        margin: 0 8px;
    }
    div[data-testid="stButton"] > button {
        min-height: 48px;
        font-size: 0.95rem;
    }
}
</style>
"""


def build_context(data: dict) -> str:
    """Backwards-compatible: build 'full' context using modular builders."""
    return build_selective_context(data, list(DATA_CATEGORIES.keys()))


def query_gemini(question: str, context: str, api_key: str) -> str:
    """Send question to Gemini API with context. Retries on 429."""
    prompt = (
        "You are Naveen, the AI and BI Engineering Manager for Stevens CPE. "
        "Personality: friendly bro vibe, confident and upbeat, but professional. "
        "Language: clear and respectful, no 'yo' or overly casual slang, no profanity. "
        "Tone: fun but polished, avoid hype, and keep a grounded, practical voice. "
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


def render(data: dict):
    """Render the premium Ask Navs chat interface."""
    
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
        avatar_src = "https://ui-avatars.com/api/?name=AI+Naveen&background=A41034&color=fff&size=56"

    # Header with avatar and title
    st.markdown(
        f"""
        <div class="ai-header">
          <div class="avatar-container">
            <img src="{avatar_src}" alt="Naveen"/>
          </div>
          <div style="flex: 1;">
            <h2 style="margin:0; color:#fff; border:none;">Ask Navs</h2>
            <div class="greeting">Naveen • Ask about enrollment, yield, NTR, and trends.</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # New Chat button - positioned to overlap with header (appears inside it visually)
    st.markdown('<div class="new-chat-row">', unsafe_allow_html=True)
    if st.button("✨ New Chat", key="new_chat_btn"):
        st.session_state.chat_history = []
        st.session_state.chat_summary = ""
        st.session_state.summary_tick = 0
        st.session_state.pending_chip = None
        st.session_state.pending_response = None
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

    # Check if we need to process a pending response
    if "pending_response" not in st.session_state:
        st.session_state.pending_response = None

    # Scrollable chat area with fixed height
    chat_container = st.container(height=420)

    with chat_container:
        if not st.session_state.chat_history:
            # Empty state
            st.markdown(
                "<div style='color: rgba(255,255,255,0.5); font-size: 13px; padding: 20px 0;'>Start a conversation by typing below or clicking a suggestion.</div>",
                unsafe_allow_html=True,
            )
        else:
            # Display all chat history
            for msg in st.session_state.chat_history:
                avatar = avatar_path if msg["role"] == "assistant" else None
                with st.chat_message(msg["role"], avatar=avatar):
                    st.markdown(msg["content"])

        # Show thinking indicator if we're waiting for a response
        if st.session_state.pending_response:
            with st.chat_message("assistant", avatar=avatar_path):
                with st.spinner(random.choice(fun_quotes)):
                    # Generate response
                    prompt = st.session_state.pending_response
                    needed_categories = plan_data_needs(
                        prompt,
                        data,
                        api_key,
                        page_hint="Ask Navs Page",
                    )
                    context = build_selective_context(
                        data,
                        needed_categories,
                        page_hint="Ask Navs Page",
                    )
                    if st.session_state.chat_summary:
                        context += "\n\nChat Summary:\n" + st.session_state.chat_summary

                    try:
                        response = query_gemini(prompt, context, api_key)
                    except Exception as e:
                        if "429" in str(e) or "Too Many Requests" in str(e):
                            response = fallback_response(prompt, data)
                        else:
                            response = f"Error: {e}"

                    response = clean_markdown(response)
                    st.session_state.chat_history.append({"role": "assistant", "content": response})
                    st.session_state.pending_response = None

                    # Summarize periodically
                    if len(st.session_state.chat_history) >= 6 and st.session_state.summary_tick % 2 == 0:
                        summary = summarize_chat(st.session_state.chat_history, api_key)
                        if summary:
                            st.session_state.chat_summary = summary
                    st.session_state.summary_tick += 1
                    st.rerun()

    # Suggested questions (only when chat is empty)
    if not st.session_state.chat_history:
        chips = suggestion_chips[:4]
        if chips:
            chip_cols = st.columns(2)
            for i, chip in enumerate(chips):
                col_idx = i % 2
                with chip_cols[col_idx]:
                    display_text = chip if len(chip) <= 40 else chip[:37] + "..."
                    if st.button(display_text, key=f"chip_{i}", use_container_width=True):
                        # Add user message and set pending response
                        st.session_state.chat_history.append({"role": "user", "content": chip})
                        st.session_state.pending_response = chip
                        st.rerun()

    # Chat input
    if prompt := st.chat_input("Ask about enrollment, yield, NTR, or trends..."):
        # Rate limiting
        last_call = st.session_state.get("last_ai_call", 0)
        now = time.time()
        if now - last_call < 3:
            st.toast("Please wait a moment between questions.")
        else:
            st.session_state.last_ai_call = now
            # Add user message and set pending response
            st.session_state.chat_history.append({"role": "user", "content": prompt})
            st.session_state.pending_response = prompt
            st.rerun()


