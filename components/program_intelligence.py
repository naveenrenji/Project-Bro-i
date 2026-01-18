"""
Program Intelligence component for the CPE Funnel Dashboard.
Displays program-level analytics, heatmaps, and comparisons.
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from utils.formatting import format_number, format_percent
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_SUCCESS, CHART_COLORS
)


def render_program_heatmap(program_stats: pd.DataFrame):
    """Render a heatmap of programs vs metrics."""
    if program_stats is None or program_stats.empty:
        st.info("Program data not available")
        return
    
    # Select top 15 programs by applications
    df = program_stats.head(15).copy()
    
    # Prepare data for heatmap
    programs = df['Program'].tolist()
    metrics = ['Applications 2026', 'Admits 2026', 'Enrollments 2026']
    
    z_data = []
    for metric in metrics:
        if metric in df.columns:
            z_data.append(df[metric].tolist())
        else:
            z_data.append([0] * len(programs))
    
    # Normalize for better visualization
    z_normalized = []
    for row in z_data:
        max_val = max(row) if max(row) > 0 else 1
        z_normalized.append([v / max_val * 100 for v in row])
    
    fig = go.Figure(data=go.Heatmap(
        z=z_normalized,
        x=programs,
        y=['Applications', 'Admits', 'Enrollments'],
        text=z_data,
        texttemplate="%{text}",
        textfont={"size": 10, "color": "white"},
        colorscale=[
            [0, BACKGROUND_CARD],
            [0.25, '#3D2A35'],
            [0.5, '#6B2945'],
            [0.75, STEVENS_RED],
            [1, '#E31B54']
        ],
        showscale=True,
        colorbar=dict(title="Relative %", ticksuffix="%")
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE, 'size': 10},
        height=320,
        margin=dict(l=20, r=20, t=30, b=120),
        xaxis=dict(
            tickangle=45,
            tickfont=dict(size=9),
            automargin=True
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render_top_programs(program_stats: pd.DataFrame, n: int = 10):
    """Render top programs by enrollments."""
    if program_stats is None or program_stats.empty:
        st.info("Program data not available")
        return
    
    df = program_stats.head(n).copy()
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        y=df['Program'].tolist()[::-1],
        x=df['Enrollments 2026'].tolist()[::-1],
        orientation='h',
        marker_color=CHART_SUCCESS,
        name='Enrollments',
        text=df['Enrollments 2026'].tolist()[::-1],
        textposition='inside'
    ))
    
    fig.add_trace(go.Bar(
        y=df['Program'].tolist()[::-1],
        x=df['Applications 2026'].tolist()[::-1],
        orientation='h',
        marker_color=STEVENS_RED,
        name='Applications',
        text=df['Applications 2026'].tolist()[::-1],
        textposition='inside',
        opacity=0.6
    ))
    
    fig.update_layout(
        barmode='overlay',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE, 'size': 11},
        height=400,
        margin=dict(l=20, r=20, t=20, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        xaxis=dict(gridcolor='#333'),
        yaxis=dict(gridcolor='#333')
    )
    
    st.plotly_chart(fig, width="stretch")


def render_program_trends(program_stats: pd.DataFrame):
    """Render trending programs (highest YoY growth)."""
    if program_stats is None or program_stats.empty:
        st.info("Program data not available")
        return
    
    # Filter for programs with significant previous year data
    df = program_stats[program_stats['Applications 2025'] >= 5].copy()
    
    if df.empty:
        st.info("Not enough historical data for trend analysis")
        return
    
    # Top gainers
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### Top Gainers")
        gainers = df.nlargest(5, 'Apps YoY %')[['Program', 'Applications 2026', 'Applications 2025', 'Apps YoY %']]
        if not gainers.empty:
            gainers_display = gainers.copy()
            gainers_display['Apps YoY %'] = gainers_display['Apps YoY %'].apply(lambda x: f"+{x:.1f}%" if x > 0 else f"{x:.1f}%")
            st.dataframe(gainers_display, width="stretch", hide_index=True)
    
    with col2:
        st.markdown("#### Needs Attention")
        decliners = df.nsmallest(5, 'Apps YoY %')[['Program', 'Applications 2026', 'Applications 2025', 'Apps YoY %']]
        if not decliners.empty:
            decliners_display = decliners.copy()
            decliners_display['Apps YoY %'] = decliners_display['Apps YoY %'].apply(lambda x: f"{x:.1f}%")
            st.dataframe(decliners_display, width="stretch", hide_index=True)


def render_program_comparison(program_stats: pd.DataFrame):
    """Render an interactive program comparison."""
    if program_stats is None or program_stats.empty:
        st.info("Program data not available")
        return
    
    programs = program_stats['Program'].tolist()
    
    selected_programs = st.multiselect(
        "Select programs to compare",
        programs,
        default=programs[:3] if len(programs) >= 3 else programs
    )
    
    if not selected_programs:
        st.info("Select at least one program to compare")
        return
    
    df = program_stats[program_stats['Program'].isin(selected_programs)].copy()
    
    # Radar chart for comparison
    categories = ['Applications', 'Admits', 'Enrollments', 'Admit Rate', 'Yield Rate']
    
    fig = go.Figure()
    
    for i, (_, row) in enumerate(df.iterrows()):
        # Normalize values for radar
        max_apps = program_stats['Applications 2026'].max()
        max_admits = program_stats['Admits 2026'].max()
        max_enrolls = program_stats['Enrollments 2026'].max()
        
        values = [
            row['Applications 2026'] / max_apps * 100 if max_apps > 0 else 0,
            row['Admits 2026'] / max_admits * 100 if max_admits > 0 else 0,
            row['Enrollments 2026'] / max_enrolls * 100 if max_enrolls > 0 else 0,
            row['Admit Rate 2026'],
            row['Yield Rate 2026']
        ]
        values.append(values[0])  # Close the polygon
        
        fig.add_trace(go.Scatterpolar(
            r=values,
            theta=categories + [categories[0]],
            name=row['Program'][:30],  # Truncate long names
            line_color=CHART_COLORS[i % len(CHART_COLORS)],
            fill='toself',
            opacity=0.6
        ))
    
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 100],
                tickfont=dict(color=STEVENS_GRAY_LIGHT),
                gridcolor='#333'
            ),
            angularaxis=dict(
                tickfont=dict(color=STEVENS_WHITE),
                gridcolor='#333'
            ),
            bgcolor='rgba(0,0,0,0)'
        ),
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=400,
        margin=dict(l=60, r=60, t=40, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.2,
            xanchor="center",
            x=0.5,
            font=dict(size=10)
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render_program_table(program_stats: pd.DataFrame):
    """Render the full program statistics table."""
    if program_stats is None or program_stats.empty:
        st.info("Program data not available")
        return
    
    display_df = program_stats.copy()
    
    # Format columns
    display_df['Admit Rate 2026'] = display_df['Admit Rate 2026'].apply(lambda x: f"{x:.1f}%")
    display_df['Yield Rate 2026'] = display_df['Yield Rate 2026'].apply(lambda x: f"{x:.1f}%")
    display_df['Apps YoY %'] = display_df['Apps YoY %'].apply(
        lambda x: f"+{x:.1f}%" if x > 0 else f"{x:.1f}%"
    )
    
    # Select columns to display
    cols_to_show = ['Program', 'School', 'Degree Type', 
                    'Applications 2026', 'Admits 2026', 'Enrollments 2026',
                    'Admit Rate 2026', 'Yield Rate 2026', 'Apps YoY %']
    
    display_df = display_df[[c for c in cols_to_show if c in display_df.columns]]
    
    st.dataframe(
        display_df,
        width="stretch",
        hide_index=True,
        height=500
    )


def render_programs_by_school(program_stats: pd.DataFrame):
    """Render programs grouped by school."""
    if program_stats is None or program_stats.empty:
        st.info("Program data not available")
        return
    
    # Group by school
    school_summary = program_stats.groupby('School').agg({
        'Program': 'count',
        'Applications 2026': 'sum',
        'Admits 2026': 'sum',
        'Enrollments 2026': 'sum'
    }).reset_index()
    school_summary.columns = ['School', 'Programs', 'Applications', 'Admits', 'Enrollments']
    
    fig = go.Figure()
    
    school_list = school_summary['School'].tolist()
    
    fig.add_trace(go.Bar(
        name='Applications',
        x=school_list,
        y=school_summary['Applications'].tolist(),
        marker_color=STEVENS_RED,
        text=school_summary['Applications'].tolist(),
        textposition='outside'
    ))
    
    fig.add_trace(go.Bar(
        name='Admits',
        x=school_list,
        y=school_summary['Admits'].tolist(),
        marker_color=STEVENS_GRAY_DARK,
        text=school_summary['Admits'].tolist(),
        textposition='outside'
    ))
    
    fig.add_trace(go.Bar(
        name='Enrollments',
        x=school_list,
        y=school_summary['Enrollments'].tolist(),
        marker_color=CHART_SUCCESS,
        text=school_summary['Enrollments'].tolist(),
        textposition='outside'
    ))
    
    fig.update_layout(
        barmode='group',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=20, t=40, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        xaxis=dict(gridcolor='#333'),
        yaxis=dict(gridcolor='#333')
    )
    
    st.plotly_chart(fig, width="stretch")


def render(data: dict):
    """Main render function for the Program Intelligence page."""
    st.markdown("## Program Intelligence")
    st.markdown("Analyze performance metrics across all graduate programs.")
    
    st.markdown("---")
    
    # Calculate program stats
    from analytics import calculate_program_stats
    
    apps_data = data.get('applications', {})
    
    program_stats = calculate_program_stats(
        apps_data.get('current'),
        apps_data.get('previous')
    )
    
    if program_stats.empty:
        st.warning("Application data not available for program analysis.")
        return
    
    # Program heatmap
    st.markdown("### Program Performance Heatmap")
    render_program_heatmap(program_stats)
    
    # School breakdown
    st.markdown("### Programs by School")
    render_programs_by_school(program_stats)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Top Programs by Enrollment")
        render_top_programs(program_stats)
    
    with col2:
        st.markdown("### Program Trends (YoY)")
        render_program_trends(program_stats)
    
    st.markdown("---")
    
    # Program comparison
    st.markdown("### Program Comparison")
    render_program_comparison(program_stats)
    
    st.markdown("---")
    
    # Full table
    st.markdown("### All Programs")
    
    # Filters
    col1, col2, col3 = st.columns(3)
    with col1:
        schools = ["All"] + [s for s in program_stats['School'].unique().tolist() if s]
        school_filter = st.selectbox("Filter by School", schools)
    with col2:
        degrees = ["All"] + [d for d in program_stats['Degree Type'].unique().tolist() if d]
        degree_filter = st.selectbox("Filter by Degree Type", degrees)
    with col3:
        sort_by = st.selectbox(
            "Sort by",
            ['Applications 2026', 'Enrollments 2026', 'Apps YoY %', 'Yield Rate 2026']
        )
    
    filtered_df = program_stats.copy()
    if school_filter != "All":
        filtered_df = filtered_df[filtered_df['School'] == school_filter]
    if degree_filter != "All":
        filtered_df = filtered_df[filtered_df['Degree Type'] == degree_filter]
    
    filtered_df = filtered_df.sort_values(sort_by, ascending=False)
    
    render_program_table(filtered_df)
