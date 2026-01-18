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

/* New Chat button inside header */
.new-chat-btn {
    background: rgba(164, 16, 52, 0.25);
    border: 1px solid rgba(164, 16, 52, 0.5);
    color: #fff;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: auto;
}
.new-chat-btn:hover {
    background: rgba(164, 16, 52, 0.4);
    border-color: rgba(164, 16, 52, 0.7);
}

/* Hide the actual Streamlit button */
#new-chat-hidden {
    position: absolute;
    left: -9999px;
    opacity: 0;
    pointer-events: none;
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
        avatar_src = "https://ui-avatars.com/api/?name=AI+Naveen&background=A41034&color=fff&size=56"

    # Hidden Streamlit button for New Chat functionality
    st.markdown('<div id="new-chat-hidden">', unsafe_allow_html=True)
    if st.button("New Chat", key="new_chat_btn"):
        st.session_state.chat_history = []
        st.session_state.chat_summary = ""
        st.session_state.summary_tick = 0
        st.session_state.pending_chip = None
        st.session_state.pending_response = None
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

    # Header with avatar, title, and New Chat button all in one box
    st.markdown(
        f"""
        <div class="ai-header">
          <div class="avatar-container">
            <img src="{avatar_src}" alt="AI Naveen"/>
          </div>
          <div style="flex: 1;">
            <h2 style="margin:0; color:#fff; border:none;">AI Naveen</h2>
            <div class="greeting">Ask about enrollment, yield, NTR, and trends.</div>
          </div>
          <button class="new-chat-btn" onclick="document.querySelector('#new-chat-hidden button').click()">
            ✨ New Chat
          </button>
        </div>
        """,
        unsafe_allow_html=True,
    )
    
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
                        context = build_context(data)
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


