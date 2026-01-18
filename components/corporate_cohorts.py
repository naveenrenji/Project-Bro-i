"""
Corporate Cohorts component for the CPE Funnel Dashboard.
Displays corporate partner analytics and enrollment data.
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from utils.formatting import format_number, format_percent
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_SUCCESS, CHART_COLORS
)


def render_corporate_summary_cards(corporate_stats: pd.DataFrame):
    """Render summary cards for corporate metrics."""
    if corporate_stats is None or corporate_stats.empty:
        return
    
    total_companies = len(corporate_stats['Company'].unique())
    total_enrollments = int(corporate_stats['Enrollments'].sum())
    total_applications = int(corporate_stats['Applications'].sum()) if 'Applications' in corporate_stats.columns else None
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown(f"""
            <div style="
                background: {BACKGROUND_CARD};
                border-radius: 4px;
                padding: 20px;
                border-left: 3px solid {STEVENS_RED};
                text-align: center;
            ">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Corporate Partners</div>
                <div style="font-size: 24px; font-weight: 600; color: {STEVENS_WHITE};">{format_number(total_companies)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
            <div style="
                background: {BACKGROUND_CARD};
                border-radius: 4px;
                padding: 20px;
                border-left: 3px solid {CHART_SUCCESS};
                text-align: center;
            ">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Corporate Enrollments</div>
                <div style="font-size: 26px; font-weight: 700; color: {CHART_SUCCESS};">{format_number(total_enrollments)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col3:
        app_value = format_number(total_applications) if total_applications is not None else "N/A"
        st.markdown(f"""
            <div style="
                background: {BACKGROUND_CARD};
                border-radius: 4px;
                padding: 20px;
                border-left: 3px solid {STEVENS_GRAY_DARK};
                text-align: center;
            ">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Corporate Applications</div>
                <div style="font-size: 24px; font-weight: 600; color: {STEVENS_WHITE};">{app_value}</div>
            </div>
        """, unsafe_allow_html=True)


def render_top_corporate_partners(corporate_stats: pd.DataFrame, n: int = 10):
    """Render top corporate partners by enrollment."""
    if corporate_stats is None or corporate_stats.empty:
        st.info("Corporate data not available")
        return
    
    # Get top N by enrollments
    df = corporate_stats.nlargest(n, 'Enrollments')
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        y=df['Company'].tolist()[::-1],
        x=df['Enrollments'].tolist()[::-1],
        orientation='h',
        marker_color=CHART_SUCCESS,
        name='Enrollments',
        text=df['Enrollments'].tolist()[::-1],
        textposition='inside'
    ))
    
    if 'Applications' in df.columns:
        fig.add_trace(go.Bar(
            y=df['Company'].tolist()[::-1],
            x=df['Applications'].tolist()[::-1],
            orientation='h',
            marker_color=STEVENS_RED,
            name='Applications',
            text=df['Applications'].tolist()[::-1],
            textposition='inside',
            opacity=0.5
        ))
    
    fig.update_layout(
        barmode='overlay',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=400,
        margin=dict(l=20, r=20, t=20, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        xaxis=dict(gridcolor='#333', title='Count'),
        yaxis=dict(gridcolor='#333')
    )
    
    st.plotly_chart(fig, width="stretch")


def render_corporate_pie_chart(corporate_stats: pd.DataFrame):
    """Render a pie chart of corporate enrollment distribution."""
    if corporate_stats is None or corporate_stats.empty:
        return
    
    # Get top 8 and group rest as "Other"
    df = corporate_stats.copy()
    if len(df) > 8:
        top_8 = df.nlargest(8, 'Enrollments')
        other_sum = df[~df['Company'].isin(top_8['Company'])]['Enrollments'].sum()
        
        labels = top_8['Company'].tolist() + ['Other']
        values = top_8['Enrollments'].tolist() + [int(other_sum)]
    else:
        labels = df['Company'].tolist()
        values = df['Enrollments'].tolist()
    
    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=0.4,
        marker_colors=CHART_COLORS[:len(labels)],
        textinfo='label+percent',
        textposition='outside',
        textfont=dict(size=10, color=STEVENS_WHITE)
    )])
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=400,
        margin=dict(l=20, r=20, t=20, b=20),
        showlegend=False
    )
    
    st.plotly_chart(fig, width="stretch")


def render_corporate_table(corporate_stats: pd.DataFrame):
    """Render the full corporate partners table."""
    if corporate_stats is None or corporate_stats.empty:
        st.info("Corporate data not available")
        return
    
    display_df = corporate_stats.copy()
    
    # Add conversion rate if we have both applications and enrollments
    if 'Applications' in display_df.columns and 'Enrollments' in display_df.columns:
        display_df['Conversion Rate'] = display_df.apply(
            lambda row: f"{row['Enrollments'] / row['Applications'] * 100:.1f}%" if row['Applications'] > 0 else "N/A",
            axis=1
        )
    
    st.dataframe(display_df, width="stretch", hide_index=True, height=400)


def render_cohort_from_census(census_df: pd.DataFrame):
    """Render corporate cohort data from census file."""
    if census_df is None or census_df.empty:
        return
    
    cohort_col = 'Census_1_CORPORATE_COHORT'
    if cohort_col not in census_df.columns:
        st.info("Corporate cohort data not available in census")
        return
    
    # Filter for rows with cohort data
    cohort_df = census_df[census_df[cohort_col].notna() & (census_df[cohort_col] != '')].copy()
    
    if cohort_df.empty:
        st.info("No corporate cohort data found")
        return
    
    st.markdown("### Census Corporate Cohorts")
    
    # Aggregate by cohort
    cohort_summary = cohort_df.groupby(cohort_col).agg({
        'Census_1_STUDENT_ID': 'nunique'
    }).reset_index()
    cohort_summary.columns = ['Cohort', 'Students']
    cohort_summary = cohort_summary.sort_values('Students', ascending=False)
    
    # Top cohorts chart
    top_cohorts = cohort_summary.head(10)
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        x=top_cohorts['Cohort'],
        y=top_cohorts['Students'],
        marker_color=STEVENS_RED,
        text=top_cohorts['Students'],
        textposition='outside'
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=20, t=20, b=100),
        xaxis=dict(
            gridcolor='#333',
            tickangle=45,
            tickfont=dict(size=9)
        ),
        yaxis=dict(gridcolor='#333', title='Students')
    )
    
    st.plotly_chart(fig, width="stretch")
    
    # Full table
    st.markdown("#### All Corporate Cohorts")
    st.dataframe(cohort_summary, width="stretch", hide_index=True)


def render(data: dict):
    """Main render function for the Corporate Cohorts page."""
    st.markdown("## Corporate Cohorts")
    
    census_df = data.get('census', {}).get('raw_df')
    if census_df is None or census_df.empty:
        st.warning("No census data available for corporate cohorts.")
        return
    
    cohort_col = 'Census_1_CORPORATE_COHORT'
    student_id_col = 'Census_1_STUDENT_ID'
    if cohort_col not in census_df.columns:
        st.warning("Corporate cohort field not found in census data.")
        return
    
    cohort_df = census_df[census_df[cohort_col].notna() & (census_df[cohort_col] != '')].copy()
    if cohort_df.empty:
        st.warning("No corporate cohort data found in census.")
        return

    # -----------------------------
    # Census headcount intelligence
    # -----------------------------
    status_col = "Census_1_STUDENT_STATUS"
    program_col = "Census_1_PROGRAM_OF_STUDY" if "Census_1_PROGRAM_OF_STUDY" in cohort_df.columns else None
    if program_col is None and "Census_1_PRIMARY_PROGRAM_OF_STUDY" in cohort_df.columns:
        program_col = "Census_1_PRIMARY_PROGRAM_OF_STUDY"

    total_students = cohort_df[student_id_col].nunique()
    status_counts = {}
    if status_col in cohort_df.columns:
        status_counts = (
            cohort_df.groupby(status_col)[student_id_col]
            .nunique()
            .to_dict()
        )
    new_count = int(status_counts.get("New", 0))
    continuing_count = int(status_counts.get("Continuing", 0))
    returning_count = int(status_counts.get("Returning", 0))

    st.markdown("### Headcount Intelligence (Census)")
    k1, k2, k3, k4 = st.columns(4)
    with k1:
        st.metric("Corporate Headcount", format_number(int(total_students)))
    with k2:
        st.metric("New", format_number(new_count))
    with k3:
        st.metric("Continuing", format_number(continuing_count))
    with k4:
        pct_new = (new_count / total_students) if total_students else 0
        st.metric("% New", format_percent(pct_new))

    # Cohort headcount table with status breakdown
    cohort_headcount = (
        cohort_df.groupby(cohort_col)[student_id_col]
        .nunique()
        .reset_index()
        .rename(columns={cohort_col: "Cohort", student_id_col: "Headcount"})
        .sort_values("Headcount", ascending=False)
    )

    if status_col in cohort_df.columns:
        cohort_status = (
            cohort_df.groupby([cohort_col, status_col])[student_id_col]
            .nunique()
            .reset_index()
            .pivot(index=cohort_col, columns=status_col, values=student_id_col)
            .fillna(0)
            .reset_index()
            .rename(columns={cohort_col: "Cohort"})
        )
        for c in cohort_status.columns:
            if c != "Cohort":
                cohort_status[c] = cohort_status[c].astype(int)
        cohort_headcount = cohort_headcount.merge(cohort_status, on="Cohort", how="left")

    st.markdown("#### Corporate Cohort Headcount (Census)")
    st.dataframe(cohort_headcount, width="stretch", hide_index=True, height=380)

    # Optional: top programs within corporate cohorts
    if program_col and program_col in cohort_df.columns:
        prog_headcount = (
            cohort_df.groupby(program_col)[student_id_col]
            .nunique()
            .reset_index()
            .rename(columns={program_col: "Program", student_id_col: "Headcount"})
            .sort_values("Headcount", ascending=False)
            .head(12)
        )

        st.markdown("#### Top Programs Within Corporate Cohorts (Census Headcount)")
        fig = go.Figure()
        fig.add_trace(
            go.Bar(
                y=prog_headcount["Program"].tolist()[::-1],
                x=prog_headcount["Headcount"].tolist()[::-1],
                orientation="h",
                marker_color=STEVENS_RED,
                text=prog_headcount["Headcount"].tolist()[::-1],
                textposition="inside",
            )
        )
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font={"color": STEVENS_WHITE},
            height=420,
            margin=dict(l=20, r=20, t=10, b=40),
            xaxis=dict(gridcolor="#333", title="Students"),
            yaxis=dict(gridcolor="#333"),
            showlegend=False,
        )
        st.plotly_chart(fig, width="stretch")
    
    corporate_stats = (
        cohort_df.groupby(cohort_col)
        .agg(Enrollments=(student_id_col, 'nunique'))
        .reset_index()
        .rename(columns={cohort_col: 'Company'})
        .sort_values('Enrollments', ascending=False)
    )
    
    # Summary cards
    render_corporate_summary_cards(corporate_stats)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Top Corporate Cohorts")
        render_top_corporate_partners(corporate_stats)
    
    with col2:
        st.markdown("### Enrollment Distribution")
        render_corporate_pie_chart(corporate_stats)
    
    st.markdown("---")
    
    st.markdown("### All Corporate Cohorts")
    render_corporate_table(corporate_stats)

