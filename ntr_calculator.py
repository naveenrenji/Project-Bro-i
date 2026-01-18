"""
NTR (Net Tuition Revenue) Calculator for the CPE Funnel Dashboard.
Ported from ntr_calc_v5.py with enhancements for dashboard use.
"""

from typing import Tuple, List, Optional

import pandas as pd
import numpy as np
from dataclasses import dataclass


# ============================================================================
# CPC RATES CONFIGURATION
# ============================================================================

# Cost Per Credit rates by Student Category, Degree Type, and Student Type (New/Current)
CPC_RATES = {
    ('Select Professional Online', 'Masters', 'New'): 1395,
    ('Select Professional Online', 'Masters', 'Current'): 1650,
    ('Beacon', 'Masters', 'New'): 290,
    ('Beacon', 'Masters', 'Current'): 290,
    ('Stevens Online (Corporate)', 'Masters', 'New'): 1300,
    ('Stevens Online (Corporate)', 'Masters', 'Current'): 1550,
    ('Stevens Online (Corporate)', 'Graduate Certificate', 'New'): 1195,
    ('Stevens Online (Corporate)', 'Graduate Certificate', 'Current'): 1195,
    ('Stevens Online (Retail)', 'Masters', 'New'): 1395,
    ('Stevens Online (Retail)', 'Masters', 'Current'): 1723,
    ('Stevens Online (Retail)', 'Graduate Certificate', 'New'): 1993,
    ('Stevens Online (Retail)', 'Graduate Certificate', 'Current'): 2030,
    ('ASAP', 'Non-Degree', 'New'): 875,
    ('ASAP', 'Non-Degree', 'Current'): 875,
    # Aliases for Corporate/Retail without "Stevens Online" prefix
    ('Corporate', 'Masters', 'New'): 1300,
    ('Corporate', 'Masters', 'Current'): 1550,
    ('Corporate', 'Graduate Certificate', 'New'): 1195,
    ('Corporate', 'Graduate Certificate', 'Current'): 1195,
    ('Retail', 'Masters', 'New'): 1395,
    ('Retail', 'Masters', 'Current'): 1723,
    ('Retail', 'Graduate Certificate', 'New'): 1993,
    ('Retail', 'Graduate Certificate', 'Current'): 2030,
    # CPE Programs (College of Professional Education)
    # MEADS - Masters in Applied Data Science
    ('CPE', 'Masters', 'New'): 800,
    ('CPE', 'Masters', 'Current'): 800,
    # Professional Graduate Certificates (Enterprise AI, ADS Foundations)
    ('CPE', 'Graduate Certificate', 'New'): 583,
    ('CPE', 'Graduate Certificate', 'Current'): 583,
    ('CPE', 'Professional Graduate Certificate', 'New'): 583,
    ('CPE', 'Professional Graduate Certificate', 'Current'): 583,
}

# CPE Program Names for identification
# Note: "data science" alone is too broad - SES also has a Data Science program
# Only match specific CPE program names
CPE_PROGRAMS = {
    'masters': [
        'applied data science',
        'meads',
        'master of engineering in applied data science',
        'me in applied data science',
    ],
    'graduate_certificate': [
        'enterprise ai',
        'enterprise artificial intelligence',
        'professional graduate certificate in enterprise ai',
        'applied data science foundations',
        'ads foundations',
        'professional graduate certificate in applied data science foundations',
        'systems engineering foundations',  # CPE's PGC program
    ]
}

# CPE School names for identification
CPE_SCHOOL_KEYWORDS = [
    'cpe',
    'college of professional education',
    'professional education',
]

# Default NTR Goal (can be overridden)
DEFAULT_NTR_GOAL = 9_800_000


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class NTRSummary:
    """Summary of NTR calculations."""
    total_ntr: float
    ntr_goal: float
    percentage_of_goal: float
    gap_to_goal: float
    total_students: int
    total_credits: float
    new_students: int
    current_students: int
    new_credits: float
    current_credits: float
    new_ntr: float
    current_ntr: float


@dataclass
class CategoryNTR:
    """NTR breakdown for a single category."""
    category: str
    degree_type: str
    new_students: int
    current_students: int
    total_students: int
    new_credits: float
    current_credits: float
    total_credits: float
    cpc_new: float
    cpc_current: float
    ntr_new: float
    ntr_current: float
    total_ntr: float


# ============================================================================
# STUDENT CLASSIFICATION
# ============================================================================

def classify_student_type(row: pd.Series) -> str:
    """
    Classify a student as 'New' or 'Current' based on their status.
    
    Rules:
    - Continuing/Returning students = Current
    - New students who were enrolled in previous summer as new = Current
    - New students without previous summer enrollment = New
    """
    status = row.get('Census_1_STUDENT_STATUS', '')
    prev_summer = row.get('Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW', 0)
    
    if status in ['Continuing', 'Returning']:
        return 'Current'
    elif status == 'New':
        if prev_summer == 1:
            return 'Current'
        else:
            return 'New'
    return 'Uncategorized'


def is_cpe_program(program_name: str) -> bool:
    """Check if a program belongs to CPE (College of Professional Education)."""
    if not program_name:
        return False
    
    program_lower = str(program_name).lower().strip()
    
    # Check masters programs
    for keyword in CPE_PROGRAMS['masters']:
        if keyword in program_lower:
            return True
    
    # Check certificate programs
    for keyword in CPE_PROGRAMS['graduate_certificate']:
        if keyword in program_lower:
            return True
    
    return False


def get_cpe_degree_type(program_name: str, original_degree_type: str) -> str:
    """Determine the degree type for CPE programs."""
    if not program_name:
        return original_degree_type
    
    program_lower = str(program_name).lower().strip()
    
    # Check if it's a masters program (MEADS)
    for keyword in CPE_PROGRAMS['masters']:
        if keyword in program_lower:
            return 'Masters'
    
    # Check if it's a certificate program
    for keyword in CPE_PROGRAMS['graduate_certificate']:
        if keyword in program_lower:
            return 'Professional Graduate Certificate'
    
    return original_degree_type


def is_cpe_school(school_name: str) -> bool:
    """Check if a school name indicates CPE (College of Professional Education)."""
    if not school_name:
        return False
    school_lower = str(school_name).lower().strip()
    return any(keyword in school_lower for keyword in CPE_SCHOOL_KEYWORDS)


def classify_student_category(row: pd.Series) -> str:
    """
    Classify a student into a category based on census data.
    
    Categories:
    - CPE: College of Professional Education programs (MEADS, Enterprise AI, ADS Foundations)
    - ASAP: Non-Degree students who are online
    - Select Professional Online: Online Noodle students
    - Beacon: Students with Beacon flag
    - Corporate: Online corporate students (not Beacon)
    - Retail: Online non-corporate students (not Beacon)
    """
    degree_type = row.get('Census_1_DEGREE_TYPE', '')
    location = row.get('Census_1_STUDENT_LOCATION_DETAILED', '')
    corporate = row.get('Census_1_CORPORATE_STUDENT', '')
    beacon_flag = row.get('Census_1_BEACON_FLAG', 0)
    program = row.get('Census_1_PRIMARY_PROGRAM_OF_STUDY', '')
    school = row.get('Census_1_SCHOOL', '')
    
    # CPE programs - check first by program name or school
    if is_cpe_program(program) or is_cpe_school(school):
        return 'CPE'
    
    # ASAP students: Non-Degree and online
    if degree_type == 'Non-Degree' and location in ['Online', 'Online Noodle']:
        return 'ASAP'
    
    # Select Professional Online: Online Noodle
    if location == 'Online Noodle':
        return 'Select Professional Online'
    
    # Beacon students
    if beacon_flag == 1:
        return 'Beacon'
    
    # Corporate students (online, not Beacon)
    if location == 'Online' and corporate == 'Corporate' and beacon_flag == 0:
        return 'Corporate'
    
    # Retail students (online, non-corporate, not Beacon)
    if location == 'Online' and corporate == 'Non-Corporate' and beacon_flag == 0:
        return 'Retail'
    
    return 'Uncategorized'


# ============================================================================
# NTR CALCULATION FUNCTIONS
# ============================================================================

def get_cpc_rate(category: str, degree_type: str, student_type: str) -> float:
    """Get the CPC rate for a given category, degree type, and student type."""
    # Try exact match first
    key = (category, degree_type, student_type)
    if key in CPC_RATES:
        return CPC_RATES[key]
    
    # Try with "Stevens Online" prefix removed
    if category.startswith('Stevens Online'):
        short_category = category.replace('Stevens Online (', '').replace(')', '')
        key = (short_category, degree_type, student_type)
        if key in CPC_RATES:
            return CPC_RATES[key]
    
    return 0.0


def calculate_ntr_from_census(
    census_df: pd.DataFrame,
    ntr_goal: float = DEFAULT_NTR_GOAL,
    semester: str = '2026S'
) -> Tuple[Optional[NTRSummary], List[CategoryNTR], pd.DataFrame]:
    """
    Calculate NTR from census data.
    
    Returns:
        - NTRSummary: Overall NTR summary
        - List[CategoryNTR]: Breakdown by category
        - DataFrame: Detailed breakdown table
    """
    if census_df is None or census_df.empty:
        return None, [], pd.DataFrame()
    
    df = census_df.copy()
    
    # Filter for the semester if needed
    if 'Census_1_SEMESTER' in df.columns:
        df = df[df['Census_1_SEMESTER'] == semester].copy()
    
    # Determine credit column
    credit_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    if credit_col not in df.columns:
        credit_col = 'Census_1_NUMBER_OF_CREDITS'
    
    if credit_col not in df.columns:
        return None, [], pd.DataFrame()
    
    # Convert numeric columns
    df[credit_col] = pd.to_numeric(df[credit_col], errors='coerce').fillna(0)
    df['Census_1_BEACON_FLAG'] = pd.to_numeric(df['Census_1_BEACON_FLAG'], errors='coerce').fillna(0)
    
    if 'Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW' in df.columns:
        df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'] = pd.to_numeric(
            df['Census_1_ENROLLED_IN_PREVIOUS_SUMMER_SEMESTER_AS_NEW'], errors='coerce'
        ).fillna(0)
    
    # Classify students
    df['Student_Type'] = df.apply(classify_student_type, axis=1)
    df['Student_Category'] = df.apply(classify_student_category, axis=1)
    
    # Filter for valid categories and degree types
    valid_categories = ['ASAP', 'Select Professional Online', 'Beacon', 'Corporate', 'Retail', 'CPE']
    valid_degrees = ['Masters', 'Graduate Certificate', 'Non-Degree', 'Professional Graduate Certificate']
    
    df = df[
        (df['Student_Category'].isin(valid_categories)) &
        (df['Census_1_DEGREE_TYPE'].isin(valid_degrees))
    ].copy()
    
    if df.empty:
        return None, [], pd.DataFrame()
    
    # Aggregate by category, degree type, and student type
    student_id_col = 'Census_1_STUDENT_ID'
    agg_data = df.groupby(['Student_Category', 'Census_1_DEGREE_TYPE', 'Student_Type']).agg(
        Student_Count=(student_id_col, 'nunique'),
        Total_Credits=(credit_col, 'sum')
    ).reset_index()
    
    # Pivot for easier analysis
    students_pivot = agg_data.pivot_table(
        index=['Student_Category', 'Census_1_DEGREE_TYPE'],
        columns='Student_Type',
        values='Student_Count',
        fill_value=0
    )
    
    credits_pivot = agg_data.pivot_table(
        index=['Student_Category', 'Census_1_DEGREE_TYPE'],
        columns='Student_Type',
        values='Total_Credits',
        fill_value=0
    )
    
    # Build breakdown list
    category_breakdown = []
    total_ntr = 0
    total_students = 0
    total_credits = 0
    total_new_students = 0
    total_current_students = 0
    total_new_credits = 0
    total_current_credits = 0
    total_new_ntr = 0
    total_current_ntr = 0
    
    for (category, degree_type) in students_pivot.index:
        new_students = students_pivot.loc[(category, degree_type), 'New'] if 'New' in students_pivot.columns else 0
        current_students = students_pivot.loc[(category, degree_type), 'Current'] if 'Current' in students_pivot.columns else 0
        
        new_credits = credits_pivot.loc[(category, degree_type), 'New'] if 'New' in credits_pivot.columns else 0
        current_credits = credits_pivot.loc[(category, degree_type), 'Current'] if 'Current' in credits_pivot.columns else 0
        
        cpc_new = get_cpc_rate(category, degree_type, 'New')
        cpc_current = get_cpc_rate(category, degree_type, 'Current')
        
        ntr_new = new_credits * cpc_new
        ntr_current = current_credits * cpc_current
        
        category_ntr = CategoryNTR(
            category=category,
            degree_type=degree_type,
            new_students=int(new_students),
            current_students=int(current_students),
            total_students=int(new_students + current_students),
            new_credits=float(new_credits),
            current_credits=float(current_credits),
            total_credits=float(new_credits + current_credits),
            cpc_new=cpc_new,
            cpc_current=cpc_current,
            ntr_new=ntr_new,
            ntr_current=ntr_current,
            total_ntr=ntr_new + ntr_current
        )
        category_breakdown.append(category_ntr)
        
        total_ntr += category_ntr.total_ntr
        total_students += category_ntr.total_students
        total_credits += category_ntr.total_credits
        total_new_students += category_ntr.new_students
        total_current_students += category_ntr.current_students
        total_new_credits += category_ntr.new_credits
        total_current_credits += category_ntr.current_credits
        total_new_ntr += category_ntr.ntr_new
        total_current_ntr += category_ntr.ntr_current
    
    # Build summary
    percentage_of_goal = (total_ntr / ntr_goal * 100) if ntr_goal > 0 else 0
    gap_to_goal = ntr_goal - total_ntr
    
    summary = NTRSummary(
        total_ntr=total_ntr,
        ntr_goal=ntr_goal,
        percentage_of_goal=percentage_of_goal,
        gap_to_goal=gap_to_goal,
        total_students=total_students,
        total_credits=total_credits,
        new_students=total_new_students,
        current_students=total_current_students,
        new_credits=total_new_credits,
        current_credits=total_current_credits,
        new_ntr=total_new_ntr,
        current_ntr=total_current_ntr
    )
    
    # Build detailed DataFrame
    breakdown_data = []
    for cat_ntr in category_breakdown:
        breakdown_data.append({
            'Category': cat_ntr.category,
            'Degree Type': cat_ntr.degree_type,
            'New Students': cat_ntr.new_students,
            'Current Students': cat_ntr.current_students,
            'Total Students': cat_ntr.total_students,
            'New Credits': cat_ntr.new_credits,
            'Current Credits': cat_ntr.current_credits,
            'Total Credits': cat_ntr.total_credits,
            'CPC New': cat_ntr.cpc_new,
            'CPC Current': cat_ntr.cpc_current,
            'NTR New': cat_ntr.ntr_new,
            'NTR Current': cat_ntr.ntr_current,
            'Total NTR': cat_ntr.total_ntr
        })
    
    breakdown_df = pd.DataFrame(breakdown_data)
    
    # Add totals row
    if not breakdown_df.empty:
        totals = {
            'Category': 'Grand Total',
            'Degree Type': '',
            'New Students': summary.new_students,
            'Current Students': summary.current_students,
            'Total Students': summary.total_students,
            'New Credits': summary.new_credits,
            'Current Credits': summary.current_credits,
            'Total Credits': summary.total_credits,
            'CPC New': None,
            'CPC Current': None,
            'NTR New': summary.new_ntr,
            'NTR Current': summary.current_ntr,
            'Total NTR': summary.total_ntr
        }
        breakdown_df = pd.concat([breakdown_df, pd.DataFrame([totals])], ignore_index=True)
    
    return summary, category_breakdown, breakdown_df


def get_cpc_rates_table() -> pd.DataFrame:
    """Get a formatted table of all CPC rates."""
    data = []
    seen = set()
    
    for (category, degree_type, student_type), rate in CPC_RATES.items():
        # Skip aliases
        if category in ['Corporate', 'Retail']:
            continue
        
        key = (category, degree_type)
        if key in seen:
            continue
        seen.add(key)
        
        cpc_new = get_cpc_rate(category, degree_type, 'New')
        cpc_current = get_cpc_rate(category, degree_type, 'Current')
        
        # Add program notes for CPE
        notes = ''
        if category == 'CPE':
            if degree_type == 'Masters':
                notes = 'MEADS - Applied Data Science'
            elif degree_type in ['Graduate Certificate', 'Professional Graduate Certificate']:
                notes = 'Enterprise AI, ADS Foundations'
        
        data.append({
            'Category': category,
            'Degree Type': degree_type,
            'CPC (New)': f"${cpc_new:,.0f}",
            'CPC (Current)': f"${cpc_current:,.0f}",
            'Notes': notes,
        })
    
    return pd.DataFrame(data)


def calculate_ntr_by_program(census_df: pd.DataFrame, semester: str = '2026S') -> pd.DataFrame:
    """Calculate NTR breakdown by program."""
    if census_df is None or census_df.empty:
        return pd.DataFrame()
    
    df = census_df.copy()
    
    # Filter for semester
    if 'Census_1_SEMESTER' in df.columns:
        df = df[df['Census_1_SEMESTER'] == semester].copy()
    
    # Determine credit column
    credit_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    if credit_col not in df.columns:
        credit_col = 'Census_1_NUMBER_OF_CREDITS'
    
    if credit_col not in df.columns:
        return pd.DataFrame()
    
    # Convert and classify
    df[credit_col] = pd.to_numeric(df[credit_col], errors='coerce').fillna(0)
    df['Census_1_BEACON_FLAG'] = pd.to_numeric(df['Census_1_BEACON_FLAG'], errors='coerce').fillna(0)
    df['Student_Type'] = df.apply(classify_student_type, axis=1)
    df['Student_Category'] = df.apply(classify_student_category, axis=1)
    
    # Filter valid records
    valid_categories = ['ASAP', 'Select Professional Online', 'Beacon', 'Corporate', 'Retail', 'CPE']
    valid_degrees = ['Masters', 'Graduate Certificate', 'Non-Degree', 'Professional Graduate Certificate']
    
    df = df[
        (df['Student_Category'].isin(valid_categories)) &
        (df['Census_1_DEGREE_TYPE'].isin(valid_degrees))
    ].copy()
    
    if df.empty:
        return pd.DataFrame()
    
    # Calculate NTR per row
    def calc_row_ntr(row):
        category = row['Student_Category']
        degree_type = row['Census_1_DEGREE_TYPE']
        student_type = row['Student_Type']
        
        # For CPE programs, get appropriate degree type
        if category == 'CPE':
            program = row.get('Census_1_PRIMARY_PROGRAM_OF_STUDY', '')
            degree_type = get_cpe_degree_type(program, degree_type)
        
        cpc = get_cpc_rate(category, degree_type, student_type)
        return row[credit_col] * cpc
    
    df['NTR'] = df.apply(calc_row_ntr, axis=1)
    
    # Aggregate by program
    program_col = 'Census_1_PRIMARY_PROGRAM_OF_STUDY'
    if program_col not in df.columns:
        return pd.DataFrame()
    
    program_summary = df.groupby(program_col).agg({
        'Census_1_STUDENT_ID': 'nunique',
        credit_col: 'sum',
        'NTR': 'sum'
    }).reset_index()
    
    program_summary.columns = ['Program', 'Students', 'Credits', 'NTR']
    program_summary = program_summary.sort_values('NTR', ascending=False)
    
    return program_summary

