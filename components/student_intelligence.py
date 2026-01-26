"""
Student Intelligence component for the CPE Dashboard.
Provides comprehensive view of current and continuing students with
demographics, academic performance, and graduation tracking.
"""

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
from utils.formatting import format_number, format_percent
from utils.constants import (
    STEVENS_RED, STEVENS_GRAY_DARK, STEVENS_GRAY_LIGHT, STEVENS_WHITE,
    BACKGROUND_CARD, CHART_SUCCESS, CHART_COLORS
)


def render_kpi_cards(df: pd.DataFrame):
    """Render top-level KPI cards."""
    total_students = len(df)
    
    # Average GPA (exclude 0 and nulls)
    gpa_col = 'Census_1_OVERALL_CUM_GPA'
    valid_gpa = df[df[gpa_col] > 0][gpa_col] if gpa_col in df.columns else pd.Series([])
    avg_gpa = valid_gpa.mean() if len(valid_gpa) > 0 else 0
    
    # Graduating this term calculation
    credits_remaining_col = 'Census_1_CREDITS_REMAINING_FROM_PROGRAM_REQUIREMENTS'
    credits_this_term_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    graduating_count = 0
    if credits_remaining_col in df.columns and credits_this_term_col in df.columns:
        df_grad = df.copy()
        df_grad[credits_remaining_col] = pd.to_numeric(df_grad[credits_remaining_col], errors='coerce').fillna(999)
        df_grad[credits_this_term_col] = pd.to_numeric(df_grad[credits_this_term_col], errors='coerce').fillna(0)
        graduating_count = len(df_grad[df_grad[credits_remaining_col] - df_grad[credits_this_term_col] <= 0])
    
    # New vs Continuing
    status_col = 'Census_1_STUDENT_STATUS'
    new_count = len(df[df[status_col] == 'New']) if status_col in df.columns else 0
    continuing_count = len(df[df[status_col] == 'Continuing']) if status_col in df.columns else 0
    
    # Average Age
    age_col = 'Census_1_AGE'
    valid_age = df[df[age_col] > 0][age_col] if age_col in df.columns else pd.Series([])
    avg_age = valid_age.mean() if len(valid_age) > 0 else 0
    
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {STEVENS_RED}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Total Students</div>
                <div style="font-size: 28px; font-weight: 700; color: {STEVENS_WHITE};">{format_number(total_students)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {CHART_SUCCESS}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Avg GPA</div>
                <div style="font-size: 28px; font-weight: 700; color: {CHART_SUCCESS};">{avg_gpa:.2f}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid #FFA500; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Graduating This Term</div>
                <div style="font-size: 28px; font-weight: 700; color: #FFA500;">{format_number(graduating_count)}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col4:
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid #17a2b8; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Avg Age</div>
                <div style="font-size: 28px; font-weight: 700; color: #17a2b8;">{avg_age:.1f}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col5:
        pct_new = (new_count / total_students * 100) if total_students > 0 else 0
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {STEVENS_GRAY_DARK}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">New Students</div>
                <div style="font-size: 28px; font-weight: 700; color: {STEVENS_WHITE};">{format_number(new_count)}</div>
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT};">({pct_new:.1f}%)</div>
            </div>
        """, unsafe_allow_html=True)


def render_filters(df: pd.DataFrame) -> pd.DataFrame:
    """Render filter controls and return filtered dataframe."""
    st.markdown("### Filters")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        # Degree Type filter
        degree_col = 'Census_1_DEGREE_TYPE'
        if degree_col in df.columns:
            degrees = ['All'] + sorted(df[degree_col].dropna().unique().tolist())
            selected_degree = st.selectbox("Degree Type", degrees, key="filter_degree")
            if selected_degree != 'All':
                df = df[df[degree_col] == selected_degree]
    
    with col2:
        # School filter
        school_col = 'Census_1_SCHOOL'
        if school_col in df.columns:
            schools = ['All'] + sorted(df[school_col].dropna().unique().tolist())
            selected_school = st.selectbox("School", schools, key="filter_school")
            if selected_school != 'All':
                df = df[df[school_col] == selected_school]
    
    with col3:
        # Student Status filter
        status_col = 'Census_1_STUDENT_STATUS'
        if status_col in df.columns:
            statuses = ['All'] + sorted(df[status_col].dropna().unique().tolist())
            selected_status = st.selectbox("Student Status", statuses, key="filter_status")
            if selected_status != 'All':
                df = df[df[status_col] == selected_status]
    
    with col4:
        # Student Category filter (Beacon, SPO, Corporate, Retail, ASAP)
        cat_col = 'Student_Category'
        if cat_col in df.columns:
            categories = ['All'] + sorted(df[cat_col].dropna().unique().tolist())
            selected_cat = st.selectbox("Student Category", categories, key="filter_category")
            if selected_cat != 'All':
                df = df[df[cat_col] == selected_cat]
        else:
            # Fallback to corporate filter if Student_Category not available
            corp_col = 'Census_1_CORPORATE_STUDENT'
            if corp_col in df.columns:
                corp_options = ['All', 'Corporate', 'Non-Corporate']
                selected_corp = st.selectbox("Corporate", corp_options, key="filter_corp")
                if selected_corp == 'Corporate':
                    df = df[df[corp_col] == 'Corporate']
                elif selected_corp == 'Non-Corporate':
                    df = df[df[corp_col] != 'Corporate']
    
    # Second row of filters
    col5, col6, col7, col8 = st.columns(4)
    
    with col5:
        # Program filter (multiselect for flexibility)
        program_col = 'Census_1_PROGRAM_OF_STUDY'
        if program_col not in df.columns:
            program_col = 'Census_1_PRIMARY_PROGRAM_OF_STUDY'
        if program_col in df.columns:
            programs = sorted(df[program_col].dropna().unique().tolist())
            selected_programs = st.multiselect("Program", programs, key="filter_program", placeholder="All Programs")
            if selected_programs:
                df = df[df[program_col].isin(selected_programs)]
    
    with col6:
        # Cohort filter
        cohort_col = 'Census_1_CUFE_COHORT'
        if cohort_col in df.columns:
            cohorts = ['All'] + sorted([c for c in df[cohort_col].dropna().unique().tolist() if c])
            selected_cohort = st.selectbox("Cohort", cohorts, key="filter_cohort")
            if selected_cohort != 'All':
                df = df[df[cohort_col] == selected_cohort]
    
    with col7:
        # GPA Range filter
        gpa_col = 'Census_1_OVERALL_CUM_GPA'
        if gpa_col in df.columns:
            gpa_range = st.slider("GPA Range", 0.0, 4.0, (0.0, 4.0), step=0.1, key="filter_gpa")
            df = df[(df[gpa_col] >= gpa_range[0]) & (df[gpa_col] <= gpa_range[1])]
    
    with col8:
        # Age Range filter
        age_col = 'Census_1_AGE'
        if age_col in df.columns:
            min_age = int(df[age_col].min()) if df[age_col].min() > 0 else 18
            max_age = int(df[age_col].max()) if df[age_col].max() < 100 else 70
            age_range = st.slider("Age Range", min_age, max_age, (min_age, max_age), key="filter_age")
            df = df[(df[age_col] >= age_range[0]) & (df[age_col] <= age_range[1])]
    
    st.markdown(f"**Showing {len(df):,} students**")
    st.markdown("---")
    
    return df


def render_demographics(df: pd.DataFrame):
    """Render demographics section with gender, race/ethnicity, age, and geography."""
    st.markdown("### Demographics")
    
    # Student Category breakdown (full width)
    cat_col = 'Student_Category'
    if cat_col in df.columns:
        cat_counts = df[cat_col].value_counts()
        
        cat_colors = {
            'Select Professional Online': '#17a2b8',
            'Retail': STEVENS_RED,
            'Corporate': CHART_SUCCESS,
            'Beacon': '#FFA500',
            'ASAP': '#9b59b6',
            'CPE': '#e74c3c',
            'CPE Corporate': '#c0392b',
            'On-Campus': STEVENS_GRAY_DARK,
            'Other': STEVENS_GRAY_LIGHT
        }
        colors = [cat_colors.get(c, STEVENS_GRAY_DARK) for c in cat_counts.index]
        
        fig = go.Figure(data=[go.Bar(
            x=cat_counts.index.tolist(),
            y=cat_counts.values.tolist(),
            marker_color=colors,
            text=cat_counts.values.tolist(),
            textposition='outside'
        )])
        
        fig.update_layout(
            title=dict(text="Students by Category", font=dict(color=STEVENS_WHITE, size=14)),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font={'color': STEVENS_WHITE},
            height=280,
            margin=dict(l=40, r=20, t=40, b=60),
            xaxis=dict(gridcolor='#333'),
            yaxis=dict(gridcolor='#333', title='Count')
        )
        
        st.plotly_chart(fig, width="stretch")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Gender Distribution
        sex_col = 'Census_1_SEX'
        if sex_col in df.columns:
            gender_counts = df[sex_col].value_counts()
            
            fig = go.Figure(data=[go.Pie(
                labels=gender_counts.index.tolist(),
                values=gender_counts.values.tolist(),
                hole=0.4,
                marker_colors=[STEVENS_RED, '#17a2b8', STEVENS_GRAY_DARK, '#FFA500'][:len(gender_counts)],
                textinfo='label+percent',
                textposition='outside',
                textfont=dict(size=11, color=STEVENS_WHITE)
            )])
            
            fig.update_layout(
                title=dict(text="Gender Distribution", font=dict(color=STEVENS_WHITE, size=14)),
                paper_bgcolor='rgba(0,0,0,0)',
                font={'color': STEVENS_WHITE},
                height=300,
                margin=dict(l=20, r=20, t=40, b=20),
                showlegend=False
            )
            
            st.plotly_chart(fig, width="stretch")
    
    with col2:
        # Age Distribution
        age_col = 'Census_1_AGE'
        if age_col in df.columns:
            valid_ages = df[df[age_col] > 0][age_col]
            
            fig = go.Figure(data=[go.Histogram(
                x=valid_ages,
                nbinsx=20,
                marker_color=STEVENS_RED,
                opacity=0.8
            )])
            
            fig.update_layout(
                title=dict(text="Age Distribution", font=dict(color=STEVENS_WHITE, size=14)),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                font={'color': STEVENS_WHITE},
                height=300,
                margin=dict(l=40, r=20, t=40, b=40),
                xaxis=dict(gridcolor='#333', title='Age'),
                yaxis=dict(gridcolor='#333', title='Count')
            )
            
            st.plotly_chart(fig, width="stretch")
    
    col3, col4 = st.columns(2)
    
    with col3:
        # Race/Ethnicity
        race_col = 'Census_1_RACE_ETHNICITY'
        if race_col in df.columns:
            race_counts = df[race_col].value_counts().head(8)
            
            fig = go.Figure(data=[go.Bar(
                y=race_counts.index.tolist()[::-1],
                x=race_counts.values.tolist()[::-1],
                orientation='h',
                marker_color=CHART_COLORS[:len(race_counts)][::-1],
                text=race_counts.values.tolist()[::-1],
                textposition='inside'
            )])
            
            fig.update_layout(
                title=dict(text="Race/Ethnicity", font=dict(color=STEVENS_WHITE, size=14)),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                font={'color': STEVENS_WHITE},
                height=300,
                margin=dict(l=20, r=20, t=40, b=20),
                xaxis=dict(gridcolor='#333'),
                yaxis=dict(gridcolor='#333')
            )
            
            st.plotly_chart(fig, width="stretch")
    
    with col4:
        # Geographic Distribution (Top States)
        state_col = 'Census_1_STATE_PERMANENT_ADDRESS'
        if state_col in df.columns:
            state_counts = df[state_col].value_counts().head(10)
            
            fig = go.Figure(data=[go.Bar(
                y=state_counts.index.tolist()[::-1],
                x=state_counts.values.tolist()[::-1],
                orientation='h',
                marker_color='#17a2b8',
                text=state_counts.values.tolist()[::-1],
                textposition='inside'
            )])
            
            fig.update_layout(
                title=dict(text="Top States (Permanent Address)", font=dict(color=STEVENS_WHITE, size=14)),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                font={'color': STEVENS_WHITE},
                height=300,
                margin=dict(l=20, r=20, t=40, b=20),
                xaxis=dict(gridcolor='#333'),
                yaxis=dict(gridcolor='#333')
            )
            
            st.plotly_chart(fig, width="stretch")


def render_academic_performance(df: pd.DataFrame):
    """Render academic performance section with GPA analysis."""
    st.markdown("### Academic Performance")
    
    gpa_col = 'Census_1_OVERALL_CUM_GPA'
    if gpa_col not in df.columns:
        st.info("GPA data not available")
        return
    
    col1, col2 = st.columns(2)
    
    with col1:
        # GPA Distribution Histogram
        valid_gpa = df[df[gpa_col] > 0][gpa_col]
        
        fig = go.Figure(data=[go.Histogram(
            x=valid_gpa,
            nbinsx=20,
            marker_color=CHART_SUCCESS,
            opacity=0.8
        )])
        
        # Add average line
        avg_gpa = valid_gpa.mean()
        fig.add_vline(x=avg_gpa, line_dash="dash", line_color=STEVENS_RED, 
                      annotation_text=f"Avg: {avg_gpa:.2f}", annotation_position="top")
        
        fig.update_layout(
            title=dict(text="GPA Distribution", font=dict(color=STEVENS_WHITE, size=14)),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font={'color': STEVENS_WHITE},
            height=350,
            margin=dict(l=40, r=20, t=40, b=40),
            xaxis=dict(gridcolor='#333', title='GPA', range=[0, 4.1]),
            yaxis=dict(gridcolor='#333', title='Count')
        )
        
        st.plotly_chart(fig, width="stretch")
    
    with col2:
        # GPA by Program (Top 10)
        program_col = 'Census_1_PROGRAM_OF_STUDY'
        if program_col not in df.columns:
            program_col = 'Census_1_PRIMARY_PROGRAM_OF_STUDY'
        
        if program_col in df.columns:
            gpa_by_program = df[df[gpa_col] > 0].groupby(program_col)[gpa_col].agg(['mean', 'count']).reset_index()
            gpa_by_program = gpa_by_program[gpa_by_program['count'] >= 5]  # Min 5 students
            gpa_by_program = gpa_by_program.nlargest(10, 'count')
            gpa_by_program = gpa_by_program.sort_values('mean', ascending=True)
            
            fig = go.Figure(data=[go.Bar(
                y=gpa_by_program[program_col].tolist(),
                x=gpa_by_program['mean'].tolist(),
                orientation='h',
                marker_color=CHART_SUCCESS,
                text=[f"{v:.2f}" for v in gpa_by_program['mean'].tolist()],
                textposition='inside'
            )])
            
            fig.update_layout(
                title=dict(text="Avg GPA by Program (Top 10 by enrollment)", font=dict(color=STEVENS_WHITE, size=14)),
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                font={'color': STEVENS_WHITE},
                height=350,
                margin=dict(l=20, r=20, t=40, b=20),
                xaxis=dict(gridcolor='#333', title='Average GPA', range=[0, 4.1]),
                yaxis=dict(gridcolor='#333', tickfont=dict(size=9))
            )
            
            st.plotly_chart(fig, width="stretch")
    
    # GPA Statistics Table
    st.markdown("#### GPA Statistics by Student Status")
    status_col = 'Census_1_STUDENT_STATUS'
    if status_col in df.columns:
        gpa_stats = df[df[gpa_col] > 0].groupby(status_col)[gpa_col].agg(['count', 'mean', 'std', 'min', 'max']).reset_index()
        gpa_stats.columns = ['Status', 'Students', 'Avg GPA', 'Std Dev', 'Min GPA', 'Max GPA']
        gpa_stats['Avg GPA'] = gpa_stats['Avg GPA'].round(3)
        gpa_stats['Std Dev'] = gpa_stats['Std Dev'].round(3)
        gpa_stats['Min GPA'] = gpa_stats['Min GPA'].round(3)
        gpa_stats['Max GPA'] = gpa_stats['Max GPA'].round(3)
        st.dataframe(gpa_stats, width="stretch", hide_index=True)


def render_graduation_tracking(df: pd.DataFrame):
    """Render graduation tracking section."""
    st.markdown("### Graduation Tracking")
    
    credits_remaining_col = 'Census_1_CREDITS_REMAINING_FROM_PROGRAM_REQUIREMENTS'
    credits_this_term_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    credits_completed_col = 'Census_1_UNITS_COMPLETED_FROM_PROGRAM_REQUIREMENTS'
    credits_required_col = 'Census_1_UNITS_REQUIRED_FROM_PROGRAM_REQUIREMENTS'
    
    required_cols = [credits_remaining_col, credits_this_term_col]
    if not all(col in df.columns for col in required_cols):
        st.info("Graduation tracking data not available. Required columns: CREDITS_REMAINING, CREDITS_THIS_TERM")
        return
    
    # Prepare data
    grad_df = df.copy()
    grad_df[credits_remaining_col] = pd.to_numeric(grad_df[credits_remaining_col], errors='coerce').fillna(999)
    grad_df[credits_this_term_col] = pd.to_numeric(grad_df[credits_this_term_col], errors='coerce').fillna(0)
    
    if credits_completed_col in grad_df.columns:
        grad_df[credits_completed_col] = pd.to_numeric(grad_df[credits_completed_col], errors='coerce').fillna(0)
    if credits_required_col in grad_df.columns:
        grad_df[credits_required_col] = pd.to_numeric(grad_df[credits_required_col], errors='coerce').fillna(0)
    
    # Calculate credits after this term
    grad_df['Credits_After_Term'] = grad_df[credits_remaining_col] - grad_df[credits_this_term_col]
    
    # Students graduating this term (remaining - this_term <= 0)
    graduating = grad_df[grad_df['Credits_After_Term'] <= 0]
    
    # Progress categories
    grad_df['Progress_Category'] = pd.cut(
        grad_df[credits_remaining_col],
        bins=[-float('inf'), 0, 10, 20, 30, float('inf')],
        labels=['Complete', '1-10 remaining', '11-20 remaining', '21-30 remaining', '30+ remaining']
    )
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Graduation summary
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 20px; margin-bottom: 16px;">
                <div style="font-size: 14px; color: {STEVENS_WHITE}; font-weight: 600; margin-bottom: 12px;">Graduation Summary</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: {STEVENS_GRAY_LIGHT};">Graduating This Term:</span>
                    <span style="color: {CHART_SUCCESS}; font-weight: 700;">{len(graduating):,}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: {STEVENS_GRAY_LIGHT};">Within 10 Credits:</span>
                    <span style="color: #FFA500; font-weight: 600;">{len(grad_df[(grad_df[credits_remaining_col] > 0) & (grad_df[credits_remaining_col] <= 10)]):,}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: {STEVENS_GRAY_LIGHT};">30+ Credits Remaining:</span>
                    <span style="color: {STEVENS_GRAY_LIGHT};">{len(grad_df[grad_df[credits_remaining_col] > 30]):,}</span>
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        # Progress distribution pie
        progress_counts = grad_df['Progress_Category'].value_counts()
        
        fig = go.Figure(data=[go.Pie(
            labels=progress_counts.index.tolist(),
            values=progress_counts.values.tolist(),
            hole=0.4,
            marker_colors=[CHART_SUCCESS, '#FFA500', '#17a2b8', STEVENS_GRAY_DARK, STEVENS_RED],
            textinfo='label+percent',
            textposition='outside',
            textfont=dict(size=10, color=STEVENS_WHITE)
        )])
        
        fig.update_layout(
            title=dict(text="Credits Remaining Distribution", font=dict(color=STEVENS_WHITE, size=14)),
            paper_bgcolor='rgba(0,0,0,0)',
            font={'color': STEVENS_WHITE},
            height=300,
            margin=dict(l=20, r=20, t=40, b=20),
            showlegend=False
        )
        
        st.plotly_chart(fig, width="stretch")
    
    with col2:
        # Students Graduating This Term (table)
        st.markdown("#### Students Graduating This Term")
        
        if len(graduating) > 0:
            display_cols = ['Census_1_STUDENT_NAME', 'Census_1_PROGRAM_OF_STUDY', 
                           credits_remaining_col, credits_this_term_col, 'Credits_After_Term']
            display_cols = [c for c in display_cols if c in graduating.columns]
            
            grad_display = graduating[display_cols].copy()
            grad_display.columns = ['Name', 'Program', 'Remaining', 'This Term', 'After Term'][:len(display_cols)]
            
            st.dataframe(grad_display.head(50), width="stretch", hide_index=True, height=350)
        else:
            st.info("No students identified as graduating this term")
    
    # Full progress table with search
    st.markdown("#### Student Credit Progress")
    
    # Add search
    search_term = st.text_input("Search by name or program", key="grad_search")
    
    display_cols = ['Census_1_STUDENT_NAME', 'Census_1_PROGRAM_OF_STUDY', 'Census_1_STUDENT_STATUS']
    if credits_required_col in grad_df.columns:
        display_cols.append(credits_required_col)
    if credits_completed_col in grad_df.columns:
        display_cols.append(credits_completed_col)
    display_cols.extend([credits_remaining_col, credits_this_term_col, 'Credits_After_Term', 'Progress_Category'])
    display_cols = [c for c in display_cols if c in grad_df.columns]
    
    progress_df = grad_df[display_cols].copy()
    
    # Rename columns for display
    col_rename = {
        'Census_1_STUDENT_NAME': 'Name',
        'Census_1_PROGRAM_OF_STUDY': 'Program',
        'Census_1_STUDENT_STATUS': 'Status',
        credits_required_col: 'Required',
        credits_completed_col: 'Completed',
        credits_remaining_col: 'Remaining',
        credits_this_term_col: 'This Term',
        'Credits_After_Term': 'After Term',
        'Progress_Category': 'Progress'
    }
    progress_df = progress_df.rename(columns=col_rename)
    
    # Apply search filter
    if search_term:
        mask = progress_df.apply(lambda row: search_term.lower() in str(row).lower(), axis=1)
        progress_df = progress_df[mask]
    
    # Sort by remaining credits
    if 'Remaining' in progress_df.columns:
        progress_df = progress_df.sort_values('Remaining', ascending=True)
    
    st.dataframe(progress_df, width="stretch", hide_index=True, height=400)


# CPC (Cost Per Credit) rates by (Category, Degree Type, Student Type)
CPC_RATES = {
    ('Select Professional Online', 'Masters', 'New'): 1395,
    ('Select Professional Online', 'Masters', 'Current'): 1650,
    ('Beacon', 'Masters', 'New'): 290,
    ('Beacon', 'Masters', 'Current'): 290,
    ('Corporate', 'Masters', 'New'): 1300,
    ('Corporate', 'Masters', 'Current'): 1550,
    ('Corporate', 'Graduate Certificate', 'New'): 1195,
    ('Corporate', 'Graduate Certificate', 'Current'): 1195,
    ('Retail', 'Masters', 'New'): 1395,
    ('Retail', 'Masters', 'Current'): 1723,
    ('Retail', 'Graduate Certificate', 'New'): 1993,
    ('Retail', 'Graduate Certificate', 'Current'): 2030,
    ('ASAP', 'Non-Degree', 'New'): 875,
    ('ASAP', 'Non-Degree', 'Current'): 875,
    ('CPE', 'Masters', 'New'): 800,
    ('CPE', 'Masters', 'Current'): 800,
    ('CPE', 'Graduate Certificate', 'New'): 583,
    ('CPE', 'Graduate Certificate', 'Current'): 583,
    ('CPE Corporate', 'Masters', 'New'): 800,
    ('CPE Corporate', 'Masters', 'Current'): 800,
    ('CPE Corporate', 'Graduate Certificate', 'New'): 277.77,
    ('CPE Corporate', 'Graduate Certificate', 'Current'): 277.77,
}


def _categorize_and_type_students(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply categorization logic matching ntr_calc_v5.py exactly.
    Adds Student_Category and Student_Type columns.
    """
    df = df.copy()
    
    # Ensure required columns exist
    if 'Census_1_SCHOOL' not in df.columns:
        df['Census_1_SCHOOL'] = ''
    if 'Census_1_CORPORATE_COHORT' not in df.columns:
        df['Census_1_CORPORATE_COHORT'] = ''
    if 'Census_1_BEACON_FLAG' not in df.columns:
        df['Census_1_BEACON_FLAG'] = 0
    if 'Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW' not in df.columns:
        df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'] = 0
    
    # Convert numeric columns
    df['Census_1_BEACON_FLAG'] = pd.to_numeric(df['Census_1_BEACON_FLAG'], errors='coerce').fillna(0)
    df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'] = pd.to_numeric(
        df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'], errors='coerce'
    ).fillna(0)
    
    # Student Type: New vs Current (matching ntr_calc_v5.py)
    type_conditions = [
        (df['Census_1_STUDENT_STATUS'].isin(['Continuing', 'Returning'])),
        (df['Census_1_STUDENT_STATUS'] == 'New') & (df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'] == 1),
        (df['Census_1_STUDENT_STATUS'] == 'New') & (df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'] == 0)
    ]
    df['Student_Type'] = np.select(type_conditions, ['Current', 'Current', 'New'], default='Uncategorized')
    
    # True corporate = has actual corporate cohort (not 'Not reported', not empty/NaN)
    is_true_corporate = (
        (df['Census_1_CORPORATE_COHORT'].notna()) & 
        (df['Census_1_CORPORATE_COHORT'] != '') & 
        (df['Census_1_CORPORATE_COHORT'] != 'Not reported')
    )
    
    # Student Category (matching ntr_calc_v5.py exactly)
    category_conditions = [
        # 1. ASAP: Non-Degree + Online
        (df['Census_1_DEGREE_TYPE'] == 'Non-Degree') & (df['Census_1_STUDENT_LOCATION_DETAILED'].isin(['Online', 'Online Noodle'])),
        # 2. Select Professional Online: Online Noodle location
        (df['Census_1_STUDENT_LOCATION_DETAILED'] == 'Online Noodle'),
        # 3. Beacon: Beacon flag = 1
        (df['Census_1_BEACON_FLAG'] == 1),
        # 4. CPE Corporate: CPE school + has actual corporate cohort
        (df['Census_1_SCHOOL'] == 'College of Professional Education') & is_true_corporate,
        # 5. CPE: CPE school + no corporate cohort
        (df['Census_1_SCHOOL'] == 'College of Professional Education') & ~is_true_corporate,
        # 6. Corporate: Online + has actual corporate cohort + not Beacon
        (df['Census_1_STUDENT_LOCATION_DETAILED'] == 'Online') & is_true_corporate & (df['Census_1_BEACON_FLAG'] == 0),
        # 7. Retail: Online + no corporate cohort + not Beacon
        (df['Census_1_STUDENT_LOCATION_DETAILED'] == 'Online') & ~is_true_corporate & (df['Census_1_BEACON_FLAG'] == 0),
        # 8. On-Campus (for display, not NTR)
        (df['Census_1_STUDENT_LOCATION_DETAILED'].str.contains('On-Campus|Hoboken', case=False, na=False))
    ]
    category_names = ['ASAP', 'Select Professional Online', 'Beacon', 'CPE Corporate', 'CPE', 'Corporate', 'Retail', 'On-Campus']
    df['Student_Category'] = np.select(category_conditions, category_names, default='Other')
    
    return df


def _calculate_ntr(row: pd.Series) -> float:
    """Calculate NTR for a single student row."""
    category = row.get('Student_Category', '')
    degree_type = row.get('Census_1_DEGREE_TYPE', '')
    student_type = row.get('Student_Type', '')
    credits = pd.to_numeric(row.get('Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS', 0), errors='coerce') or 0
    
    cpc = CPC_RATES.get((category, degree_type, student_type), 0)
    return credits * cpc


def render_ntr_analysis(df: pd.DataFrame):
    """Render NTR (Net Tuition Revenue) analysis section."""
    st.markdown("### NTR Analysis")
    
    # Calculate NTR for each student
    df = df.copy()
    df['NTR'] = df.apply(_calculate_ntr, axis=1)
    
    # Summary by category
    credit_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    if credit_col not in df.columns:
        credit_col = 'Census_1_NUMBER_OF_CREDITS'
    df[credit_col] = pd.to_numeric(df[credit_col], errors='coerce').fillna(0)
    
    # Aggregate by category and degree type
    ntr_summary = df.groupby(['Student_Category', 'Census_1_DEGREE_TYPE', 'Student_Type']).agg(
        Students=('Census_1_STUDENT_ID', 'nunique'),
        Credits=(credit_col, 'sum'),
        NTR=('NTR', 'sum')
    ).reset_index()
    
    # Create pivot table
    pivot_df = ntr_summary.pivot_table(
        index=['Student_Category', 'Census_1_DEGREE_TYPE'],
        columns='Student_Type',
        values=['Students', 'Credits', 'NTR'],
        fill_value=0,
        aggfunc='sum'
    )
    
    # Flatten column names
    pivot_df.columns = [f'{col[0]}_{col[1]}' for col in pivot_df.columns]
    pivot_df = pivot_df.reset_index()
    
    # Calculate totals
    for metric in ['Students', 'Credits', 'NTR']:
        new_col = f'{metric}_New' if f'{metric}_New' in pivot_df.columns else None
        cur_col = f'{metric}_Current' if f'{metric}_Current' in pivot_df.columns else None
        if new_col and cur_col:
            pivot_df[f'Total_{metric}'] = pivot_df[new_col] + pivot_df[cur_col]
        elif new_col:
            pivot_df[f'Total_{metric}'] = pivot_df[new_col]
        elif cur_col:
            pivot_df[f'Total_{metric}'] = pivot_df[cur_col]
    
    # NTR KPIs
    total_ntr = df['NTR'].sum()
    ntr_goal = 9800000  # Default goal from ntr_calc_v5.py
    pct_of_goal = (total_ntr / ntr_goal * 100) if ntr_goal > 0 else 0
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {CHART_SUCCESS}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Total NTR</div>
                <div style="font-size: 24px; font-weight: 700; color: {CHART_SUCCESS};">${total_ntr:,.0f}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {STEVENS_GRAY_DARK}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">NTR Goal</div>
                <div style="font-size: 24px; font-weight: 700; color: {STEVENS_WHITE};">${ntr_goal:,.0f}</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col3:
        color = CHART_SUCCESS if pct_of_goal >= 100 else '#FFA500' if pct_of_goal >= 80 else STEVENS_RED
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {color}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">% of Goal</div>
                <div style="font-size: 24px; font-weight: 700; color: {color};">{pct_of_goal:.1f}%</div>
            </div>
        """, unsafe_allow_html=True)
    
    with col4:
        diff = total_ntr - ntr_goal
        diff_color = CHART_SUCCESS if diff >= 0 else STEVENS_RED
        sign = '+' if diff >= 0 else ''
        st.markdown(f"""
            <div style="background: {BACKGROUND_CARD}; border-radius: 4px; padding: 16px; border-left: 3px solid {diff_color}; text-align: center;">
                <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT}; text-transform: uppercase;">Variance</div>
                <div style="font-size: 24px; font-weight: 700; color: {diff_color};">{sign}${diff:,.0f}</div>
            </div>
        """, unsafe_allow_html=True)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # NTR by Category chart
    col1, col2 = st.columns(2)
    
    with col1:
        ntr_by_cat = df.groupby('Student_Category')['NTR'].sum().sort_values(ascending=True)
        ntr_by_cat = ntr_by_cat[ntr_by_cat > 0]  # Only show categories with NTR
        
        fig = go.Figure(data=[go.Bar(
            y=ntr_by_cat.index.tolist(),
            x=ntr_by_cat.values.tolist(),
            orientation='h',
            marker_color=CHART_SUCCESS,
            text=[f'${v:,.0f}' for v in ntr_by_cat.values],
            textposition='inside'
        )])
        
        fig.update_layout(
            title=dict(text="NTR by Student Category", font=dict(color=STEVENS_WHITE, size=14)),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font={'color': STEVENS_WHITE},
            height=350,
            margin=dict(l=20, r=20, t=40, b=20),
            xaxis=dict(gridcolor='#333', title='NTR ($)'),
            yaxis=dict(gridcolor='#333')
        )
        
        st.plotly_chart(fig, width="stretch")
    
    with col2:
        # NTR by New vs Current
        ntr_by_type = df.groupby('Student_Type')['NTR'].sum()
        
        fig = go.Figure(data=[go.Pie(
            labels=ntr_by_type.index.tolist(),
            values=ntr_by_type.values.tolist(),
            hole=0.4,
            marker_colors=[STEVENS_RED, CHART_SUCCESS, STEVENS_GRAY_DARK],
            textinfo='label+percent',
            textposition='outside',
            textfont=dict(size=11, color=STEVENS_WHITE)
        )])
        
        fig.update_layout(
            title=dict(text="NTR by Student Type (New vs Current)", font=dict(color=STEVENS_WHITE, size=14)),
            paper_bgcolor='rgba(0,0,0,0)',
            font={'color': STEVENS_WHITE},
            height=350,
            margin=dict(l=20, r=20, t=40, b=20),
            showlegend=False
        )
        
        st.plotly_chart(fig, width="stretch")
    
    # Detailed NTR table
    st.markdown("#### NTR Detail by Category & Degree Type")
    
    # Prepare display table
    display_cols = ['Student_Category', 'Census_1_DEGREE_TYPE']
    for col in ['Students_New', 'Students_Current', 'Total_Students', 
                'Credits_New', 'Credits_Current', 'Total_Credits',
                'NTR_New', 'NTR_Current', 'Total_NTR']:
        if col in pivot_df.columns:
            display_cols.append(col)
    
    display_df = pivot_df[display_cols].copy()
    display_df = display_df.rename(columns={
        'Census_1_DEGREE_TYPE': 'Degree Type',
        'Students_New': 'New Students',
        'Students_Current': 'Current Students',
        'Total_Students': 'Total Students',
        'Credits_New': 'New Credits',
        'Credits_Current': 'Current Credits',
        'Total_Credits': 'Total Credits',
        'NTR_New': 'NTR (New)',
        'NTR_Current': 'NTR (Current)',
        'Total_NTR': 'Total NTR'
    })
    
    # Format NTR columns as currency
    for col in display_df.columns:
        if 'NTR' in col:
            display_df[col] = display_df[col].apply(lambda x: f'${x:,.0f}')
    
    # Add totals row
    total_row = {'Student_Category': 'GRAND TOTAL', 'Degree Type': ''}
    for col in display_df.columns:
        if col not in ['Student_Category', 'Degree Type']:
            if 'NTR' in col:
                # Sum the numeric values before formatting
                numeric_vals = pivot_df[col.replace('NTR (New)', 'NTR_New').replace('NTR (Current)', 'NTR_Current').replace('Total NTR', 'Total_NTR')]
                if col.replace('NTR (New)', 'NTR_New').replace('NTR (Current)', 'NTR_Current').replace('Total NTR', 'Total_NTR') in pivot_df.columns:
                    total_row[col] = f'${pivot_df[col.replace("NTR (New)", "NTR_New").replace("NTR (Current)", "NTR_Current").replace("Total NTR", "Total_NTR")].sum():,.0f}'
            else:
                orig_col = col.replace('New Students', 'Students_New').replace('Current Students', 'Students_Current').replace('Total Students', 'Total_Students').replace('New Credits', 'Credits_New').replace('Current Credits', 'Credits_Current').replace('Total Credits', 'Total_Credits')
                if orig_col in pivot_df.columns:
                    total_row[col] = int(pivot_df[orig_col].sum())
    
    display_df = pd.concat([display_df, pd.DataFrame([total_row])], ignore_index=True)
    
    st.dataframe(display_df, width="stretch", hide_index=True, height=400)


def render(data: dict):
    """Main render function for the Student Intelligence page."""
    st.markdown("## Student Intelligence")
    
    # Get census data
    census_data = data.get('census', {})
    census_df = census_data.get('raw_df')
    
    if census_df is None or census_df.empty:
        st.warning("No census data available. Please ensure census data is loaded.")
        return
    
    # Work with a copy and apply categorization matching ntr_calc_v5.py
    df = census_df.copy()
    df = _categorize_and_type_students(df)
    
    # Apply filters
    df = render_filters(df)
    
    if df.empty:
        st.warning("No students match the selected filters.")
        return
    
    # Render KPI cards
    render_kpi_cards(df)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Render sections
    render_demographics(df)
    
    st.markdown("---")
    
    render_academic_performance(df)
    
    st.markdown("---")
    
    render_graduation_tracking(df)
    
    st.markdown("---")
    
    render_ntr_analysis(df)
