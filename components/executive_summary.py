"""
Executive Summary component for the CPE Funnel Dashboard.
Displays key metrics, KPIs, high-level visualizations, and AI-generated insights.
"""

import streamlit as st
import plotly.graph_objects as go
from datetime import datetime, timedelta
from utils.formatting import format_currency, format_percent, format_number, format_delta
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_PRIMARY, CHART_SECONDARY, CHART_SUCCESS
)


def render_refresh_info(last_refresh: datetime, time_until_refresh: timedelta):
    """Display last refresh time."""
    pass  # Data source info removed


def render_ai_insights_section(data: dict):
    """Render the AI-generated insights summary at the top of Executive Summary."""
    from components.ai_insights import (
        get_cached_insights, get_data_hash
    )
    
    api_key = st.secrets.get("gemini_api_key", "")
    
    # Prepare NTR summary if not present
    if "ntr_summary" not in data:
        census_df = data.get('census', {}).get('raw_df')
        if census_df is not None and not census_df.empty:
            from ntr_calculator import calculate_ntr_from_census
            ntr_summary, _, _ = calculate_ntr_from_census(census_df)
            data['ntr_summary'] = ntr_summary
    
    # Get insights (rule-based, fast)
    data_hash = get_data_hash(data)
    insights = get_cached_insights(data_hash, data)
    
    # Build a rule-based summary for speed (no API call)
    ntr_summary = data.get('ntr_summary')
    from analytics import calculate_summary_stats
    apps_data = data.get('applications', {})
    census_summary = data.get('census', {})
    
    summary_stats = calculate_summary_stats(
        apps_data.get('current'),
        apps_data.get('previous'),
        apps_data.get('two_years_ago'),
        census_summary
    )
    
    current = summary_stats['overall'][2026]
    yoy = summary_stats['yoy']['2026_vs_2025']
    
    # Build quick summary text
    summary_parts = []
    if yoy.enrollments_change > 0:
        summary_parts.append(f"Enrollments up {yoy.enrollments_change:.0f}% YoY with {current.enrollments} new students.")
    else:
        summary_parts.append(f"{current.enrollments} new enrollments with {current.yield_rate:.0f}% yield.")
    
    if ntr_summary:
        summary_parts.append(f"NTR at {ntr_summary.percentage_of_goal:.0f}% of ${ntr_summary.ntr_goal/1e6:.1f}M goal.")
    
    # Add insight-based detail
    for insight in insights:
        if insight.type == "alert":
            summary_parts.append(insight.message)
            break
    
    summary_text = " ".join(summary_parts[:3])
    
    # Render plain-text summary only (no cards/boxes)
    st.markdown("### AI Insights")
    st.write(summary_text)

    # CTA is rendered by the Executive Summary wrapper page in `app.py` to preserve session state.


def render_kpi_card(title: str, value: str, delta: str = None, delta_direction: str = "flat"):
    """Render a single KPI card with clean formatting."""
    delta_color = {
        "up": CHART_SUCCESS,
        "down": STEVENS_RED,
        "flat": STEVENS_GRAY_LIGHT
    }[delta_direction]
    
    delta_html = ""
    if delta:
        # Delta already includes "vs 2025" from format_delta
        delta_html = f'<div style="font-size: 14px; font-weight: 700; color: {delta_color}; margin-top: 6px;">{delta}</div>'
    
    st.markdown(f"""
        <div class="cpe-card cpe-card--accent-left" style="--cpe-accent: {STEVENS_RED}; height: 120px;">
            <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">{title}</div>
            <div style="font-size: 32px; font-weight: 700; color: {STEVENS_WHITE}; margin-top: 8px; letter-spacing: -1px;">{value}</div>
            {delta_html}
        </div>
    """, unsafe_allow_html=True)


def render_kpi_row(summary_stats: dict):
    """Render the main KPI cards row using Slate data only."""
    current = summary_stats['overall'][2026]
    previous = summary_stats['overall'][2025]
    
    st.markdown("#### Enrollment Funnel (Spring 2026)")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        delta, direction = format_delta(current.applications, previous.applications)
        render_kpi_card("Applications", format_number(current.applications), delta, direction)
    
    with col2:
        delta, direction = format_delta(current.admits, previous.admits)
        render_kpi_card("Admits", format_number(current.admits), delta, direction)
    
    with col3:
        delta, direction = format_delta(current.enrollments, previous.enrollments)
        render_kpi_card("Enrollments", format_number(current.enrollments), delta, direction)
    
    with col4:
        render_kpi_card("Yield Rate", format_percent(current.yield_rate))


def render_enrollment_breakdown(summary_stats: dict):
    """Render enrollment breakdown using Slate new + Census continuing/returning."""
    breakdown = summary_stats.get('enrollment_breakdown')
    if not breakdown:
        return

    st.markdown("#### Headcount Breakdown (Spring 2026)")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        render_kpi_card("New (Slate)", format_number(breakdown.slate_new))
    with col2:
        render_kpi_card("Continuing (Census)", format_number(breakdown.continuing))
    with col3:
        render_kpi_card("Returning (Census)", format_number(breakdown.returning))
    with col4:
        render_kpi_card("Total Enrolled", format_number(breakdown.total))


def render_ntr_gauge(ntr_summary):
    """Render the NTR progress gauge."""
    if ntr_summary is None:
        st.info("NTR data not available")
        return
    
    percentage = min(ntr_summary.percentage_of_goal, 100)
    
    fig = go.Figure(go.Indicator(
        mode="gauge+number+delta",
        value=ntr_summary.total_ntr,
        number={'prefix': "$", 'valueformat': ",.0f", 'font': {'color': STEVENS_WHITE}},
        delta={'reference': ntr_summary.ntr_goal, 'relative': False, 'valueformat': ",.0f", 'prefix': "$"},
        title={'text': "Net Tuition Revenue", 'font': {'size': 16, 'color': STEVENS_WHITE}},
        gauge={
            'axis': {'range': [0, ntr_summary.ntr_goal * 1.1], 'tickformat': "$.2s", 'tickcolor': STEVENS_GRAY_LIGHT},
            'bar': {'color': STEVENS_RED},
            'bgcolor': BACKGROUND_CARD,
            'borderwidth': 0,
            'steps': [
                {'range': [0, ntr_summary.ntr_goal * 0.5], 'color': '#2D3748'},
                {'range': [ntr_summary.ntr_goal * 0.5, ntr_summary.ntr_goal * 0.75], 'color': '#3D4A5C'},
                {'range': [ntr_summary.ntr_goal * 0.75, ntr_summary.ntr_goal], 'color': STEVENS_GRAY_DARK},
            ],
            'threshold': {
                'line': {'color': CHART_SUCCESS, 'width': 3},
                'thickness': 0.8,
                'value': ntr_summary.ntr_goal
            }
        }
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=280,
        margin=dict(l=20, r=20, t=60, b=20)
    )
    
    st.plotly_chart(fig, width="stretch")


def render_mini_funnel(summary_stats: dict):
    """Render a mini funnel visualization."""
    current = summary_stats['overall'][2026]
    
    stages = ['Applications', 'Admits', 'Enrollments']
    values = [current.applications, current.admits, current.enrollments]
    
    fig = go.Figure(go.Funnel(
        y=stages,
        x=values,
        textposition="inside",
        textinfo="value+percent initial",
        marker=dict(
            color=[STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT],
            line=dict(width=0)
        ),
        connector=dict(line=dict(color="#333", width=1))
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=280,
        margin=dict(l=20, r=20, t=20, b=20),
        showlegend=False
    )
    
    st.plotly_chart(fig, width="stretch")


def render_yoy_comparison_chart(summary_stats: dict):
    """Render a year-over-year comparison bar chart."""
    years = [2024, 2025, 2026]
    apps = [summary_stats['overall'][y].applications for y in years]
    admits = [summary_stats['overall'][y].admits for y in years]
    enrollments = [summary_stats['overall'][y].enrollments for y in years]
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        name='Applications',
        x=years,
        y=apps,
        marker_color=STEVENS_RED,
        text=apps,
        textposition='outside'
    ))
    
    fig.add_trace(go.Bar(
        name='Admits',
        x=years,
        y=admits,
        marker_color=STEVENS_GRAY_DARK,
        text=admits,
        textposition='outside'
    ))
    
    fig.add_trace(go.Bar(
        name='Enrollments',
        x=years,
        y=enrollments,
        marker_color=STEVENS_GRAY_LIGHT,
        text=enrollments,
        textposition='outside'
    ))
    
    fig.update_layout(
        barmode='group',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=380,
        margin=dict(l=40, r=20, t=60, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        xaxis=dict(
            tickmode='array',
            tickvals=years,
            ticktext=[str(y) for y in years],
            gridcolor='#333'
        ),
        yaxis=dict(gridcolor='#333')
    )
    
    st.plotly_chart(fig, width="stretch")


def render_category_breakdown(summary_stats: dict):
    """Render a breakdown by application category."""
    categories = summary_stats.get('by_category', {})
    
    if not categories:
        st.info("Category breakdown not available")
        return
    
    data = []
    for category, years in categories.items():
        if 2026 in years:
            metrics = years[2026]
            data.append({
                'Category': category,
                'Applications': metrics.applications,
                'Enrollments': metrics.enrollments,
                'Yield Rate': metrics.yield_rate
            })
    
    if not data:
        return
    
    # Sort by applications
    data.sort(key=lambda x: x['Applications'], reverse=True)
    
    fig = go.Figure()
    
    categories_list = [d['Category'] for d in data]
    apps = [d['Applications'] for d in data]
    enrolls = [d['Enrollments'] for d in data]
    
    fig.add_trace(go.Bar(
        name='Applications',
        y=categories_list,
        x=apps,
        orientation='h',
        marker_color=STEVENS_RED,
        text=apps,
        textposition='inside'
    ))
    
    fig.add_trace(go.Bar(
        name='Enrollments',
        y=categories_list,
        x=enrolls,
        orientation='h',
        marker_color=CHART_SUCCESS,
        text=enrolls,
        textposition='inside'
    ))
    
    fig.update_layout(
        barmode='group',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE, 'size': 11},
        height=320,
        margin=dict(l=20, r=20, t=20, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        xaxis=dict(gridcolor='#333'),
        yaxis=dict(autorange='reversed')
    )
    
    st.plotly_chart(fig, width="stretch")


def render(data: dict):
    """Main render function for the Executive Summary page."""
    st.markdown("## Executive Summary")
    
    # Refresh info
    if 'last_refresh' in data:
        next_refresh = data['last_refresh'] + timedelta(hours=3)
        time_until = next_refresh - datetime.now()
        if time_until.total_seconds() < 0:
            time_until = timedelta(seconds=0)
        render_refresh_info(data['last_refresh'], time_until)

    # AI Insights Section at the top
    render_ai_insights_section(data)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Calculate summary stats
    from analytics import calculate_summary_stats
    
    apps_data = data.get('applications', {})
    census_summary = data.get('census', {})
    
    summary_stats = calculate_summary_stats(
        apps_data.get('current'),
        apps_data.get('previous'),
        apps_data.get('two_years_ago'),
        census_summary
    )
    
    # KPI Cards
    render_kpi_row(summary_stats)
    
    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Enrollment breakdown
    render_enrollment_breakdown(summary_stats)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Two-column layout for charts
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Enrollment Funnel (2026)")
        render_mini_funnel(summary_stats)
    
    with col2:
        st.markdown("### By Application Category")
        render_category_breakdown(summary_stats)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Bottom row - YoY Comparison
    st.markdown("### Year-over-Year Comparison")
    render_yoy_comparison_chart(summary_stats)
