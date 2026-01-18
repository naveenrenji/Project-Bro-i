"""
UI helpers + global design tokens for the CPE Funnel Dashboard.

Goal: keep styling consistent across pages while minimizing brittle CSS selectors.
"""

import streamlit as st

from utils.constants import STEVENS_RED, BACKGROUND_CARD, STEVENS_WHITE, STEVENS_GRAY_LIGHT


def inject_global_styles():
    """Inject global design tokens + a few reusable classes."""
    st.markdown(
        f"""
<style>
:root {{
  --cpe-radius-sm: 10px;
  --cpe-radius-md: 12px;
  --cpe-radius-lg: 16px;
  --cpe-pad-sm: 12px;
  --cpe-pad-md: 16px;
  --cpe-border: rgba(255,255,255,0.10);
  --cpe-border-strong: rgba(255,255,255,0.16);
  --cpe-surface: {BACKGROUND_CARD};
  --cpe-text: {STEVENS_WHITE};
  --cpe-text-muted: {STEVENS_GRAY_LIGHT};
  --cpe-accent: {STEVENS_RED};
}}

.cpe-card {{
  background: var(--cpe-surface);
  border: 1px solid var(--cpe-border);
  border-radius: var(--cpe-radius-md);
  padding: var(--cpe-pad-md);
}}

.cpe-card--tight {{
  padding: var(--cpe-pad-sm);
}}

.cpe-card--accent-left {{
  border-left: 4px solid var(--cpe-accent);
}}

.cpe-section-title {{
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.70);
  margin-bottom: 10px;
}}

/* Link styled as a button (for internal routing when Streamlit APIs don't apply) */
.cpe-link-button {{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: var(--cpe-radius-md);
  border: 1px solid var(--cpe-border-strong);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.92);
  text-decoration: none;
  font-weight: 600;
}}
.cpe-link-button:hover {{
  background: rgba(255,255,255,0.06);
}}

/* Accessibility: visible focus rings */
:where(button, a, input, textarea, [role="button"], [tabindex]):focus-visible {{
  outline: 3px solid rgba(164, 16, 52, 0.65);
  outline-offset: 2px;
  border-radius: 8px;
}}

/* Accessibility: minimum comfortable tap targets on mobile */
@media (max-width: 768px) {{
  .stButton > button {{
    min-height: 44px;
  }}
}}
</style>
        """,
        unsafe_allow_html=True,
    )

