"""
Enrollment Funnel component for the CPE Funnel Dashboard.
Displays interactive Sankey diagrams and expandable funnel breakdowns.
NOTE: Funnel tracks NEW students only (applications through first-time enrollment).
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from utils.formatting import format_number, format_percent, safe_divide
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_SUCCESS, CHART_COLORS
)


def render_interactive_sankey(summary_stats: dict, expanded: bool = False):
    """
    Render an interactive Sankey diagram showing the complete enrollment funnel.
    Apps → Admits → Offers Accepted → Enrolled with declined/pending branches.
    """
    current = summary_stats['overall'][2026]
    
    # Calculate all values
    apps = current.applications
    admits = current.admits
    not_admitted = max(0, apps - admits)
    offers_accepted = current.offers_accepted
    offers_declined = max(0, admits - offers_accepted)
    enrolled = current.enrollments
    not_enrolled = max(0, offers_accepted - enrolled)
    
    # Define nodes
    labels = [
        f'Applications<br><b>{apps:,}</b>',
        f'Admitted<br><b>{admits:,}</b>',
        f'Not Admitted<br><b>{not_admitted:,}</b>',
        f'Offers Accepted<br><b>{offers_accepted:,}</b>',
        f'Offers Declined/Pending<br><b>{offers_declined:,}</b>',
        f'Enrolled<br><b>{enrolled:,}</b>',
        f'Did Not Enroll<br><b>{not_enrolled:,}</b>',
    ]
    
    node_colors = [
        STEVENS_RED, '#4CAF50', '#666666', '#2E7D32', 
        '#9E9E9E', '#1B5E20', '#757575',
    ]
    
    sources = [0, 0, 1, 1, 3, 3]
    targets = [1, 2, 3, 4, 5, 6]
    values = [admits, not_admitted, offers_accepted, offers_declined, enrolled, not_enrolled]
    
    link_colors = [
        'rgba(76, 175, 80, 0.5)',
        'rgba(100, 100, 100, 0.3)',
        'rgba(46, 125, 50, 0.5)',
        'rgba(158, 158, 158, 0.3)',
        'rgba(27, 94, 32, 0.6)',
        'rgba(117, 117, 117, 0.3)',
    ]
    
    link_labels = [
        f'Admit Rate: {safe_divide(admits, apps) * 100:.1f}%',
        f'Rejection Rate: {safe_divide(not_admitted, apps) * 100:.1f}%',
        f'Offer Accept Rate: {safe_divide(offers_accepted, admits) * 100:.1f}%',
        f'Decline/Pending Rate: {safe_divide(offers_declined, admits) * 100:.1f}%',
        f'Enrollment Rate: {safe_divide(enrolled, offers_accepted) * 100:.1f}%',
        f'Melt Rate: {safe_divide(not_enrolled, offers_accepted) * 100:.1f}%',
    ]
    
    fig = go.Figure(data=[go.Sankey(
        arrangement='snap',
        node=dict(
            pad=30,
            thickness=30,
            line=dict(color='#1a1a1a', width=2),
            label=labels,
            color=node_colors,
            hovertemplate='%{label}<extra></extra>'
        ),
        link=dict(
            source=sources,
            target=targets,
            value=values,
            color=link_colors,
            label=link_labels,
            hovertemplate='%{label}<br>%{value:,} students<extra></extra>'
        )
    )])
    
    height = 550 if expanded else 450
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(size=13, color=STEVENS_WHITE, family='Arial'),
        height=height,
        margin=dict(l=30, r=30, t=30, b=30),
        hoverlabel=dict(bgcolor='#1a1f2e', font_size=14, font_family='Arial')
    )
    
    st.plotly_chart(fig, width="stretch", key='main_sankey')


def render_category_sankey_mini(category_name: str, metrics, color_idx: int = 0):
    """Render a mini Sankey for a category."""
    apps = metrics.applications
    admits = metrics.admits
    not_admitted = max(0, apps - admits)
    offers = getattr(metrics, 'offers_accepted', admits)
    offers_declined = max(0, admits - offers)
    enrolled = metrics.enrollments
    not_enrolled = max(0, offers - enrolled)
    
    labels = [
        f'Apps<br>{apps}', f'Admits<br>{admits}', f'Rejected<br>{not_admitted}',
        f'Accepted<br>{offers}', f'Declined<br>{offers_declined}',
        f'Enrolled<br>{enrolled}', f'Melt<br>{not_enrolled}',
    ]
    
    # Use different color schemes for each category
    base_colors = CHART_COLORS[color_idx % len(CHART_COLORS)]
    node_colors = [STEVENS_RED, '#4CAF50', '#555', '#2E7D32', '#888', '#1B5E20', '#666']
    
    sources = [0, 0, 1, 1, 3, 3]
    targets = [1, 2, 3, 4, 5, 6]
    values = [admits, not_admitted, offers, offers_declined, enrolled, not_enrolled]
    
    link_colors = [
        'rgba(76, 175, 80, 0.5)', 'rgba(100, 100, 100, 0.25)',
        'rgba(46, 125, 50, 0.5)', 'rgba(136, 136, 136, 0.25)',
        'rgba(27, 94, 32, 0.6)', 'rgba(100, 100, 100, 0.25)',
    ]
    
    fig = go.Figure(data=[go.Sankey(
        arrangement='snap',
        node=dict(
            pad=20, thickness=20,
            line=dict(color='#1a1a1a', width=1),
            label=labels, color=node_colors,
        ),
        link=dict(source=sources, target=targets, value=values, color=link_colors)
    )])
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(size=10, color=STEVENS_WHITE),
        height=220,
        margin=dict(l=5, r=5, t=5, b=5)
    )
    
    st.plotly_chart(fig, width="stretch", key=f'cat_sankey_{category_name}')


def render_category_grid(summary_stats: dict):
    """Render all category Sankey diagrams in a grid layout."""
    categories = summary_stats.get('by_category', {})
    
    if not categories:
        st.info("Category breakdown not available")
        return
    
    # Sort by applications
    sorted_cats = []
    for cat, years in categories.items():
        if 2026 in years and cat:
            sorted_cats.append((cat, years[2026]))
    sorted_cats.sort(key=lambda x: x[1].applications, reverse=True)
    
    # Create grid - 2 columns
    for i in range(0, len(sorted_cats), 2):
        cols = st.columns(2)
        
        for j, col in enumerate(cols):
            if i + j < len(sorted_cats):
                cat_name, metrics = sorted_cats[i + j]
                with col:
                    admit_rate = metrics.admit_rate
                    yield_rate = metrics.yield_rate
                    
                    st.markdown(f"""
                        <div class="cpe-card cpe-card--tight cpe-card--accent-left" style="--cpe-accent: {CHART_COLORS[(i+j) % len(CHART_COLORS)]}; margin-bottom: 10px;">
                            <div style="font-weight: 600; color: {STEVENS_WHITE}; font-size: 14px;">{cat_name}</div>
                            <div style="color: {STEVENS_GRAY_LIGHT}; font-size: 12px; margin-top: 4px;">
                                {metrics.applications} Apps → {metrics.admits} Admits → {metrics.enrollments} Enrolled
                            </div>
                            <div style="color: {CHART_SUCCESS}; font-size: 13px; font-weight: 700; margin-top: 2px;">
                                Admit: {admit_rate:.0f}% | Yield: {yield_rate:.0f}%
                            </div>
                        </div>
                    """, unsafe_allow_html=True)
                    
                    render_category_sankey_mini(cat_name, metrics, i + j)


def render_funnel_metrics_cards(summary_stats: dict):
    """Render metric cards for each funnel stage."""
    current = summary_stats['overall'][2026]
    previous = summary_stats['overall'][2025]
    
    stages = [
        {'name': 'Applications', 'value': current.applications, 'prev': previous.applications,
         'rate': 100, 'rate_label': 'Base', 'color': STEVENS_RED},
        {'name': 'Admits', 'value': current.admits, 'prev': previous.admits,
         'rate': current.admit_rate, 'rate_label': 'Admit Rate', 'color': '#4CAF50'},
        {'name': 'Offers Accepted', 'value': current.offers_accepted, 'prev': previous.offers_accepted,
         'rate': safe_divide(current.offers_accepted, current.admits) * 100, 'rate_label': 'Accept Rate', 'color': '#2E7D32'},
        {'name': 'Enrolled', 'value': current.enrollments, 'prev': previous.enrollments,
         'rate': current.yield_rate, 'rate_label': 'Yield Rate', 'color': '#1B5E20'}
    ]
    
    cols = st.columns(4)
    
    for i, stage in enumerate(stages):
        with cols[i]:
            yoy_change = safe_divide(stage['value'] - stage['prev'], stage['prev']) * 100
            yoy_color = CHART_SUCCESS if yoy_change >= 0 else STEVENS_RED
            yoy_sign = '+' if yoy_change >= 0 else ''
            
            st.markdown(f"""
                <div class="cpe-card cpe-card--tight cpe-card--accent-left" style="--cpe-accent: {stage['color']}; text-align: center;">
                    <div style="font-size: 12px; color: {STEVENS_GRAY_LIGHT};">{stage['name']}</div>
                    <div style="font-size: 28px; font-weight: 700; color: {STEVENS_WHITE};">{stage['value']:,}</div>
                    <div style="font-size: 13px; font-weight: 700; color: {yoy_color};">{yoy_sign}{yoy_change:.0f}% vs 2025</div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; font-size: 12px; color: {stage['color']};">
                        {stage['rate_label']}: <b>{stage['rate']:.0f}%</b>
                    </div>
                </div>
            """, unsafe_allow_html=True)


def render_conversion_waterfall(summary_stats: dict):
    """Render a waterfall chart showing conversion at each stage."""
    current = summary_stats['overall'][2026]
    
    stages = ['Applications', 'Not Admitted', 'Offers Declined', 'Did Not Enroll', 'Enrolled']
    
    apps = current.applications
    admits = current.admits
    not_admitted = apps - admits
    offers = current.offers_accepted
    declined = admits - offers
    enrolled = current.enrollments
    not_enrolled = offers - enrolled
    
    values = [apps, -not_admitted, -declined, -not_enrolled, enrolled]
    
    fig = go.Figure(go.Waterfall(
        name='Funnel',
        orientation='v',
        measure=['absolute', 'relative', 'relative', 'relative', 'total'],
        x=stages,
        textposition='outside',
        text=[f'{v:,}' if v > 0 else f'{abs(v):,}' for v in values],
        y=values,
        connector={'line': {'color': '#333'}},
        decreasing={'marker': {'color': '#EF5350'}},
        increasing={'marker': {'color': CHART_SUCCESS}},
        totals={'marker': {'color': '#1B5E20'}}
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color=STEVENS_WHITE, size=11),
        height=350,
        margin=dict(l=40, r=40, t=40, b=40),
        showlegend=False,
        yaxis=dict(gridcolor='#333'),
        xaxis=dict(gridcolor='#333')
    )
    
    st.plotly_chart(fig, width="stretch")


def render_funnel_by_school(summary_stats: dict):
    """Render funnel by school."""
    schools = summary_stats.get('by_school', {})
    
    if not schools:
        return
    
    school_names, apps, admits, enrollments = [], [], [], []
    
    for school, years in schools.items():
        if 2026 in years and school:
            metrics = years[2026]
            school_names.append(school)
            apps.append(metrics.applications)
            admits.append(metrics.admits)
            enrollments.append(metrics.enrollments)
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(name='Applications', x=school_names, y=apps, marker_color=STEVENS_RED,
                         text=apps, textposition='outside'))
    fig.add_trace(go.Bar(name='Admits', x=school_names, y=admits, marker_color=STEVENS_GRAY_DARK,
                         text=admits, textposition='outside'))
    fig.add_trace(go.Bar(name='Enrollments', x=school_names, y=enrollments, marker_color=CHART_SUCCESS,
                         text=enrollments, textposition='outside'))
    
    fig.update_layout(
        barmode='group',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': STEVENS_WHITE, 'size': 11},
        height=350,
        margin=dict(l=40, r=20, t=50, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        xaxis=dict(gridcolor='#333'),
        yaxis=dict(gridcolor='#333')
    )
    
    st.plotly_chart(fig, width="stretch")


def render_yoy_table(summary_stats: dict):
    """Render YoY comparison table."""
    years = [2024, 2025, 2026]
    
    data = []
    for year in years:
        metrics = summary_stats['overall'].get(year)
        if metrics:
            data.append({
                'Year': str(year),
                'Applications': metrics.applications,
                'Admits': metrics.admits,
                'Offers Accepted': metrics.offers_accepted,
                'Enrolled': metrics.enrollments,
                'Admit Rate': f"{metrics.admit_rate:.0f}%",
                'Yield Rate': f"{metrics.yield_rate:.0f}%"
            })
    
    if data and len(data) >= 2:
        # Calculate YoY
        prev, curr = data[-2], data[-1]
        yoy_row = {
            'Year': 'YoY',
            'Applications': f"+{((curr['Applications'] - prev['Applications']) / prev['Applications'] * 100):.0f}%",
            'Admits': f"+{((curr['Admits'] - prev['Admits']) / prev['Admits'] * 100):.0f}%",
            'Offers Accepted': f"+{((curr['Offers Accepted'] - prev['Offers Accepted']) / prev['Offers Accepted'] * 100):.0f}%",
            'Enrolled': f"+{((curr['Enrolled'] - prev['Enrolled']) / prev['Enrolled'] * 100):.0f}%",
            'Admit Rate': '—',
            'Yield Rate': '—'
        }
        
        df = pd.DataFrame(data)
        # Convert all to string
        for col in ['Applications', 'Admits', 'Offers Accepted', 'Enrolled']:
            df[col] = df[col].astype(str)
        df = pd.concat([df, pd.DataFrame([yoy_row])], ignore_index=True)
        
        st.dataframe(df, width="stretch", hide_index=True, height=180)


def render(data: dict):
    """Main render function for the Enrollment Funnel page."""
    st.markdown("## Enrollment Funnel")
    
    # Initialize session state for expansion
    if 'funnel_expanded' not in st.session_state:
        st.session_state.funnel_expanded = False
    
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
    
    # Funnel Stage Cards
    render_funnel_metrics_cards(summary_stats)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Main Flow Diagram with Click to Expand
    st.markdown("### Complete Enrollment Flow (Spring 2026)")
    
    # Create a container for the expandable diagram
    flow_container = st.container()
    
    with flow_container:
        # Show expand/collapse button
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.session_state.funnel_expanded:
                if st.button("⬆️ Collapse to Overview", width="stretch", type="secondary"):
                    st.session_state.funnel_expanded = False
                    st.rerun()
            else:
                if st.button("⬇️ Click to Expand & See Category Breakdowns", width="stretch", type="primary"):
                    st.session_state.funnel_expanded = True
                    st.rerun()
        
        st.caption("Hover over flows to see conversion rates. Green = progression, Gray = drop-off.")
        
        # Render main Sankey
        render_interactive_sankey(summary_stats, expanded=st.session_state.funnel_expanded)
        
        # If expanded, show category breakdowns inline
        if st.session_state.funnel_expanded:
            st.markdown("---")
            st.markdown("### Category Breakdowns")
            st.caption("Each category's complete funnel from applications to enrollment")
            render_category_grid(summary_stats)
    
    st.markdown("---")
    
    # Secondary charts
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Conversion Waterfall")
        st.caption("Student loss at each stage")
        render_conversion_waterfall(summary_stats)
    
    with col2:
        st.markdown("### Year-over-Year")
        render_yoy_table(summary_stats)
        
        st.markdown("### By School")
        render_funnel_by_school(summary_stats)
