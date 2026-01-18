"""
Shared AI Insights module for the CPE Funnel Dashboard.
Provides reusable insight generation for Executive Summary and Ask Navs.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
import streamlit as st
import google.genai as genai

from analytics import calculate_summary_stats, calculate_program_stats, get_funnel_by_category
from utils.formatting import format_number, format_percent, format_currency


GEMINI_MODEL = "gemini-3-flash-preview"


@dataclass
class InsightCard:
    """Represents a single insight card."""
    type: str  # "highlight", "alert", "trend"
    title: str
    message: str
    metric: str
    icon: str
    color: str


def analyze_data_for_insights(data: dict) -> List[InsightCard]:
    """
    Analyze dashboard data and generate 3 insight cards without API call.
    Uses rule-based logic to identify highlights, alerts, and trends.
    """
    insights = []
    
    apps_data = data.get('applications', {})
    census_data = data.get('census', {})
    ntr_summary = data.get('ntr_summary')
    
    # Calculate stats
    summary_stats = calculate_summary_stats(
        apps_data.get('current'),
        apps_data.get('previous'),
        apps_data.get('two_years_ago'),
        census_data
    )
    
    current = summary_stats['overall'][2026]
    previous = summary_stats['overall'][2025]
    yoy = summary_stats['yoy']['2026_vs_2025']
    by_category = summary_stats.get('by_category', {})
    
    # HIGHLIGHT: Find best performing metric
    best_metric = None
    best_value = 0
    
    # Check enrollment growth
    if yoy.enrollments_change > 20:
        best_metric = "enrollment_growth"
        best_value = yoy.enrollments_change
    
    # Check for high yield categories
    for cat, metrics in by_category.items():
        if 2026 in metrics and cat:
            m = metrics[2026]
            if m.yield_rate > 60 and m.enrollments > 50:
                if m.yield_rate > best_value:
                    best_metric = f"yield_{cat}"
                    best_value = m.yield_rate
    
    if best_metric == "enrollment_growth":
        insights.append(InsightCard(
            type="highlight",
            title="Strong Growth",
            message=f"Enrollments up {yoy.enrollments_change:.0f}% YoY with {current.enrollments} new students",
            metric=f"+{yoy.enrollments_change:.0f}%",
            icon="📈",
            color="#22c55e"  # green
        ))
    elif best_metric and best_metric.startswith("yield_"):
        cat_name = best_metric.replace("yield_", "")
        insights.append(InsightCard(
            type="highlight",
            title="Top Performer",
            message=f"{cat_name} has exceptional {best_value:.0f}% yield rate",
            metric=f"{best_value:.0f}%",
            icon="🏆",
            color="#22c55e"
        ))
    else:
        # Default highlight
        insights.append(InsightCard(
            type="highlight",
            title="Admits Strong",
            message=f"{current.admits} admits with {current.admit_rate:.0f}% admit rate",
            metric=f"{current.admits}",
            icon="✓",
            color="#22c55e"
        ))
    
    # ALERT: Find something needing attention
    alert_found = False
    
    # Check for low yield categories
    for cat, metrics in by_category.items():
        if 2026 in metrics and cat:
            m = metrics[2026]
            if m.yield_rate < 25 and m.applications > 50:
                insights.append(InsightCard(
                    type="alert",
                    title="Low Yield Alert",
                    message=f"{cat} has only {m.yield_rate:.0f}% yield despite {m.applications} applications",
                    metric=f"{m.yield_rate:.0f}%",
                    icon="⚠️",
                    color="#f59e0b"  # amber
                ))
                alert_found = True
                break
    
    # Check NTR gap
    if not alert_found and ntr_summary:
        if ntr_summary.percentage_of_goal < 85:
            gap = ntr_summary.gap_to_goal
            insights.append(InsightCard(
                type="alert",
                title="NTR Gap",
                message=f"{format_currency(gap)} remaining to reach goal ({ntr_summary.percentage_of_goal:.0f}% progress)",
                metric=format_currency(gap),
                icon="💰",
                color="#f59e0b"
            ))
            alert_found = True
    
    if not alert_found:
        # Check for declining apps in any category
        for cat, metrics in by_category.items():
            if 2025 in metrics and 2026 in metrics and cat:
                prev_apps = metrics[2025].applications
                curr_apps = metrics[2026].applications
                if prev_apps > 50 and curr_apps < prev_apps * 0.8:
                    decline = ((curr_apps - prev_apps) / prev_apps) * 100
                    insights.append(InsightCard(
                        type="alert",
                        title="Apps Declining",
                        message=f"{cat} applications down {abs(decline):.0f}% from last year",
                        metric=f"{decline:.0f}%",
                        icon="📉",
                        color="#f59e0b"
                    ))
                    alert_found = True
                    break
    
    if not alert_found:
        insights.append(InsightCard(
            type="alert",
            title="Monitor Closely",
            message="No critical issues, but keep watching yield conversion",
            metric="OK",
            icon="👀",
            color="#f59e0b"
        ))
    
    # TREND: Notable YoY change
    if abs(yoy.apps_change) > 20:
        direction = "up" if yoy.apps_change > 0 else "down"
        insights.append(InsightCard(
            type="trend",
            title=f"Apps Trend {direction.title()}",
            message=f"Applications {direction} {abs(yoy.apps_change):.0f}% compared to Spring 2025",
            metric=f"{'+' if yoy.apps_change > 0 else ''}{yoy.apps_change:.0f}%",
            icon="📊",
            color="#3b82f6"  # blue
        ))
    elif abs(yoy.admits_change) > 20:
        direction = "up" if yoy.admits_change > 0 else "down"
        insights.append(InsightCard(
            type="trend",
            title=f"Admits {direction.title()}",
            message=f"Admits {direction} {abs(yoy.admits_change):.0f}% year over year",
            metric=f"{'+' if yoy.admits_change > 0 else ''}{yoy.admits_change:.0f}%",
            icon="📊",
            color="#3b82f6"
        ))
    else:
        insights.append(InsightCard(
            type="trend",
            title="Steady Progress",
            message=f"Enrollment funnel showing consistent YoY performance",
            metric="Stable",
            icon="📊",
            color="#3b82f6"
        ))
    
    return insights


def generate_executive_summary_text(data: dict, api_key: str) -> str:
    """
    Generate a 2-3 sentence executive summary using Gemini API.
    Falls back to rule-based summary if API fails.
    """
    apps_data = data.get('applications', {})
    census_data = data.get('census', {})
    ntr_summary = data.get('ntr_summary')
    
    summary_stats = calculate_summary_stats(
        apps_data.get('current'),
        apps_data.get('previous'),
        apps_data.get('two_years_ago'),
        census_data
    )
    
    current = summary_stats['overall'][2026]
    yoy = summary_stats['yoy']['2026_vs_2025']
    breakdown = summary_stats.get('enrollment_breakdown')
    by_category = summary_stats.get('by_category', {})
    
    # Build context for API
    context_parts = [
        f"Spring 2026 Graduate Online Dashboard:",
        f"Applications: {current.applications} ({yoy.apps_change:+.0f}% YoY)",
        f"Admits: {current.admits} ({yoy.admits_change:+.0f}% YoY)",
        f"Enrollments: {current.enrollments} ({yoy.enrollments_change:+.0f}% YoY)",
        f"Yield Rate: {current.yield_rate:.0f}%",
    ]
    
    if ntr_summary:
        context_parts.append(
            f"NTR: {format_currency(ntr_summary.total_ntr)} "
            f"({ntr_summary.percentage_of_goal:.0f}% of {format_currency(ntr_summary.ntr_goal)} goal)"
        )
    
    if breakdown:
        context_parts.append(
            f"Total enrollment: {breakdown.total} "
            f"(New: {breakdown.slate_new}, Continuing: {breakdown.continuing}, Returning: {breakdown.returning})"
        )
    
    # Add top/bottom performers
    top_yield_cat = None
    low_yield_cat = None
    for cat, metrics in by_category.items():
        if 2026 in metrics and cat:
            m = metrics[2026]
            if m.applications > 50:
                if top_yield_cat is None or m.yield_rate > top_yield_cat[1]:
                    top_yield_cat = (cat, m.yield_rate)
                if low_yield_cat is None or m.yield_rate < low_yield_cat[1]:
                    low_yield_cat = (cat, m.yield_rate)
    
    if top_yield_cat:
        context_parts.append(f"Top yield: {top_yield_cat[0]} at {top_yield_cat[1]:.0f}%")
    if low_yield_cat:
        context_parts.append(f"Lowest yield: {low_yield_cat[0]} at {low_yield_cat[1]:.0f}%")
    
    context = "\n".join(context_parts)
    
    prompt = (
        "Write a 2-3 sentence executive summary for a business dashboard. "
        "Be concise, specific with numbers, and highlight the most important insight. "
        "Use a professional but confident tone. No bullet points.\n\n"
        f"Data:\n{context}"
    )
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        if response and response.text:
            return response.text.strip()
    except Exception:
        pass
    
    # Fallback: rule-based summary
    summary_parts = []
    
    if yoy.enrollments_change > 0:
        summary_parts.append(
            f"Spring 2026 shows strong momentum with enrollments up {yoy.enrollments_change:.0f}% YoY "
            f"to {current.enrollments} new students."
        )
    else:
        summary_parts.append(
            f"Spring 2026 has {current.enrollments} new enrollments "
            f"with a {current.yield_rate:.0f}% yield rate."
        )
    
    if ntr_summary and ntr_summary.percentage_of_goal < 100:
        summary_parts.append(
            f"NTR is at {ntr_summary.percentage_of_goal:.0f}% of goal "
            f"with {format_currency(ntr_summary.gap_to_goal)} remaining."
        )
    elif ntr_summary:
        summary_parts.append(
            f"NTR has reached {format_currency(ntr_summary.total_ntr)}, "
            f"meeting {ntr_summary.percentage_of_goal:.0f}% of target."
        )
    
    if low_yield_cat and low_yield_cat[1] < 30:
        summary_parts.append(
            f"{low_yield_cat[0]} needs attention with only {low_yield_cat[1]:.0f}% yield."
        )
    
    return " ".join(summary_parts[:3])


@st.cache_data(ttl=1800)  # Cache for 30 minutes
def get_cached_insights(_data_hash: str, data: dict) -> List[InsightCard]:
    """Get cached insight cards. Uses data hash for cache key."""
    return analyze_data_for_insights(data)


@st.cache_data(ttl=1800)
def get_cached_summary(_data_hash: str, data: dict, api_key: str) -> str:
    """Get cached executive summary. Uses data hash for cache key."""
    return generate_executive_summary_text(data, api_key)


def get_data_hash(data: dict) -> str:
    """Generate a simple hash of the data for caching."""
    apps_data = data.get('applications', {})
    current = apps_data.get('current')
    if current is not None and not current.empty:
        return f"{len(current)}_{current['Ref'].iloc[0] if 'Ref' in current.columns else 0}"
    return "empty"


def get_suggestion_chips(data: dict, insights: List[InsightCard]) -> List[str]:
    """Generate context-aware suggestion chips based on data and insights."""
    chips = []
    
    # Always include these
    chips.append("What's driving enrollment growth?")
    chips.append("Which programs have the highest yield?")
    
    # Add insight-specific chips
    for insight in insights:
        if insight.type == "alert" and "yield" in insight.message.lower():
            cat = insight.message.split()[0]
            chips.append(f"Why is {cat} yield low?")
        elif insight.type == "alert" and "NTR" in insight.title:
            chips.append("How do we close the NTR gap?")
        elif insight.type == "trend" and "Apps" in insight.title:
            chips.append("What's causing the application trend?")
    
    # Add some variety
    chips.append("Compare corporate vs retail")
    chips.append("Give me a YoY performance summary")
    
    # Return unique chips, max 6
    seen = set()
    unique_chips = []
    for chip in chips:
        if chip not in seen:
            seen.add(chip)
            unique_chips.append(chip)
    
    return unique_chips[:6]


def get_time_greeting() -> str:
    """Get time-appropriate greeting."""
    from datetime import datetime
    hour = datetime.now().hour
    
    if hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"
