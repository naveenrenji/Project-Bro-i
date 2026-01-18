"""
Data loading module for the CPE Funnel Dashboard.
Uses Slate data for applications/funnel and Census data for continuing/returning and NTR.
Matches automatedv6.py logic for Slate transformations.
"""

from typing import Optional, Tuple, Dict, List
import hashlib

import streamlit as st
import pandas as pd
import numpy as np
import requests
import io
import os
import glob
from datetime import datetime, timedelta
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

def get_config():
    """Get configuration from Streamlit secrets or defaults."""
    return {
        'slate_url': st.secrets.get('slate_url', ''),
        'data_folder': st.secrets.get('data_folder', ''),
        'census_folder': st.secrets.get('census_folder', ''),
    }


def _hash_bytes(b: Optional[bytes]) -> str:
    """Stable short hash for caching keys (safe for None)."""
    if not b:
        return ""
    return hashlib.sha256(b).hexdigest()[:16]


def _read_upload_bytes(uploaded_file) -> Tuple[Optional[bytes], str]:
    """
    Read bytes from a Streamlit UploadedFile safely.
    Returns (bytes_or_none, filename).
    """
    if uploaded_file is None:
        return None, ""
    try:
        return uploaded_file.getvalue(), getattr(uploaded_file, "name", "") or ""
    except Exception:
        return None, getattr(uploaded_file, "name", "") or ""


# ============================================================================
# STANDARDIZATION FUNCTIONS (matching automatedv6.py)
# ============================================================================

def standardize_program_name(name: str) -> str:
    """Remove extra text, convert to lowercase then title-case."""
    if pd.isna(name):
        return ''
    name = str(name).lower().strip()
    name = name.replace('(online)', '').strip()
    name = name.replace('mba -', '').strip()
    name = name.replace('(mba)', '').strip()
    return name.title()


def standardize_school_name(name: str) -> str:
    """Standardize school name to either SSB, SES, CPE, or Dual Degree."""
    if pd.isna(name):
        return 'Dual Degree'
    name = str(name).upper().strip()
    school_mappings = {
        'SOB': 'SSB',
        'SES': 'SES',
        'SSE': 'SES',
        '': 'Dual Degree',
        'DUAL DEGREE': 'Dual Degree',
        'SCHOOL OF BUSINESS': 'SSB',
        'SCHOOL OF ENGINEERING AND SCIENCE': 'SES',
        'SCHOOL OF SYSTEMS AND ENTERPRISES': 'SES',
        'CPE': 'CPE',
        'CONTINUING AND PROFESSIONAL EDUCATION': 'CPE',
        'PROFESSIONAL EDUCATION': 'CPE'
    }
    
    if name == '' or 'DUAL' in name:
        return 'Dual Degree'
    if 'CPE' in name:
        return 'CPE'
    
    return school_mappings.get(name, name)


def standardize_degree_type(degree_interest: str) -> str:
    """Return 'Graduate Certificate', 'Dual Degree' or 'Masters' based on the text."""
    if pd.isna(degree_interest):
        return ''
    text = str(degree_interest).lower().strip()
    if 'certificate' in text:
        return 'Graduate Certificate'
    elif 'dual' in text:
        return 'Dual Degree'
    return 'Masters'


def standardize_company_name(name: str) -> str:
    """Standardizes company names using known mappings."""
    if pd.isna(name) or not str(name).strip():
        return ''
    original = str(name).lower().strip()
    company_mappings = {
        'pfizer': 'Pfizer',
        'collins': 'Collins Aerospace',
        'bae': 'BAE Systems',
        'bank of america': 'Bank of America',
        'merrill lynch': 'Bank of America',
        'l3': 'L3Harris',
        'l3harris': 'L3Harris',
        'astra': 'AstraZeneca',
        'northrop': 'Northrop Grumman',
        'ngc': 'Northrop Grumman',
        'verizon': 'Verizon',
        'jpmorgan': 'JPMorgan Chase',
        'jp morgan': 'JPMorgan Chase',
        'jpmc': 'JPMorgan Chase',
        'lockheed': 'Lockheed Martin',
        'boeing': 'Boeing',
        'raytheon': 'Raytheon Technologies',
        'rtx': 'Raytheon Technologies',
        'navair': 'NAVAIR',
        'us army': 'US Army',
        'picatinny': 'US Army',
        'devcom': 'US Army',
    }
    for keyword, standard_name in company_mappings.items():
        if keyword in original:
            return standard_name
    return ' '.join(word.capitalize() for word in original.split())


def get_single_value(val):
    """If a column is duplicated or if we get a Series, pull the first non-null value."""
    if isinstance(val, pd.Series):
        return val.dropna().iloc[0] if not val.dropna().empty else ''
    return val if pd.notna(val) else ''


# CPE Program keywords for identification
CPE_PROGRAM_KEYWORDS = [
    'applied data science',
    'meads',
    'enterprise ai',
    'enterprise artificial intelligence',
    'ads foundations',
    'applied data science foundations',
]


def is_cpe_program(program_name: str) -> bool:
    """Check if a program name belongs to CPE."""
    if not program_name:
        return False
    program_lower = str(program_name).lower().strip()
    return any(keyword in program_lower for keyword in CPE_PROGRAM_KEYWORDS)


# ============================================================================
# ENROLLMENT DATE PROCESSING (matching automatedv6.py lines 1702-1717)
# ============================================================================

def clean_and_yoy_status(date_str, valid_years: list = None) -> tuple:
    """
    Parse date and determine YOY status.
    A student is considered enrolled if they have a valid enrollment date in a valid year.
    Matches automatedv6.py clean_and_yoy_status function.
    """
    if valid_years is None:
        valid_years = [2024, 2025, 2026]
    
    try:
        parsed = pd.to_datetime(date_str, errors='coerce')
        if pd.isna(parsed):
            return "", "no"
        formatted = parsed.strftime('%Y/%m/%d')
        # If there's a valid enrollment date in a valid year, mark as enrolled
        if parsed.year in valid_years:
            return formatted, "yes"
        return formatted, "no"
    except:
        return str(date_str), "no"


def derive_yoy_status_from_enrollment_date(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive YOY Status from Date of Enrollment or Term of Enrollment columns.
    Matches automatedv6.py lines 1797-1806.
    """
    if df is None or df.empty:
        return df
        
    df = df.copy()
    valid_years = [2024, 2025, 2026]
    
    # Find column names (case-insensitive)
    col_map = {c.lower(): c for c in df.columns}
    doe_col = col_map.get('date of enrollment')
    toe_col = col_map.get('term of enrollment')
    
    def get_yoy_status(date_val):
        """Determine if enrolled based on Date of Enrollment."""
        if pd.isna(date_val) or str(date_val).strip() == '':
            return 'no'
        try:
            parsed = pd.to_datetime(date_val, errors='coerce')
            if pd.isna(parsed):
                return 'no'
            if parsed.year in valid_years:
                return 'yes'
            return 'no'
        except:
            return 'no'
    
    # Check for Date of Enrollment column first (primary method)
    if doe_col:
        non_null = df[doe_col].notna().sum()
        print(f"[ENROLLMENT] Found '{doe_col}' column with {non_null} non-null values")
        
        df['YOY Status'] = df[doe_col].apply(get_yoy_status)
        enrolled_count = (df['YOY Status'] == 'yes').sum()
        print(f"[ENROLLMENT] Derived {enrolled_count} enrolled students from Date of Enrollment")
    
    # Fallback to Term of Enrollment
    elif toe_col:
        non_null = df[toe_col].notna().sum()
        print(f"[ENROLLMENT] Found '{toe_col}' column with {non_null} non-null values")
        
        df['YOY Status'] = df[toe_col].apply(
            lambda x: 'yes' if pd.notna(x) and any(str(year) in str(x) for year in valid_years) else 'no'
        )
        enrolled_count = (df['YOY Status'] == 'yes').sum()
        print(f"[ENROLLMENT] Derived {enrolled_count} enrolled students from Term of Enrollment")
    
    # If neither column exists
    else:
        print(f"[ENROLLMENT] WARNING: No enrollment column found!")
        print(f"[ENROLLMENT] Available columns: {list(df.columns)}")
        df['YOY Status'] = 'no'
    
    return df


# ============================================================================
# ASAP-SPECIFIC FUNCTIONS (matching automatedv6.py)
# ============================================================================

def _normalize_asap_decision(val: str) -> str:
    """Normalize ASAP decision values."""
    s = str(val or '').strip().lower()
    if s.startswith('-'):
        s = s[1:].strip()
    s = s.replace('asap approved', 'asap approved').replace('asap_approved', 'asap approved')
    return s


def _asap_flags(decision_last_name_raw: str) -> tuple:
    """
    Returns flags for ASAP applications:
    - is_submit_app (bool): Only count as application if Decision Last Name is not blank
    - admitted (bool): Only ASAP approved cases are admitted
    - offer_accepted (bool)
    - offer_declined (bool)
    """
    s = _normalize_asap_decision(decision_last_name_raw)
    is_submit = len(s.strip()) > 0
    admitted = ('asap approved' in s) or ('approved' in s and 'asap' in s)
    offer_acc = ('accept' in s and 'asap approved' in s)
    offer_dec = ('decline' in s and 'asap approved' in s)
    return is_submit, admitted, offer_acc, offer_dec


def reclassify_app_tags(row: pd.Series) -> str:
    """
    Return the Application Category based on various fields.
    Matches automatedv6.py logic exactly.
    """
    # Force ASAP category when Data Source is ASAP
    if str(row.get('Data Source', '')) == 'ASAP':
        return 'ASAP'
    
    school_applied = get_single_value(row.get('School Applied for', ''))
    degree_interest = get_single_value(row.get('Degree of Interest (app)', ''))
    program = get_single_value(row.get('Area of Study - Value', ''))
    school_upper = str(school_applied).upper().strip()
    
    # Check for CPE programs first
    if 'CPE' in school_upper:
        return 'CPE'
    
    # Check if program is a CPE program (MEADS, Enterprise AI, ADS Foundations)
    if is_cpe_program(program):
        return 'CPE'
    
    if (not school_applied or school_upper == '') and str(degree_interest).strip() != 'Dual Degree':
        return 'CPE'
        
    tag = str(get_single_value(row.get('App Tags', '')))
    employer = get_single_value(row.get('If Yes, Name of Sponsoring Employer', ''))
    sponsoring_employer = get_single_value(row.get('Corporate Sponsor', ''))
    noodle_exception = str(get_single_value(row.get('Noodle Exception', ''))).lower()
    special_program = get_single_value(row.get('Special Program', ''))

    if not tag or 'EDD' in tag:
        return 'Stevens Online (Retail)'
    if special_program.strip():
        return 'Special Program'
    if 'Noodle' in tag:
        if not noodle_exception or ('exclude' not in noodle_exception):
            return 'Select Professional Online'
    if 'Beacon' in tag:
        return 'Beacon'
    if 'Corporate' in tag or employer.strip() or sponsoring_employer.strip():
        return 'Stevens Online (Corporate)'

    return 'Stevens Online (Retail)'


# ============================================================================
# DATA LOADING FUNCTIONS
# ============================================================================

@st.cache_data(ttl=3*60*60, show_spinner=False)  # 3-hour cache
def fetch_slate_data() -> Tuple[Optional[pd.DataFrame], datetime]:
    """Fetch live Slate data from the API. Cached for 3 hours."""
    config = get_config()
    slate_url = config['slate_url']
    
    if not slate_url:
        return None, datetime.now()
    
    try:
        response = requests.get(slate_url, timeout=60)
        response.raise_for_status()
        csv_content = response.content.decode('utf-8')
        df = pd.read_csv(io.StringIO(csv_content))
        print(f"[SLATE] Fetched {len(df)} rows from Slate API")
        return df, datetime.now()
    except Exception as e:
        st.error(f"Error fetching Slate data: {e}")
        return None, datetime.now()


def find_latest_applications_file(data_folder: str, season: str = 'Spring') -> Optional[str]:
    """Find the most recent applications Excel file for a given season."""
    if not data_folder or not os.path.exists(data_folder):
        return None
    
    pattern = os.path.join(data_folder, f"Online Applications CPE ({season}) YoY*.xlsx")
    files = glob.glob(pattern)
    
    if not files:
        return None
    
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]


def safe_fillna(df: pd.DataFrame) -> pd.DataFrame:
    """Safely fill NA values without dtype warnings (matching automatedv6.py)."""
    df = df.copy()
    for col in df.columns:
        if df[col].dtype == 'object':
            df[col] = df[col].fillna('')
        elif df[col].dtype in ['float64', 'int64']:
            df[col] = df[col].fillna(0)
        else:
            df[col] = df[col].fillna('')
    return df


# ============================================================================
# CENSUS DATA LOADING (for continuing/returning + NTR)
# ============================================================================

def find_latest_census_file(census_folder: str) -> Optional[str]:
    """Find the most recent census CSV file in the census folder."""
    if not census_folder or not os.path.exists(census_folder):
        return None
    pattern = os.path.join(census_folder, "daily_census_file_*.csv")
    files = glob.glob(pattern)
    if not files:
        return None
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]


def _categorize_census_row(row: pd.Series) -> str:
    """Map census row to student category (matching automatedv7.py logic)."""
    degree_type = str(row.get('Census_1_DEGREE_TYPE', '')).strip()
    location = str(row.get('Census_1_STUDENT_LOCATION_DETAILED', '')).strip()
    corporate_flag = str(row.get('Census_1_CORPORATE_STUDENT', '')).strip()
    beacon_flag = row.get('Census_1_BEACON_FLAG', 0)

    if degree_type == 'Non-Degree':
        return 'ASAP'
    if location == 'Online Noodle':
        return 'Select Professional Online'
    if beacon_flag == 1:
        return 'Beacon'
    if location == 'Online' and corporate_flag == 'Corporate':
        return 'Corporate'
    if location == 'Online':
        return 'Retail'
    return 'Uncategorized'


@st.cache_data(ttl=3*60*60, show_spinner=False)
def _load_census_from_bytes(file_bytes: bytes, file_name: str, semester: str = '2026S') -> Dict:
    """Load census data from uploaded bytes (Streamlit Cloud friendly)."""
    try:
        df = pd.read_csv(io.BytesIO(file_bytes), low_memory=False)
    except Exception as e:
        print(f"[CENSUS] Error loading uploaded census '{file_name}': {e}")
        return {}

    # Filter for semester + online + graduate
    df = df[df['Census_1_SEMESTER'] == semester].copy()
    df = df[df['Census_1_STUDENT_LOCATION_DETAILED'].isin(['Online', 'Online Noodle'])].copy()
    df = df[df['Census_1_DEGREE_TYPE'].isin(['Masters', 'Graduate Certificate', 'Non-Degree'])].copy()

    if df.empty:
        return {}

    # Numeric conversions
    df['Census_1_BEACON_FLAG'] = pd.to_numeric(df['Census_1_BEACON_FLAG'], errors='coerce').fillna(0)
    credit_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    if credit_col not in df.columns:
        credit_col = 'Census_1_NUMBER_OF_CREDITS'
    df[credit_col] = pd.to_numeric(df[credit_col], errors='coerce').fillna(0)

    # Category mapping
    df['Student_Category'] = df.apply(_categorize_census_row, axis=1)

    # Status counts
    new_count = int((df['Census_1_STUDENT_STATUS'] == 'New').sum())
    continuing_count = int((df['Census_1_STUDENT_STATUS'] == 'Continuing').sum())
    returning_count = int((df['Census_1_STUDENT_STATUS'] == 'Returning').sum())

    return {
        'file': file_name,
        'total': int(df['Census_1_STUDENT_ID'].nunique()) if 'Census_1_STUDENT_ID' in df.columns else len(df),
        'new': new_count,
        'continuing': continuing_count,
        'returning': returning_count,
        'by_category': df['Student_Category'].value_counts().to_dict(),
        'total_credits': float(df[credit_col].sum()),
        'credit_column': credit_col,
        'raw_df': df
    }


@st.cache_data(ttl=3*60*60, show_spinner=False)
def load_census_data(
    semester: str = '2026S',
    uploaded_bytes: Optional[bytes] = None,
    uploaded_name: str = "",
) -> Dict:
    """
    Load census data for enrollment breakdown and NTR calculation.
    Returns counts for new/continuing/returning and raw filtered dataframe.
    """
    # If uploaded census provided, prefer it (Streamlit Cloud friendly).
    if uploaded_bytes:
        return _load_census_from_bytes(uploaded_bytes, uploaded_name or "uploaded_census.csv", semester=semester)

    config = get_config()
    census_folder = config.get('census_folder', '')
    census_file = find_latest_census_file(census_folder)
    if not census_file:
        return {}

    try:
        df = pd.read_csv(census_file, low_memory=False)
    except Exception as e:
        print(f"[CENSUS] Error loading census file: {e}")
        return {}

    # Filter for semester + online + graduate
    df = df[df['Census_1_SEMESTER'] == semester].copy()
    df = df[df['Census_1_STUDENT_LOCATION_DETAILED'].isin(['Online', 'Online Noodle'])].copy()
    df = df[df['Census_1_DEGREE_TYPE'].isin(['Masters', 'Graduate Certificate', 'Non-Degree'])].copy()

    if df.empty:
        return {}

    # Numeric conversions
    df['Census_1_BEACON_FLAG'] = pd.to_numeric(df['Census_1_BEACON_FLAG'], errors='coerce').fillna(0)
    credit_col = 'Census_1_CENSUS3_TOTAL_NUMBER_OF_CREDIT_HOURS'
    if credit_col not in df.columns:
        credit_col = 'Census_1_NUMBER_OF_CREDITS'
    df[credit_col] = pd.to_numeric(df[credit_col], errors='coerce').fillna(0)

    # Category mapping
    df['Student_Category'] = df.apply(_categorize_census_row, axis=1)

    # Status counts
    new_count = int((df['Census_1_STUDENT_STATUS'] == 'New').sum())
    continuing_count = int((df['Census_1_STUDENT_STATUS'] == 'Continuing').sum())
    returning_count = int((df['Census_1_STUDENT_STATUS'] == 'Returning').sum())

    # Aggregate
    data = {
        'file': census_file,
        'total': int(df['Census_1_STUDENT_ID'].nunique()) if 'Census_1_STUDENT_ID' in df.columns else len(df),
        'new': new_count,
        'continuing': continuing_count,
        'returning': returning_count,
        'by_category': df['Student_Category'].value_counts().to_dict(),
        'total_credits': float(df[credit_col].sum()),
        'credit_column': credit_col,
        'raw_df': df
    }

    return data


def transform_application_data(df: pd.DataFrame, source: str = 'MAIN') -> pd.DataFrame:
    """
    Transform raw application data with standardized fields.
    Matches automatedv6.py transform_application_data_with_inferred_season exactly.
    Handles both MAIN and ASAP sources with different logic.
    """
    if df is None or df.empty:
        return pd.DataFrame()
    
    df = df.copy()
    df = safe_fillna(df)
    
    # Infer season from Round column
    if 'Round' in df.columns:
        if df['Round'].str.contains('Fall', case=False, na=False).any():
            df['Season'] = 'Fall'
        elif df['Round'].str.contains('Summer', case=False, na=False).any():
            df['Season'] = 'Summer'
        elif df['Round'].str.contains('Spring', case=False, na=False).any():
            df['Season'] = 'Spring'
        else:
            df['Season'] = 'Unknown'
    else:
        df['Season'] = 'Unknown'
    
    # Set Data Source
    df['Data Source'] = 'ASAP' if source.upper() == 'ASAP' else 'MAIN'
    
    # Basic field standardization
    if 'Degree of Interest (app)' in df.columns:
        df['Degree Type'] = df['Degree of Interest (app)'].apply(standardize_degree_type)
    else:
        df['Degree Type'] = ''
    
    if 'If Yes, Name of Sponsoring Employer' in df.columns:
        df['Sponsoring Company'] = df['If Yes, Name of Sponsoring Employer'].apply(standardize_company_name)
    else:
        df['Sponsoring Company'] = ''
    
    if 'School Applied for' in df.columns:
        df['School (Expanded)'] = df['School Applied for'].apply(standardize_school_name)
    else:
        df['School (Expanded)'] = ''
    
    if 'Area of Study - Value' in df.columns:
        df['Program Cleaned'] = df['Area of Study - Value'].apply(standardize_program_name)
    else:
        df['Program Cleaned'] = ''
    
    # Override Degree Type to Professional Graduate Certificate for specific programs
    professional_cert_programs = [
        'Systems Engineering Foundations',
        'Enterprise Ai',
        'Applied Data Science Foundations'
    ]
    
    for prog in professional_cert_programs:
        mask = df['Program Cleaned'].str.contains(prog, case=False, na=False)
        df.loc[mask, 'Degree Type'] = 'Professional Graduate Certificate'
    
    # Override school for dual degree programs
    if 'Degree Type' in df.columns:
        df.loc[df['Degree Type'] == 'Dual Degree', 'School (Expanded)'] = 'Dual Degree'
    
    # Source-specific logic (matching automatedv6.py lines 414-475)
    if source.upper() == 'ASAP':
        # ASAP-specific defaults and logic
        df['Degree Type'] = 'Masters'
        df['School (Expanded)'] = 'SES'
        if 'School Applied for' not in df.columns or df['School Applied for'].eq('').all():
            df['School Applied for'] = 'SES'
        
        # ASAP-specific metrics using flags
        if 'Decision Last Name' in df.columns:
            decision_col = df['Decision Last Name'].fillna('')
        else:
            decision_col = pd.Series('', index=df.index)
        
        if 'YOY Status' in df.columns:
            yoy_col = df['YOY Status'].fillna('')
        else:
            yoy_col = pd.Series('', index=df.index)
        
        flags = decision_col.apply(_asap_flags)
        df['Is Application'] = flags.apply(lambda t: 1 if t[0] else 0)
        df['Admit Status'] = flags.apply(lambda t: 'admitted' if t[1] else 'not admitted')
        df['Offer Accepted'] = flags.apply(lambda t: 'yes' if t[2] else '')
        df['Offer Declined'] = flags.apply(lambda t: 'yes' if t[3] else '')
        df['Enrolled'] = yoy_col.apply(lambda x: 'yes' if str(x).strip().lower() == 'yes' else '')
        enrolled_count = (df['Enrolled'] == 'yes').sum()
        print(f"[TRANSFORM ASAP] Enrolled count before filter: {enrolled_count}")
        
        # Filter to only valid ASAP applications (Decision Last Name not blank)
        print(f"[ASAP] Total rows before filtering: {len(df)}")
        df = df[df['Is Application'] == 1].copy()
        print(f"[ASAP] Valid applications after filtering: {len(df)}")
    else:
        # MAIN source logic - every row is an application
        df['Is Application'] = 1
        
        # Get Decision Last Name column for admit determination
        decision_col = df['Decision Last Name'].fillna('') if 'Decision Last Name' in df.columns else pd.Series('', index=df.index)
        bin_col = df['Bin'].fillna('') if 'Bin' in df.columns else pd.Series('', index=df.index)
        
        # Helper function to determine admit status from both Bin and Decision Last Name
        def determine_admit_status(row_idx):
            bin_val = str(bin_col.iloc[row_idx]).lower().strip()
            decision_val = str(decision_col.iloc[row_idx]).lower().strip()
            
            # Check Bin column first (standard path)
            if bin_val in ['admit', 'conditional admit']:
                return 'admitted'
            
            # For CPE and other apps with empty Bin, check Decision Last Name
            # Admit/Matric, Admit Provisionally, Admit/Decline all mean the student was admitted
            admit_keywords = ['admit/matric', 'admit provisionally', 'admit/decline', 'admit/withdraw']
            if any(keyword in decision_val for keyword in admit_keywords):
                return 'admitted'
            
            return 'not admitted'
        
        df['Admit Status'] = [determine_admit_status(i) for i in range(len(df))]
        
        # Offer accepted via Decision Last Name - "Admit/Matric" means accepted
        df['Offer Accepted'] = decision_col.apply(
            lambda x: 'yes' if str(x).lower().strip() == 'admit/matric' else ''
        )
        
        # Offer declined via Decision Last Name
        df['Offer Declined'] = decision_col.apply(
            lambda x: 'yes' if 'admit/decline' in str(x).lower().strip() else ''
        )
        
        # Enrollment status via YOY Status (derived from Date of Enrollment)
        if 'YOY Status' in df.columns:
            df['Enrolled'] = df['YOY Status'].apply(
                lambda x: 'yes' if str(x).strip().lower() == 'yes' else ''
            )
            enrolled_count = (df['Enrolled'] == 'yes').sum()
            print(f"[TRANSFORM MAIN] Enrolled count: {enrolled_count}")
        else:
            print("[TRANSFORM MAIN] WARNING: YOY Status column not found!")
            df['Enrolled'] = ''
    
    # Ensure Is Application is numeric
    df['Is Application'] = pd.to_numeric(df['Is Application'], errors='coerce').fillna(0).astype(int)
    
    # Application category (must be done after Data Source is set)
    df['Application Category'] = df.apply(reclassify_app_tags, axis=1)
    
    return df


@st.cache_data(ttl=3*60*60, show_spinner=False)
def load_applications_data(
    uploaded_bytes: Optional[bytes] = None,
    uploaded_name: str = "",
) -> Tuple[Dict, datetime]:
    """
    Load application data for multiple years FROM SLATE ONLY.
    Matches automatedv6.py logic exactly:
    - Separates ASAP data (Round == 'ASAP') from MAIN data
    - ASAP data is only added to 2026
    - Splits by Round column BEFORE transformation
    Returns dict with 'current', 'previous', 'two_years_ago' DataFrames.
    """
    config = get_config()
    data_folder = config['data_folder']
    
    result = {
        'current': None,
        'previous': None,
        'two_years_ago': None,
        'current_year': 2026,
        'previous_year': 2025,
        'two_years_ago_year': 2024,
    }
    
    raw_df = None
    data_source = None
    
    # Prefer uploaded file if provided (Streamlit Cloud friendly).
    if uploaded_bytes:
        try:
            raw_df = pd.read_excel(io.BytesIO(uploaded_bytes))
            data_source = f"UPLOAD:{uploaded_name or 'applications.xlsx'}"
            print(f"[UPLOAD] Loaded {len(raw_df)} rows from {uploaded_name}")
        except Exception as e:
            print(f"[UPLOAD] Could not load applications upload: {e}")

    # Try to load from local file (more reliable for Date of Enrollment)
    if raw_df is None:
        spring_file = find_latest_applications_file(data_folder, 'Spring')
        if spring_file:
            try:
                raw_df = pd.read_excel(spring_file)
                data_source = 'FILE'
                print(f"[FILE] Loaded {len(raw_df)} rows from {spring_file}")
                
                # Check if Date of Enrollment exists
                if 'Date of Enrollment' in raw_df.columns:
                    doe_count = raw_df['Date of Enrollment'].notna().sum()
                    print(f"[FILE] Date of Enrollment column has {doe_count} non-null values")
            except Exception as e:
                print(f"[FILE] Could not load: {e}")
    
    # If no file, try Slate API
    if raw_df is None:
        slate_df, _ = fetch_slate_data()
        if slate_df is not None and not slate_df.empty:
            raw_df = slate_df
            data_source = 'SLATE'
            result['raw_slate'] = slate_df
            print(f"[SLATE] Loaded {len(slate_df)} total rows")
            
            if 'Date of Enrollment' in raw_df.columns:
                doe_count = raw_df['Date of Enrollment'].notna().sum()
                print(f"[SLATE] Date of Enrollment column has {doe_count} non-null values")
    
    if raw_df is None or raw_df.empty:
        return result, datetime.now()
    
    # === MATCHING AUTOMATEDV6.PY LOGIC (lines 1781-1889) ===
    
    if 'Round' not in raw_df.columns:
        print("[WARNING] 'Round' column not found")
        result['current'] = transform_application_data(raw_df, source='MAIN')
        return result, datetime.now()
    
    # 1. Separate ASAP and MAIN data (automatedv6.py lines 1782-1783)
    data_asap = raw_df[raw_df['Round'] == 'ASAP'].copy()
    data_main = raw_df[raw_df['Round'] != 'ASAP'].copy()
    
    print(f"[DATA] Separated - MAIN: {len(data_main)}, ASAP: {len(data_asap)}")
    print(f"[DATA] Source: {data_source}")
    print(f"[DATA] Columns in raw_df: {list(raw_df.columns)[:10]}...")  # First 10 columns
    
    # Check for Date of Enrollment before processing
    if 'Date of Enrollment' in raw_df.columns:
        print(f"[DATA] Date of Enrollment found with {raw_df['Date of Enrollment'].notna().sum()} non-null values")
    else:
        print("[DATA] WARNING: Date of Enrollment column NOT FOUND!")
        print(f"[DATA] Available columns: {[c for c in raw_df.columns if 'date' in c.lower() or 'enroll' in c.lower()]}")
    
    # 1.5 Derive YOY Status from Date of Enrollment (automatedv6.py lines 1797-1806)
    data_main = derive_yoy_status_from_enrollment_date(data_main)
    if not data_asap.empty:
        data_asap = derive_yoy_status_from_enrollment_date(data_asap)
    
    # Verify YOY Status was set
    if 'YOY Status' in data_main.columns:
        main_enrolled = (data_main['YOY Status'] == 'yes').sum()
        print(f"[DATA] MAIN YOY Status 'yes' count: {main_enrolled}")
    if not data_asap.empty and 'YOY Status' in data_asap.columns:
        asap_enrolled = (data_asap['YOY Status'] == 'yes').sum()
        print(f"[DATA] ASAP YOY Status 'yes' count: {asap_enrolled}")
    
    # 2. Split MAIN data by year (automatedv6.py lines 1828-1848)
    main_2024 = data_main[data_main['Round'].str.contains('2024', case=False, na=False)].copy()
    main_2025 = data_main[data_main['Round'].str.contains('2025', case=False, na=False)].copy()
    main_2026 = data_main[data_main['Round'].str.contains('2026', case=False, na=False)].copy()
    
    print(f"[MAIN] Data shapes - 2024: {len(main_2024)}, 2025: {len(main_2025)}, 2026: {len(main_2026)}")
    
    # 3. Transform MAIN data
    main_2024_std = transform_application_data(main_2024, source='MAIN')
    main_2025_std = transform_application_data(main_2025, source='MAIN')
    main_2026_std = transform_application_data(main_2026, source='MAIN')
    
    # 4. Transform ASAP data (only for 2026) (automatedv6.py lines 1860-1880)
    asap_2026_std = pd.DataFrame()
    if not data_asap.empty:
        # Force ASAP Round to 2026 Spring Graduate
        data_asap['Round'] = '2026 Spring Graduate'
        
        # Ensure school column exists
        if 'School Applied for' not in data_asap.columns:
            data_asap['School Applied for'] = 'SES'
        else:
            data_asap['School Applied for'] = data_asap['School Applied for'].replace('', 'SES')
        
        asap_2026_std = transform_application_data(data_asap, source='ASAP')
        print(f"[ASAP] Transformed 2026 ASAP data: {len(asap_2026_std)} applications")
    
    # 5. Combine MAIN + ASAP data (automatedv6.py lines 1882-1886)
    result['two_years_ago'] = main_2024_std
    result['previous'] = main_2025_std
    result['current'] = pd.concat([main_2026_std, asap_2026_std], ignore_index=True)
    
    # 6. Ensure Is Application is numeric (automatedv6.py lines 1896-1898)
    for key in ['current', 'previous', 'two_years_ago']:
        df = result[key]
        if df is not None and not df.empty and 'Is Application' in df.columns:
            result[key]['Is Application'] = pd.to_numeric(df['Is Application'], errors='coerce').fillna(0).astype(int)
    
    # Debug: Show final counts
    for year, key in [(2024, 'two_years_ago'), (2025, 'previous'), (2026, 'current')]:
        df = result[key]
        if df is not None and not df.empty:
            apps = int(df['Is Application'].sum())
            admits = int((df['Admit Status'] == 'admitted').sum())
            offers = int((df['Offer Accepted'] == 'yes').sum())
            enrolls = int((df['Enrolled'] == 'yes').sum())
            print(f"[FINAL] {year} - Apps: {apps}, Admits: {admits}, Offers: {offers}, Enrolls: {enrolls}")
            
            # Show source breakdown for 2026
            if key == 'current' and 'Data Source' in df.columns:
                main_count = len(df[df['Data Source'] == 'MAIN'])
                asap_count = len(df[df['Data Source'] == 'ASAP'])
                print(f"[FINAL] 2026 breakdown - MAIN: {main_count}, ASAP: {asap_count}")
    
    return result, datetime.now()


# ============================================================================
# MAIN DATA LOADING FUNCTION
# ============================================================================

@st.cache_data(ttl=3*60*60, show_spinner="Loading data...")
def load_all_data(
    census_uploaded_bytes: Optional[bytes] = None,
    census_uploaded_name: str = "",
    apps_uploaded_bytes: Optional[bytes] = None,
    apps_uploaded_name: str = "",
) -> Tuple[Dict, datetime]:
    """
    Load all data sources and return a comprehensive data dictionary.
    Uses Slate data for applications and Census data for enrollments/NTR.
    """
    # Load applications data (Slate API by default; uploads/local file optional)
    applications, apps_time = load_applications_data(
        uploaded_bytes=apps_uploaded_bytes,
        uploaded_name=apps_uploaded_name,
    )
    census_data = load_census_data(
        uploaded_bytes=census_uploaded_bytes,
        uploaded_name=census_uploaded_name,
    )
    
    data = {
        'applications': applications,
        'census': census_data,
        'last_refresh': datetime.now(),
    }
    
    return data, datetime.now()


def get_last_refresh_info() -> Tuple[datetime, timedelta]:
    """Get the last refresh time and time until next refresh."""
    data, last_refresh = load_all_data()
    next_refresh = last_refresh + timedelta(hours=3)
    time_until_refresh = next_refresh - datetime.now()
    
    if time_until_refresh.total_seconds() < 0:
        time_until_refresh = timedelta(seconds=0)
    
    return last_refresh, time_until_refresh


def force_refresh():
    """Force a data refresh by clearing the cache."""
    load_all_data.clear()
    fetch_slate_data.clear()
    load_applications_data.clear()
    load_census_data.clear()