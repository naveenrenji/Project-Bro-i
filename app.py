"""
CPE Graduate Online Analytics Dashboard
Main application entry point with navigation and page routing.
"""

import streamlit as st
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add the current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from auth import check_password, show_logout_button
from data_loader import load_all_data, get_last_refresh_info, force_refresh
from utils.ui import inject_global_styles

# Stevens Brand Colors
STEVENS_RED = "#A41034"
STEVENS_GRAY_DARK = "#54585A"
STEVENS_GRAY_LIGHT = "#B1B3B3"
STEVENS_WHITE = "#FFFFFF"
BACKGROUND_DARK = "#0E1117"
BACKGROUND_CARD = "#1A1F2E"

# Page configuration - must be first Streamlit command
st.set_page_config(
    page_title="CPE Graduate Online Analytics",
    page_icon=None,
    layout="wide",
    # Mobile-first: keep sidebar collapsed by default; users can expand via hamburger menu.
    initial_sidebar_state="collapsed"
)

# Global UI tokens/classes
inject_global_styles()

# Use Streamlit's built-in logo function (appears in sidebar/header)
logo_path = Path(__file__).parent / "Stevens-CPE-logo-RGB_Linear-4C-BLK-bg.png"
if logo_path.exists():
    st.logo(str(logo_path), size="large")

# CSS to make navbar 2x larger (font, padding, height)
st.markdown("""
<style>
    /* Make header taller */
    header[data-testid="stHeader"] {
        min-height: 120px !important;
        padding: 12px 0 !important;
    }
    /* Make navigation elements larger */
    [data-testid="stNavigation"] {
        padding: 16px 24px !important;
        min-height: 60px !important;
    }
    [data-testid="stNavigation"] * {
        font-size: 2.5rem !important;
    }
    [data-testid="stNavigation"] a,
    [data-testid="stNavigation"] button {
        padding: 14px 24px !important;
        font-size: 2rem !important;
        font-weight: bold !important;
    }
    /* Make logo larger */
    [data-testid="stLogo"] img,
    [data-testid="stSidebarHeader"] img,
    .stLogo img,
    header img {
        height: 100px !important;
        width: auto !important;
        max-height: 100px !important;
    }
</style>
""", unsafe_allow_html=True)

st.markdown(f"""
<style>
    /* Force dark rendering even if user/browser prefers light */
    :root {{
        color-scheme: dark;
    }}
    html, body, .stApp, [data-testid="stAppViewContainer"] {{
        background: {BACKGROUND_DARK} !important;
    }}

    /* Main container */
    .main .block-container {{
        padding-top: 0;
        margin-top: -1rem;
        padding-bottom: 2rem;
        max-width: 1400px;
    }}

    /* Ask Navs floating widget (minimized by default, noticeable glow) */
    div.element-container:has(.navs-bubble-marker),
    div.element-container:has(.navs-panel-marker) {{
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
    }}

    /* Bubble (closed) */
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-bubble-marker) {{
        position: fixed !important;
        right: 24px;
        bottom: 24px;
        left: auto !important;
        z-index: 9999;
        width: 56px;
        height: 56px;
        background: transparent;
        padding: 0;
        margin: 0;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-bubble-marker) button {{
        width: 56px !important;
        height: 56px !important;
        border-radius: 999px !important;
        background: #1A1F2E !important;
        color: #FAFAFA !important;
        border: 1px solid rgba(164, 16, 52, 0.6) !important;
        box-shadow: 0 0 0 rgba(164, 16, 52, 0.0);
        animation: navsGlow 2.6s ease-in-out infinite;
    }}

    /* Panel (open) */
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) {{
        position: fixed !important;
        right: 24px;
        bottom: 24px;
        left: auto !important;
        z-index: 9999;
        width: 360px;
        max-width: 92vw;
        background: transparent;
        padding: 0;
        margin: 0;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) > div {{
        background: #121726;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 12px 30px rgba(0,0,0,0.45);
        padding: 12px;
    }}
    .navs-panel-header {{
        font-weight: 700;
        font-size: 14px;
        color: #FAFAFA;
        margin-bottom: 2px;
    }}
    .navs-panel-subtitle {{
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        margin-bottom: 10px;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) [data-testid="stVerticalBlockBorderWrapper"] {{
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) form {{
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) input {{
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: 12px !important;
        color: #FAFAFA !important;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) button {{
        border-radius: 10px !important;
        background: rgba(255,255,255,0.08) !important;
        color: #FAFAFA !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        animation: none !important;
        box-shadow: none !important;
    }}
    div[data-testid="stVerticalBlock"]:has(> div.element-container .navs-panel-marker) button:hover {{
        background: rgba(255,255,255,0.12) !important;
    }}
    @keyframes navsGlow {{
        0% {{
            box-shadow: 0 0 0 0 rgba(164, 16, 52, 0.0),
                        0 0 10px 2px rgba(164, 16, 52, 0.25);
        }}
        50% {{
            box-shadow: 0 0 0 6px rgba(164, 16, 52, 0.08),
                        0 0 16px 4px rgba(164, 16, 52, 0.45);
        }}
        100% {{
            box-shadow: 0 0 0 0 rgba(164, 16, 52, 0.0),
                        0 0 10px 2px rgba(164, 16, 52, 0.25);
        }}
    }}

    /* Mobile responsiveness */
    @media (max-width: 768px) {{
        .main .block-container {{
            padding-top: 1rem;
            padding-bottom: 1rem;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
            max-width: 100%;
        }}

        /* Reduce big header underline spacing on mobile */
        h2 {{
            margin-bottom: 1rem;
        }}

        /* Make dataframes and charts avoid horizontal overflow */
        .stPlotlyChart, .stDataFrame {{
            overflow-x: auto;
        }}

        /* Make sidebar buttons more touch-friendly */
        [data-testid="stSidebar"] .stButton > button {{
            padding: 0.9rem 1rem;
            font-size: 1rem;
        }}
    }}
    
    /* Sidebar styling - Stevens branded */
    [data-testid="stSidebar"] {{
        background: linear-gradient(180deg, {BACKGROUND_DARK} 0%, {BACKGROUND_CARD} 100%);
    }}
    
    [data-testid="stSidebar"] .stMarkdown h1 {{
        color: {STEVENS_WHITE};
        font-size: 1.5rem;
        margin-bottom: 0;
    }}
    
    /* Top navigation bar + header shell */
    header[data-testid="stHeader"] {{
        background: #242a3b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }}
    [data-testid="stNavigation"],
    [data-testid="stNavigation"] > div,
    [data-testid="stNavigation"] nav {{
        background: #242a3b;
    }}
    [data-testid="stNavigation"] {{
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 6px 10px;
        margin-bottom: 0;
    }}
    /* Nav items layout */
    [data-testid="stNavigation"] nav {{
        display: flex;
        align-items: center;
        gap: 12px;
    }}

    /* Nav label sizing */
    [data-testid="stNavigation"] * {{
        font-size: 0.95rem;
    }}

    /* Hide heading anchor links (chain icon) */
    h1 a, h2 a, h3 a, h4 a {{
        display: none !important;
    }}
    .stMarkdown a[href^="#"] {{
        display: none !important;
    }}

    /* Force reduce gap between header and content */
    [data-testid="stAppViewContainer"] > div:first-child {{
        padding-top: 0 !important;
        margin-top: 0 !important;
    }}
    .stApp > header + div {{
        padding-top: 0 !important;
    }}

    /* Navigation buttons */
    [data-testid="stSidebar"] .stButton > button {{
        width: 100%;
        text-align: left;
        padding: 0.75rem 1rem;
        margin-bottom: 0.25rem;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: {STEVENS_WHITE};
        font-size: 0.9rem;
        transition: all 0.2s ease;
    }}
    
    [data-testid="stSidebar"] .stButton > button:hover {{
        background: rgba(164, 16, 52, 0.2);
        border-left: 3px solid {STEVENS_RED};
    }}
    
    /* Active nav button */
    [data-testid="stSidebar"] .stButton > button[kind="primary"] {{
        background: rgba(164, 16, 52, 0.3);
        border-left: 3px solid {STEVENS_RED};
    }}
    
    /* Headers - Stevens branded */
    h1, h2, h3 {{
        color: {STEVENS_WHITE};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }}
    
    h2 {{
        border-bottom: 2px solid {STEVENS_RED};
        padding-bottom: 0.5rem;
        margin-bottom: 1.5rem;
    }}
    
    /* Metric cards */
    [data-testid="metric-container"] {{
        background: {BACKGROUND_CARD};
        border-radius: 4px;
        padding: 1rem;
        border-left: 3px solid {STEVENS_RED};
    }}
    
    /* DataFrames */
    .stDataFrame {{
        border-radius: 4px;
        overflow: hidden;
    }}
    
    /* Expanders */
    .streamlit-expanderHeader {{
        background: {BACKGROUND_CARD};
        border-radius: 4px;
    }}
    
    /* Hide default Streamlit branding (navigation is handled via native Streamlit nav) */
    #MainMenu {{visibility: hidden;}}
    footer {{visibility: hidden;}}
    
    /* Custom scrollbar */
    ::-webkit-scrollbar {{
        width: 8px;
        height: 8px;
    }}
    
    ::-webkit-scrollbar-track {{
        background: {BACKGROUND_CARD};
    }}
    
    ::-webkit-scrollbar-thumb {{
        background: {STEVENS_GRAY_DARK};
        border-radius: 4px;
    }}
    
    ::-webkit-scrollbar-thumb:hover {{
        background: {STEVENS_RED};
    }}
    
    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {{
        gap: 8px;
    }}
    
    .stTabs [data-baseweb="tab"] {{
        background: {BACKGROUND_CARD};
        border-radius: 4px 4px 0 0;
        padding: 8px 16px;
        color: {STEVENS_GRAY_LIGHT};
    }}
    
    .stTabs [aria-selected="true"] {{
        background: {STEVENS_RED};
        color: {STEVENS_WHITE};
    }}
</style>
""", unsafe_allow_html=True)


def render_sidebar():
    """Render the sidebar (status/actions). Navigation is handled by Streamlit."""
    with st.sidebar:
        # Logo/Title - Clean Stevens branding
        st.markdown(f"""
            <div style="text-align: center; padding: 1rem 0 2rem 0;">
                <div style="font-size: 1.5rem; font-weight: 700; color: {STEVENS_RED};">STEVENS</div>
                <div style="font-size: 0.85rem; color: {STEVENS_WHITE}; margin-top: 4px;">CPE Analytics</div>
                <div style="font-size: 0.75rem; color: {STEVENS_GRAY_LIGHT}; margin-top: 2px;">Graduate Online Dashboard</div>
            </div>
        """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        # Streamlit Cloud-friendly uploads (optional)
        st.markdown("### Data Inputs (Optional)")
        st.caption("For Streamlit Cloud: upload files here if you don't have local paths configured.")
        census_upload = st.file_uploader(
            "Upload Census CSV",
            type=["csv"],
            key="upload_census_csv",
            help="Optional. Used for continuing/returning enrollment + NTR calculations.",
        )
        apps_upload = st.file_uploader(
            "Upload Applications YoY Excel",
            type=["xlsx", "xls"],
            key="upload_apps_xlsx",
            help="Optional. Improves enrollment-date fidelity vs Slate API.",
        )
        if st.button("Clear Uploads", width="stretch", type="secondary"):
            st.session_state.pop("upload_census_csv", None)
            st.session_state.pop("upload_apps_xlsx", None)
            st.rerun()

        st.markdown("---")

        # Data refresh section
        st.markdown("### Data Status")
        
        try:
            # Prefer the already-loaded timestamp if available (avoids extra load_all_data calls).
            cached_last_refresh = st.session_state.get("last_refresh")
            if cached_last_refresh:
                last_refresh = cached_last_refresh
                next_refresh = last_refresh + timedelta(hours=3)
                time_until = next_refresh - datetime.now()
                if time_until.total_seconds() < 0:
                    time_until = timedelta(seconds=0)
            else:
                last_refresh, time_until = get_last_refresh_info()
            hours = int(time_until.total_seconds() // 3600)
            minutes = int((time_until.total_seconds() % 3600) // 60)
            
            st.markdown(f"""
                <div style="background: {BACKGROUND_CARD}; padding: 12px; border-radius: 4px; margin-bottom: 10px;">
                    <div style="font-size: 11px; color: {STEVENS_GRAY_LIGHT};">Last Refresh</div>
                    <div style="font-size: 13px; color: {STEVENS_WHITE};">{last_refresh.strftime('%I:%M %p')}</div>
                </div>
            """, unsafe_allow_html=True)
        except Exception:
            st.caption("Data not yet loaded")
        
        if st.button("Refresh Data", width="stretch"):
            force_refresh()
            st.rerun()
        
        # Logout button
        show_logout_button()
        
        # Footer
        st.markdown("---")
        st.markdown(f"""
            <div style="text-align: center; font-size: 11px; color: {STEVENS_GRAY_DARK};">
                Stevens Institute of Technology<br>
                Center for Professional Education<br>
                Spring 2026
            </div>
        """, unsafe_allow_html=True)


def _get_data() -> dict:
    """Get the latest loaded data dict from session state."""
    return st.session_state.get("data", {}) or {}


def page_executive_summary():
    from components import executive_summary
    executive_summary.render(_get_data())

    # In-app CTA to Ask Navs that preserves Streamlit session state (no full page reload).
    # This must live in the router layer where we have access to the StreamlitPage objects.
    if "_page_ai_ref" in st.session_state and st.session_state["_page_ai_ref"] is not None:
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            st.page_link(
                st.session_state["_page_ai_ref"],
                label="💬 Ask Navs for deeper analysis",
                width="stretch",
            )


def page_enrollment_funnel():
    from components import enrollment_funnel
    enrollment_funnel.render(_get_data())


def page_ntr_tracker():
    from components import ntr_tracker
    ntr_tracker.render(_get_data())


def page_program_intelligence():
    from components import program_intelligence
    program_intelligence.render(_get_data())


def page_corporate_cohorts():
    from components import corporate_cohorts
    corporate_cohorts.render(_get_data())


def page_historical_yoy():
    from components import historical_yoy
    historical_yoy.render(_get_data())


def page_ask_navs():
    from components import ai_assistant
    ai_assistant.render(_get_data())


def main():
    """Main application function."""
    # Check authentication
    check_password()

    # Load data once per rerun (Slate + Census). Pages read from session state.
    with st.spinner("Loading data from Slate and Census..."):
        try:
            census_bytes = None
            census_name = ""
            apps_bytes = None
            apps_name = ""

            if st.session_state.get("upload_census_csv") is not None:
                census_bytes = st.session_state["upload_census_csv"].getvalue()
                census_name = st.session_state["upload_census_csv"].name
            if st.session_state.get("upload_apps_xlsx") is not None:
                apps_bytes = st.session_state["upload_apps_xlsx"].getvalue()
                apps_name = st.session_state["upload_apps_xlsx"].name

            data, last_refresh = load_all_data(
                census_uploaded_bytes=census_bytes,
                census_uploaded_name=census_name,
                apps_uploaded_bytes=apps_bytes,
                apps_uploaded_name=apps_name,
            )
        except Exception as e:
            st.error(f"Error loading data: {e}")
            data, last_refresh = {}, None

    st.session_state["data"] = data
    if last_refresh is not None:
        st.session_state["last_refresh"] = last_refresh

    # Define pages once (used by top nav + sidebar fallback)
    p_exec = st.Page(page_executive_summary, title="Executive Summary")
    p_funnel = st.Page(page_enrollment_funnel, title="Enrollment Funnel")
    p_ntr = st.Page(page_ntr_tracker, title="NTR Tracker")
    p_prog = st.Page(page_program_intelligence, title="Program Intelligence")
    p_cohorts = st.Page(page_corporate_cohorts, title="Corporate Cohorts")
    p_yoy = st.Page(page_historical_yoy, title="Historical & YoY")
    p_ai = st.Page(page_ask_navs, title="Ask Navs")
    # Store AI page object for in-app CTA (kept in session state for this session only).
    st.session_state["_page_ai_ref"] = p_ai

    pages = [
        p_exec,
        p_funnel,
        p_ntr,
        p_prog,
        p_cohorts,
        p_yoy,
        p_ai,
    ]

    # Sidebar (status/actions)
    render_sidebar()

    # Native multipage navigation (top)
    current = st.navigation(pages, position="top", expanded=False)
    current.run()

    # Floating chat widget on every page except the dedicated chat page
    try:
        from components import ai_assistant
        page_hint = getattr(current, "title", "") or ""
        if page_hint not in ("Ask Navs", "Naveen"):
            ai_assistant.render_floating_widget(_get_data(), page_hint=page_hint)
    except Exception:
        # Never block page render if widget fails
        pass


if __name__ == "__main__":
    main()
