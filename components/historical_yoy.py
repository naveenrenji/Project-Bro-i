"""
Historical & YoY Analysis component for the CPE Funnel Dashboard.
Displays historical trends and year-over-year comparisons.
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from utils.formatting import format_number, format_percent
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    CHART_SUCCESS
)


def render_trend_chart(summary_stats: dict, metric: str = 'applications'):
    """Render a line chart showing 3-year trends."""
    years = [2024, 2025, 2026]
    
    values = []
    for year in years:
        metrics = summary_stats['overall'].get(year)
        if metrics:
            values.append(getattr(metrics, metric, 0))
        else:
            values.append(0)
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=years,
        y=values,
        mode='lines+markers+text',
        name=metric.title(),
        line=dict(color=STEVENS_RED, width=3),
        marker=dict(size=12, color=STEVENS_RED),
        text=values,
        textposition='top center',
        textfont=dict(size=14, color=STEVENS_WHITE)
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=40, t=60, b=40),
        xaxis=dict(
            tickmode='array',
            tickvals=years,
            ticktext=[str(y) for y in years],
            gridcolor='#333'
        ),
        yaxis=dict(gridcolor='#333'),
        showlegend=False
    )
    
    st.plotly_chart(fig, width="stretch")


def render_multi_metric_trends(summary_stats: dict):
    """Render multiple metrics on the same chart."""
    years = [2024, 2025, 2026]
    
    metrics_data = {
        'Applications': [],
        'Admits': [],
        'Enrollments': []
    }
    
    for year in years:
        m = summary_stats['overall'].get(year)
        if m:
            metrics_data['Applications'].append(m.applications)
            metrics_data['Admits'].append(m.admits)
            metrics_data['Enrollments'].append(m.enrollments)
        else:
            for key in metrics_data:
                metrics_data[key].append(0)
    
    fig = go.Figure()
    
    colors = {'Applications': STEVENS_RED, 'Admits': STEVENS_GRAY_DARK, 'Enrollments': CHART_SUCCESS}
    
    for metric, values in metrics_data.items():
        fig.add_trace(go.Scatter(
            x=years,
            y=values,
            mode='lines+markers',
            name=metric,
            line=dict(color=colors[metric], width=3),
            marker=dict(size=10, color=colors[metric])
        ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=400,
        margin=dict(l=40, r=40, t=40, b=40),
        xaxis=dict(
            tickmode='array',
            tickvals=years,
            ticktext=[str(y) for y in years],
            gridcolor='#333'
        ),
        yaxis=dict(gridcolor='#333'),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render_yoy_table(summary_stats: dict):
    """Render a YoY comparison table."""
    years = [2024, 2025, 2026]
    
    data = []
    for year in years:
        m = summary_stats['overall'].get(year)
        if m:
            data.append({
                'Year': year,
                'Applications': m.applications,
                'Admits': m.admits,
                'Enrollments': m.enrollments,
                'Admit Rate': f"{m.admit_rate:.1f}%",
                'Yield Rate': f"{m.yield_rate:.1f}%"
            })
    
    df = pd.DataFrame(data)
    
    # Add YoY change row
    if len(df) >= 2:
        prev = df[df['Year'] == 2025].iloc[0]
        curr = df[df['Year'] == 2026].iloc[0]
        
        def calc_change(c, p):
            if p == 0:
                return "N/A"
            change = (c - p) / p * 100
            return f"+{change:.1f}%" if change > 0 else f"{change:.1f}%"
        
        change_row = {
            'Year': 'YoY Change',
            'Applications': calc_change(curr['Applications'], prev['Applications']),
            'Admits': calc_change(curr['Admits'], prev['Admits']),
            'Enrollments': calc_change(curr['Enrollments'], prev['Enrollments']),
            'Admit Rate': '—',
            'Yield Rate': '—'
        }
        
        # Convert Year column to string before adding change row
        df['Year'] = df['Year'].astype(str)
        # Convert numeric columns to string to avoid mixed types
        for col in ['Applications', 'Admits', 'Enrollments']:
            df[col] = df[col].astype(str)
        
        df = pd.concat([df, pd.DataFrame([change_row])], ignore_index=True)
    
    st.dataframe(df, width="stretch", hide_index=True)


def render_category_yoy(summary_stats: dict):
    """Render YoY comparison by category."""
    categories = summary_stats.get('by_category', {})
    
    if not categories:
        st.info("Category data not available")
        return
    
    data = []
    for category, years in categories.items():
        if not category:
            continue
        
        m_25 = years.get(2025)
        m_26 = years.get(2026)
        
        if m_25 and m_26:
            apps_change = (m_26.applications - m_25.applications) / m_25.applications * 100 if m_25.applications > 0 else 0
            
            data.append({
                'Category': category,
                'Apps 2025': m_25.applications,
                'Apps 2026': m_26.applications,
                'Change': apps_change,
                'Enrolls 2025': m_25.enrollments,
                'Enrolls 2026': m_26.enrollments
            })
    
    if not data:
        return
    
    df = pd.DataFrame(data).sort_values('Change', ascending=False)
    
    # Bar chart
    fig = go.Figure()
    
    colors = [CHART_SUCCESS if x > 0 else STEVENS_RED for x in df['Change']]
    
    fig.add_trace(go.Bar(
        x=df['Category'],
        y=df['Change'],
        marker_color=colors,
        text=df['Change'].apply(lambda x: f"+{x:.1f}%" if x > 0 else f"{x:.1f}%"),
        textposition='outside'
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=20, t=20, b=100),
        xaxis=dict(gridcolor='#333', tickangle=45),
        yaxis=dict(gridcolor='#333', title='YoY % Change'),
        showlegend=False
    )
    
    fig.add_hline(y=0, line_dash="dash", line_color=STEVENS_GRAY_LIGHT)
    
    st.plotly_chart(fig, width="stretch")


def render_school_yoy(summary_stats: dict):
    """Render YoY comparison by school."""
    schools = summary_stats.get('by_school', {})
    
    if not schools:
        st.info("School data not available")
        return
    
    data = []
    for school, years in schools.items():
        if not school:
            continue
        
        for year in [2024, 2025, 2026]:
            m = years.get(year)
            if m:
                data.append({
                    'School': school,
                    'Year': year,
                    'Applications': m.applications,
                    'Enrollments': m.enrollments
                })
    
    if not data:
        return
    
    df = pd.DataFrame(data)
    
    # Grouped bar chart
    fig = go.Figure()
    
    colors = {2024: STEVENS_GRAY_LIGHT, 2025: STEVENS_GRAY_DARK, 2026: STEVENS_RED}
    
    for year in [2024, 2025, 2026]:
        year_data = df[df['Year'] == year]
        fig.add_trace(go.Bar(
            name=str(year),
            x=year_data['School'],
            y=year_data['Applications'],
            marker_color=colors[year],
            text=year_data['Applications'],
            textposition='outside'
        ))
    
    fig.update_layout(
        barmode='group',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=20, t=20, b=40),
        xaxis=dict(gridcolor='#333'),
        yaxis=dict(gridcolor='#333', title='Applications'),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render_rates_over_time(summary_stats: dict):
    """Render admit rate and yield rate trends."""
    years = [2024, 2025, 2026]
    
    admit_rates = []
    yield_rates = []
    
    for year in years:
        m = summary_stats['overall'].get(year)
        if m:
            admit_rates.append(m.admit_rate)
            yield_rates.append(m.yield_rate)
        else:
            admit_rates.append(0)
            yield_rates.append(0)
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=years,
        y=admit_rates,
        mode='lines+markers+text',
        name='Admit Rate',
        line=dict(color=STEVENS_GRAY_DARK, width=3),
        marker=dict(size=10),
        text=[f"{r:.1f}%" for r in admit_rates],
        textposition='top center'
    ))
    
    fig.add_trace(go.Scatter(
        x=years,
        y=yield_rates,
        mode='lines+markers+text',
        name='Yield Rate',
        line=dict(color=CHART_SUCCESS, width=3),
        marker=dict(size=10),
        text=[f"{r:.1f}%" for r in yield_rates],
        textposition='bottom center'
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=40, t=40, b=40),
        xaxis=dict(
            tickmode='array',
            tickvals=years,
            ticktext=[str(y) for y in years],
            gridcolor='#333'
        ),
        yaxis=dict(gridcolor='#333', ticksuffix='%'),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render_enrollment_by_category(summary_stats: dict):
    """Render a pie chart of enrollments by category."""
    categories = summary_stats.get('by_category', {})
    
    if not categories:
        st.info("Category breakdown not available")
        return
    
    # Create pie chart for category distribution
    labels = []
    values = []
    
    for category, years in categories.items():
        if 2026 in years and category:
            metrics = years[2026]
            if metrics.enrollments > 0:
                labels.append(category)
                values.append(metrics.enrollments)
    
    if not labels:
        st.info("No enrollment data by category")
        return
    
    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=0.4,
        marker=dict(colors=[STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, CHART_SUCCESS, '#6366f1', '#f59e0b'])
    )])
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=300,
        margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.3,
            xanchor="center",
            x=0.5
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render(data: dict):
    """Main render function for the Historical & YoY page."""
    st.markdown("## Historical & YoY Analysis")
    st.markdown("Track trends over time and analyze year-over-year performance based on enrollment date.")
    
    st.markdown("---")
    
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
    
    # Multi-metric trend chart
    st.markdown("### 3-Year Enrollment Funnel Trends")
    render_multi_metric_trends(summary_stats)
    
    # Two columns - YoY table and enrollment breakdown
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Year-over-Year Summary")
        render_yoy_table(summary_stats)
    
    with col2:
        st.markdown("### 2026 Enrollments by Category")
        render_enrollment_by_category(summary_stats)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Applications by School (3-Year)")
        render_school_yoy(summary_stats)
    
    with col2:
        st.markdown("### Conversion Rates Over Time")
        render_rates_over_time(summary_stats)
    
    st.markdown("---")
    
    st.markdown("### YoY Change by Category")
    render_category_yoy(summary_stats)
    
    st.markdown("---")
    
    # Individual metric selectors
    st.markdown("### Explore Individual Metrics")
    
    metric = st.selectbox(
        "Select metric to analyze",
        ['applications', 'admits', 'enrollments'],
        format_func=lambda x: x.title()
    )
    
    render_trend_chart(summary_stats, metric)
