"""
Password authentication module for the CPE Funnel Dashboard.
Uses Streamlit's secrets management for secure password storage.
"""

import streamlit as st


def check_password() -> bool:
    """
    Displays a password input and validates against the stored secret.
    Returns True if authenticated, otherwise stops the app.
    """
    # Initialize authentication state
    if "authenticated" not in st.session_state:
        st.session_state.authenticated = False
    
    # If already authenticated, return True
    if st.session_state.authenticated:
        return True
    
    # Display login form
    st.markdown(
        """
        <style>
        .login-container {
            max-width: 400px;
            margin: 100px auto;
            padding: 40px;
            background: linear-gradient(135deg, #1A1F2E 0%, #0E1117 100%);
            border-radius: 16px;
            border: 1px solid #A41034;
            box-shadow: 0 20px 60px rgba(164, 16, 52, 0.15);
        }
        .login-title {
            text-align: center;
            font-size: 28px;
            font-weight: 700;
            color: #FAFAFA;
            margin-bottom: 8px;
        }
        .login-subtitle {
            text-align: center;
            font-size: 14px;
            color: #888;
            margin-bottom: 32px;
        }
        </style>
        """,
        unsafe_allow_html=True
    )
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown('<div class="login-title">CPE Analytics</div>', unsafe_allow_html=True)
        st.markdown('<div class="login-subtitle">Graduate Online Enrollment Dashboard</div>', unsafe_allow_html=True)
        
        password = st.text_input(
            "Enter Password",
            type="password",
            placeholder="Password",
            key="password_input"
        )
        
        col_a, col_b, col_c = st.columns([1, 2, 1])
        with col_b:
            login_button = st.button("Login", width="stretch", type="primary")
        
        if login_button or password:
            if password == st.secrets.get("password", ""):
                st.session_state.authenticated = True
                st.rerun()
            elif password:
                st.error("Incorrect password. Please try again.")
    
    # Stop the app here if not authenticated
    st.stop()
    return False


def logout():
    """Logs out the current user."""
    st.session_state.authenticated = False
    st.rerun()


def show_logout_button():
    """Displays a logout button in the sidebar."""
    with st.sidebar:
        st.markdown("---")
        if st.button("Logout", width="stretch"):
            logout()

