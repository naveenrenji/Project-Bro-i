"""
NTR Tracker component for the CPE Funnel Dashboard.
Displays Net Tuition Revenue analysis with category and degree breakdowns.
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from utils.formatting import format_currency, format_number, format_percent
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_SUCCESS, CHART_WARNING, CHART_COLORS
)


def render_ntr_summary_cards(ntr_summary):
    """Render summary cards for NTR metrics."""
    if ntr_summary is None:
        st.warning("NTR data not available")
        return
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
            <div class="cpe-card cpe-card--accent-left" style="--cpe-accent: {CHART_SUCCESS}; text-align: center;">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Total NTR</div>
                <div style="font-size: 28px; font-weight: 700; color: {CHART_SUCCESS};">{format_currency(ntr_summary.total_ntr)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
            <div class="cpe-card cpe-card--accent-left" style="--cpe-accent: {STEVENS_RED}; text-align: center;">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">NTR Goal</div>
                <div style="font-size: 24px; font-weight: 600; color: {STEVENS_WHITE};">{format_currency(ntr_summary.ntr_goal)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col3:
        progress_color = CHART_SUCCESS if ntr_summary.percentage_of_goal >= 100 else CHART_WARNING if ntr_summary.percentage_of_goal >= 75 else STEVENS_RED
        st.markdown(f"""
            <div class="cpe-card cpe-card--accent-left" style="--cpe-accent: {progress_color}; text-align: center;">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Progress</div>
                <div style="font-size: 26px; font-weight: 700; color: {progress_color};">{format_percent(ntr_summary.percentage_of_goal)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col4:
        gap_color = CHART_SUCCESS if ntr_summary.gap_to_goal <= 0 else STEVENS_RED
        gap_label = "Surplus" if ntr_summary.gap_to_goal <= 0 else "Gap to Goal"
        st.markdown(f"""
            <div class="cpe-card cpe-card--accent-left" style="--cpe-accent: {gap_color}; text-align: center;">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">{gap_label}</div>
                <div style="font-size: 24px; font-weight: 600; color: {gap_color};">{format_currency(abs(ntr_summary.gap_to_goal))}</div>
            </div>
        """, unsafe_allow_html=True)


def render_ntr_progress_bar(ntr_summary):
    """Render a visual progress bar for NTR vs Goal."""
    if ntr_summary is None:
        return
    
    # Use a pure gauge + centered annotation.
    # Plotly's built-in "number" rendering can appear off-center/clipped in some container widths.
    fig = go.Figure(go.Indicator(
        mode="gauge",
        value=ntr_summary.percentage_of_goal,
        gauge={
            'axis': {'range': [0, 120], 'ticksuffix': '%', 'tickcolor': STEVENS_GRAY_LIGHT},
            'bar': {'color': STEVENS_RED, 'thickness': 0.75},
            'bgcolor': BACKGROUND_CARD,
            'borderwidth': 0,
            'steps': [
                {'range': [0, 50], 'color': '#2D3748'},
                {'range': [50, 75], 'color': '#3D4A5C'},
                {'range': [75, 100], 'color': STEVENS_GRAY_DARK},
                {'range': [100, 120], 'color': '#2D5A27'},
            ],
            'threshold': {
                'line': {'color': CHART_SUCCESS, 'width': 4},
                'thickness': 0.8,
                'value': 100
            }
        }
    ))
    
    fig.add_annotation(
        text=f"{ntr_summary.percentage_of_goal:.1f}%",
        x=0.5,
        y=0.28,
        xanchor="center",
        yanchor="middle",
        showarrow=False,
        font=dict(size=34, color=STEVENS_WHITE),
    )

    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=280,
        margin=dict(l=20, r=20, t=20, b=20)
    )
    
    st.plotly_chart(fig, width="stretch")


def render_ntr_by_category(breakdown_df: pd.DataFrame):
    """Render NTR breakdown by student category."""
    if breakdown_df is None or breakdown_df.empty:
        st.info("Category breakdown not available")
        return
    
    # Filter out the Grand Total row
    df = breakdown_df[breakdown_df['Category'] != 'Grand Total'].copy()
    
    # Group by category
    category_totals = df.groupby('Category').agg({
        'Total Students': 'sum',
        'Total Credits': 'sum',
        'Total NTR': 'sum'
    }).reset_index().sort_values('Total NTR', ascending=True)
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        y=category_totals['Category'],
        x=category_totals['Total NTR'],
        orientation='h',
        marker_color=CHART_COLORS[:len(category_totals)],
        text=category_totals['Total NTR'].apply(lambda x: format_currency(x)),
        textposition='inside',
        textfont=dict(color='white', size=12)
    ))
    
    # Dynamic height based on number of categories (min 50px per bar + padding)
    num_categories = len(category_totals)
    chart_height = max(350, num_categories * 55 + 80)
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=chart_height,
        margin=dict(l=20, r=20, t=20, b=40),
        xaxis=dict(
            gridcolor='#333',
            tickformat='$,.0s'
        ),
        yaxis=dict(gridcolor='#333', automargin=True)
    )
    
    st.plotly_chart(fig, width="stretch")


def render_ntr_by_student_type(ntr_summary):
    """Render NTR breakdown by New vs Current students."""
    if ntr_summary is None:
        return
    
    labels = ['New Students', 'Current Students']
    values = [ntr_summary.new_ntr, ntr_summary.current_ntr]
    
    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=0.5,
        marker_colors=[STEVENS_RED, STEVENS_GRAY_DARK],
        textinfo='label+percent',
        textposition='outside',
        textfont=dict(size=12, color=STEVENS_WHITE)
    )])
    
    # Add center text
    fig.add_annotation(
        text=f"Total<br>{format_currency(ntr_summary.total_ntr)}",
        x=0.5, y=0.5,
        font=dict(size=14, color=STEVENS_WHITE),
        showarrow=False
    )
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE},
        height=350,
        margin=dict(l=40, r=40, t=30, b=50),
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.15,
            xanchor="center",
            x=0.5
        )
    )
    
    st.plotly_chart(fig, width="stretch")


def render_ntr_breakdown_table(breakdown_df: pd.DataFrame):
    """Render the detailed NTR breakdown table."""
    if breakdown_df is None or breakdown_df.empty:
        st.info("Breakdown data not available")
        return
    
    # Format the DataFrame for display
    display_df = breakdown_df.copy()
    
    # Format currency columns
    currency_cols = ['CPC New', 'CPC Current', 'NTR New', 'NTR Current', 'Total NTR']
    for col in currency_cols:
        if col in display_df.columns:
            display_df[col] = display_df[col].apply(
                lambda x: format_currency(x) if pd.notna(x) and x != '' else ''
            )
    
    # Format number columns
    number_cols = ['New Students', 'Current Students', 'Total Students', 
                   'New Credits', 'Current Credits', 'Total Credits']
    for col in number_cols:
        if col in display_df.columns:
            display_df[col] = display_df[col].apply(
                lambda x: format_number(x) if pd.notna(x) else ''
            )
    
    st.dataframe(display_df, width="stretch", hide_index=True, height=400)


def render_cpc_rates_table():
    """Render the CPC rates reference table."""
    from ntr_calculator import get_cpc_rates_table
    
    rates_df = get_cpc_rates_table()
    
    st.dataframe(rates_df, width="stretch", hide_index=True)


def render_credits_breakdown(ntr_summary):
    """Render a breakdown of credits by student type."""
    if ntr_summary is None:
        return
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown(f"""
            <div class="cpe-card cpe-card--tight cpe-card--accent-left" style="--cpe-accent: {STEVENS_RED}; margin-bottom: 10px;">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT};">New Students</div>
                <div style="font-size: 18px; font-weight: 600; color: {STEVENS_WHITE};">{format_number(ntr_summary.new_students)} students</div>
                <div style="font-size: 14px; color: {STEVENS_RED};">{format_number(ntr_summary.new_credits)} credits</div>
                <div style="font-size: 18px; font-weight: 700; color: {CHART_SUCCESS}; margin-top: 5px;">{format_currency(ntr_summary.new_ntr)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
            <div class="cpe-card cpe-card--tight cpe-card--accent-left" style="--cpe-accent: {STEVENS_GRAY_DARK}; margin-bottom: 10px;">
                <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT};">Current Students</div>
                <div style="font-size: 18px; font-weight: 600; color: {STEVENS_WHITE};">{format_number(ntr_summary.current_students)} students</div>
                <div style="font-size: 14px; color: {STEVENS_RED};">{format_number(ntr_summary.current_credits)} credits</div>
                <div style="font-size: 18px; font-weight: 700; color: {CHART_SUCCESS}; margin-top: 5px;">{format_currency(ntr_summary.current_ntr)}</div>
            </div>
        """, unsafe_allow_html=True)


def render(data: dict):
    """Main render function for the NTR Tracker page."""
    st.markdown("## NTR Tracker")
    census_df = data.get('census', {}).get('raw_df')
    if census_df is None or census_df.empty:
        st.warning("Census data not available. NTR calculations require census data.")
        return

    from ntr_calculator import calculate_ntr_from_census

    ntr_summary, category_breakdown, breakdown_df = calculate_ntr_from_census(census_df)

    st.markdown("---")
    st.caption("NTR calculated from census credits and student status (New vs Current).")

    # Summary cards + progress
    render_ntr_summary_cards(ntr_summary)
    st.markdown("<br>", unsafe_allow_html=True)
    render_ntr_progress_bar(ntr_summary)

    st.markdown("---")

    # Category breakdown
    st.markdown("### NTR by Category")
    render_ntr_by_category(breakdown_df)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("### NTR by Student Type")
        render_ntr_by_student_type(ntr_summary)
    with col2:
        st.markdown("### Credits by Student Type")
        render_credits_breakdown(ntr_summary)

    st.markdown("---")
    st.markdown("### Detailed NTR Breakdown")
    render_ntr_breakdown_table(breakdown_df)

    with st.expander("Full CPC Rates Reference"):
        render_cpc_rates_table()
