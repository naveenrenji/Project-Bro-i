"""
Analytics engine for the CPE Funnel Dashboard.
Uses Slate data for funnel metrics and census data for enrollment breakdowns.
Matches automatedv6.py calculate_summary_stats logic for Slate metrics.
"""

from typing import Optional, List, Dict

import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from utils.formatting import safe_divide


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class FunnelMetrics:
    """Metrics for a single year in the enrollment funnel."""
    year: int
    applications: int = 0
    admits: int = 0
    offers_accepted: int = 0
    enrollments: int = 0
    
    @property
    def admit_rate(self) -> float:
        return safe_divide(self.admits, self.applications) * 100
    
    @property
    def offer_rate(self) -> float:
        return safe_divide(self.offers_accepted, self.admits) * 100
    
    @property
    def yield_rate(self) -> float:
        return safe_divide(self.enrollments, self.admits) * 100
    
    @property
    def overall_conversion(self) -> float:
        return safe_divide(self.enrollments, self.applications) * 100


@dataclass
class YoYComparison:
    """Year-over-year comparison between two years."""
    current: FunnelMetrics
    previous: FunnelMetrics
    
    @property
    def apps_change(self) -> float:
        return safe_divide(self.current.applications - self.previous.applications, 
                          self.previous.applications) * 100
    
    @property
    def admits_change(self) -> float:
        return safe_divide(self.current.admits - self.previous.admits,
                          self.previous.admits) * 100
    
    @property
    def enrollments_change(self) -> float:
        return safe_divide(self.current.enrollments - self.previous.enrollments,
                          self.previous.enrollments) * 100


@dataclass
class ProgramStats:
    """Statistics for a single program."""
    program_name: str
    school: str = ''
    degree_type: str = ''
    applications: int = 0
    admits: int = 0
    enrollments: int = 0
    credits: float = 0
    ntr: float = 0
    
    @property
    def admit_rate(self) -> float:
        return safe_divide(self.admits, self.applications) * 100
    
    @property
    def yield_rate(self) -> float:
        return safe_divide(self.enrollments, self.admits) * 100


# ============================================================================
# ENROLLMENT BREAKDOWN (Slate + Census)
# ============================================================================

@dataclass
class EnrollmentBreakdown:
    """Enrollment breakdown using Slate new + Census continuing/returning."""
    slate_new: int = 0
    census_new: int = 0
    continuing: int = 0
    returning: int = 0

    @property
    def total(self) -> int:
        return self.slate_new + self.continuing + self.returning


# ============================================================================
# SUMMARY CALCULATIONS (matching automatedv6.py)
# ============================================================================

def calculate_funnel_metrics(df: pd.DataFrame, year: int) -> FunnelMetrics:
    """
    Calculate funnel metrics from Slate application data.
    Matches automatedv6.py calculate_summary_stats overall logic (lines 964-980).
    
    - Applications: sum of Is Application column
    - Admits: count where Admit Status == 'admitted'
    - Offers: count where Offer Accepted == 'yes'
    - Enrollments: count where Enrolled == 'yes' (from Slate YOY Status)
    """
    if df is None or df.empty:
        return FunnelMetrics(year=year)
    
    # Applications via Is Application column sum (matching automatedv6.py line 976)
    if 'Is Application' in df.columns:
        applications = int(df['Is Application'].sum())
    else:
        applications = len(df)
    
    # Admits via Admit Status == 'admitted' (matching automatedv6.py line 977)
    admits = 0
    if 'Admit Status' in df.columns:
        admits = int((df['Admit Status'] == 'admitted').sum())
    
    # Offers accepted via Offer Accepted == 'yes' (matching automatedv6.py line 978)
    offers = 0
    if 'Offer Accepted' in df.columns:
        offers = int((df['Offer Accepted'] == 'yes').sum())
    
    # Enrollments via Enrolled == 'yes' (matching automatedv6.py line 979)
    # This comes from Slate YOY Status column
    enrollments = 0
    if 'Enrolled' in df.columns:
        enrollments = int((df['Enrolled'] == 'yes').sum())
    
    return FunnelMetrics(
        year=year,
        applications=applications,
        admits=admits,
        offers_accepted=offers,
        enrollments=enrollments
    )


def calculate_summary_stats(
    current_df: pd.DataFrame,
    previous_df: pd.DataFrame,
    two_years_ago_df: pd.DataFrame,
    census_enrollments: Optional[dict] = None
) -> dict:
    """
    Calculate comprehensive summary statistics using Slate data for funnel metrics.
    Census data is used only for continuing/returning enrollment breakdown and NTR.
    """
    # Calculate overall funnel metrics from Slate data
    current_metrics = calculate_funnel_metrics(current_df, 2026)
    previous_metrics = calculate_funnel_metrics(previous_df, 2025)
    two_years_metrics = calculate_funnel_metrics(two_years_ago_df, 2024)
    
    # Debug output
    print(f"[ANALYTICS] 2024 - Apps: {two_years_metrics.applications}, Admits: {two_years_metrics.admits}, Enrolls: {two_years_metrics.enrollments}")
    print(f"[ANALYTICS] 2025 - Apps: {previous_metrics.applications}, Admits: {previous_metrics.admits}, Enrolls: {previous_metrics.enrollments}")
    print(f"[ANALYTICS] 2026 - Apps: {current_metrics.applications}, Admits: {current_metrics.admits}, Enrolls: {current_metrics.enrollments}")
    
    summary = {
        'overall': {
            2026: current_metrics,
            2025: previous_metrics,
            2024: two_years_metrics,
        },
        'yoy': {
            '2026_vs_2025': YoYComparison(current_metrics, previous_metrics),
            '2025_vs_2024': YoYComparison(previous_metrics, two_years_metrics),
        },
    }

    # Enrollment breakdown (Slate new + Census continuing/returning)
    census_new = 0
    continuing = 0
    returning = 0
    if census_enrollments:
        census_new = int(census_enrollments.get('new', 0))
        continuing = int(census_enrollments.get('continuing', 0))
        returning = int(census_enrollments.get('returning', 0))

    summary['enrollment_breakdown'] = EnrollmentBreakdown(
        slate_new=current_metrics.enrollments,
        census_new=census_new,
        continuing=continuing,
        returning=returning
    )
    
    # By school breakdown (matching automatedv6.py lines 983-1003)
    summary['by_school'] = calculate_breakdown_by_field(
        current_df, previous_df, two_years_ago_df,
        field='School (Expanded)'
    )
    
    # By category breakdown (matching automatedv6.py lines 1025-1048)
    summary['by_category'] = calculate_breakdown_by_field(
        current_df, previous_df, two_years_ago_df,
        field='Application Category'
    )
    
    # By degree type breakdown (matching automatedv6.py lines 1005-1023)
    summary['by_degree'] = calculate_breakdown_by_field(
        current_df, previous_df, two_years_ago_df,
        field='Degree Type'
    )
    
    return summary


def calculate_breakdown_by_field(
    current_df: pd.DataFrame,
    previous_df: pd.DataFrame,
    two_years_ago_df: pd.DataFrame,
    field: str
) -> dict:
    """
    Calculate metrics broken down by a specific field.
    Uses SLATE DATA ONLY - matches automatedv6.py breakdown logic.
    """
    breakdown = {}
    
    # Get unique values across all years
    all_values = set()
    for df in [current_df, previous_df, two_years_ago_df]:
        if df is not None and not df.empty and field in df.columns:
            all_values.update(df[field].unique())
    
    for value in all_values:
        if not value:
            continue
        
        breakdown[value] = {}
        
        for year, df in [(2026, current_df), (2025, previous_df), (2024, two_years_ago_df)]:
            if df is None or df.empty or field not in df.columns:
                breakdown[value][year] = FunnelMetrics(year=year)
                continue
            
            filtered = df[df[field] == value]
            metrics = calculate_funnel_metrics(filtered, year)
            breakdown[value][year] = metrics
    
    return breakdown


# ============================================================================
# PROGRAM ANALYSIS
# ============================================================================

def calculate_program_stats(
    current_df: pd.DataFrame,
    previous_df: pd.DataFrame = None
) -> pd.DataFrame:
    """Calculate statistics for each program using SLATE DATA ONLY."""
    if current_df is None or current_df.empty:
        return pd.DataFrame()
    
    programs = []
    program_col = 'Program Cleaned'
    
    if program_col not in current_df.columns:
        return pd.DataFrame()
    
    for program in current_df[program_col].unique():
        if not program:
            continue
        
        current_filtered = current_df[current_df[program_col] == program]
        
        # Safely get mode values
        school_val = ''
        if 'School (Expanded)' in current_filtered.columns:
            mode_vals = current_filtered['School (Expanded)'].mode()
            if len(mode_vals) > 0:
                school_val = mode_vals.iloc[0]
        
        degree_val = ''
        if 'Degree Type' in current_filtered.columns:
            mode_vals = current_filtered['Degree Type'].mode()
            if len(mode_vals) > 0:
                degree_val = mode_vals.iloc[0]
        
        # Calculate metrics from Slate data
        if 'Is Application' in current_filtered.columns:
            apps_count = int(current_filtered['Is Application'].sum())
        else:
            apps_count = len(current_filtered)
        
        stats = {
            'Program': program,
            'School': school_val,
            'Degree Type': degree_val,
            'Applications 2026': apps_count,
            'Admits 2026': int((current_filtered['Admit Status'] == 'admitted').sum()) if 'Admit Status' in current_filtered.columns else 0,
            'Enrollments 2026': int((current_filtered['Enrolled'] == 'yes').sum()) if 'Enrolled' in current_filtered.columns else 0,
        }
        
        # Add previous year comparison
        if previous_df is not None and not previous_df.empty and program_col in previous_df.columns:
            prev_filtered = previous_df[previous_df[program_col] == program]
            if 'Is Application' in prev_filtered.columns:
                stats['Applications 2025'] = int(prev_filtered['Is Application'].sum())
            else:
                stats['Applications 2025'] = len(prev_filtered)
            stats['Admits 2025'] = int((prev_filtered['Admit Status'] == 'admitted').sum()) if 'Admit Status' in prev_filtered.columns else 0
            stats['Enrollments 2025'] = int((prev_filtered['Enrolled'] == 'yes').sum()) if 'Enrolled' in prev_filtered.columns else 0
            
            # YoY changes
            stats['Apps YoY %'] = safe_divide(
                stats['Applications 2026'] - stats['Applications 2025'],
                stats['Applications 2025']
            ) * 100
        else:
            stats['Applications 2025'] = 0
            stats['Admits 2025'] = 0
            stats['Enrollments 2025'] = 0
            stats['Apps YoY %'] = 0
        
        # Calculate rates
        stats['Admit Rate 2026'] = safe_divide(stats['Admits 2026'], stats['Applications 2026']) * 100
        stats['Yield Rate 2026'] = safe_divide(stats['Enrollments 2026'], stats['Admits 2026']) * 100
        
        programs.append(stats)
    
    df = pd.DataFrame(programs)
    if not df.empty:
        df = df.sort_values('Applications 2026', ascending=False)
    
    return df


def get_top_programs(program_stats: pd.DataFrame, n: int = 10, metric: str = 'Enrollments 2026') -> pd.DataFrame:
    """Get top N programs by a specific metric."""
    if program_stats.empty or metric not in program_stats.columns:
        return pd.DataFrame()
    
    return program_stats.nlargest(n, metric)


def get_trending_programs(program_stats: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Get programs with highest YoY growth."""
    if program_stats.empty or 'Apps YoY %' not in program_stats.columns:
        return pd.DataFrame()
    
    df = program_stats[program_stats['Applications 2025'] >= 5].copy()
    return df.nlargest(n, 'Apps YoY %')


def get_declining_programs(program_stats: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Get programs with lowest YoY growth (highest decline)."""
    if program_stats.empty or 'Apps YoY %' not in program_stats.columns:
        return pd.DataFrame()
    
    df = program_stats[program_stats['Applications 2025'] >= 5].copy()
    return df.nsmallest(n, 'Apps YoY %')


# ============================================================================
# CORPORATE COHORT ANALYSIS
# ============================================================================

def calculate_corporate_stats(current_df: pd.DataFrame) -> pd.DataFrame:
    """Calculate statistics for corporate cohorts from SLATE DATA ONLY."""
    cohorts = []
    
    if current_df is not None and not current_df.empty:
        company_col = 'Sponsoring Company'
        if company_col in current_df.columns:
            # Filter for rows with sponsoring company
            corp_df = current_df[current_df[company_col] != ''].copy()
            if not corp_df.empty:
                company_apps = corp_df.groupby(company_col).agg({
                    'Is Application': 'sum',
                    'Admit Status': lambda x: (x == 'admitted').sum(),
                    'Enrolled': lambda x: (x == 'yes').sum()
                }).reset_index()
                
                company_apps.columns = ['Company', 'Applications', 'Admits', 'Enrollments']
                for _, row in company_apps.iterrows():
                    cohorts.append({
                        'Company': row['Company'],
                        'Source': 'Slate',
                        'Applications': int(row['Applications']),
                        'Admits': int(row['Admits']),
                        'Enrollments': int(row['Enrollments'])
                    })
    
    df = pd.DataFrame(cohorts)
    if not df.empty:
        df = df.sort_values('Enrollments', ascending=False)
    
    return df


# ============================================================================
# FUNNEL ANALYSIS
# ============================================================================

def get_funnel_data(summary_stats: dict, year: int = 2026) -> List[Dict]:
    """Get data formatted for a funnel/Sankey chart."""
    metrics = summary_stats['overall'].get(year)
    if not metrics:
        return []
    
    return [
        {'stage': 'Applications', 'value': metrics.applications},
        {'stage': 'Admits', 'value': metrics.admits},
        {'stage': 'Offers Accepted', 'value': metrics.offers_accepted},
        {'stage': 'Enrollments', 'value': metrics.enrollments},
    ]


def get_funnel_by_category(current_df: pd.DataFrame) -> pd.DataFrame:
    """Get funnel breakdown by application category using SLATE DATA ONLY."""
    if current_df is None or current_df.empty:
        return pd.DataFrame()
    
    cat_col = 'Application Category'
    if cat_col not in current_df.columns:
        return pd.DataFrame()
    
    categories = []
    for category in current_df[cat_col].unique():
        if not category:
            continue
        
        filtered = current_df[current_df[cat_col] == category]
        
        apps = int(filtered['Is Application'].sum()) if 'Is Application' in filtered.columns else len(filtered)
        admits = int((filtered['Admit Status'] == 'admitted').sum()) if 'Admit Status' in filtered.columns else 0
        enrollments = int((filtered['Enrolled'] == 'yes').sum()) if 'Enrolled' in filtered.columns else 0
        
        categories.append({
            'Category': category,
            'Applications': apps,
            'Admits': admits,
            'Enrollments': enrollments,
            'Admit Rate': safe_divide(admits, apps) * 100,
            'Yield Rate': safe_divide(enrollments, admits) * 100,
        })
    
    return pd.DataFrame(categories).sort_values('Applications', ascending=False)


def get_historical_trend(
    summary_stats: dict,
    metric: str = 'applications'
) -> pd.DataFrame:
    """Get historical trend data for charting."""
    data = []
    
    for year in [2024, 2025, 2026]:
        metrics = summary_stats['overall'].get(year)
        if metrics:
            value = getattr(metrics, metric, 0)
            data.append({'Year': year, 'Value': value})
    
    return pd.DataFrame(data)
