# Projct IRIS Analytics Dashboard

###Developer - Naveen Renji

A comprehensive, password-protected Streamlit dashboard for tracking the full enrollment funnel from applications to enrollments and Net Tuition Revenue (NTR).

## Features

- **Executive Summary**: Key metrics, KPIs, and high-level visualizations
- **Enrollment Funnel**: Sankey diagrams and conversion tracking
- **NTR Tracker**: Net Tuition Revenue analysis by category and student type
- **Program Intelligence**: Program-level analytics with heatmaps and comparisons
- **Corporate Cohorts**: Corporate partner enrollment tracking
- **Historical & YoY**: Year-over-year trend analysis

## Setup

### Local Development

1. **Install dependencies**:
   ```bash
   cd "CPE Funnel Dashboard"
   pip install -r requirements.txt
   ```

2. **Configure secrets**:
   Create `.streamlit/secrets.toml` with:
   ```toml
   password = "your_password"
   slate_url = "your_slate_api_url"
   census_folder = "/path/to/census/files"
   data_folder = "/path/to/data/folder"
   ```

3. **Run the dashboard**:
   ```bash
   streamlit run app.py
   ```

### Streamlit Cloud Deployment

1. Push the code to GitHub (secrets.toml is gitignored)
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your GitHub repo
4. Add secrets in the Streamlit Cloud dashboard:
   - Go to App Settings → Secrets
   - Add the same secrets as in secrets.toml
5. Ensure `runtime.txt` is present to pin Python 3.11 for Streamlit Cloud

### Snapshot-Based Deploys (No External Files Needed)

To avoid relying on local file paths in Streamlit Cloud, you can snapshot the
latest data into the repo and let the app read from `data/snapshots/`.

1. Make sure `.streamlit/secrets.toml` has:
   ```toml
   slate_url = "your_slate_api_url"
   census_folder = "/path/to/census/files"
   data_folder = "/path/to/data/folder"
   ```
2. Run the one-command refresh + deploy:
   ```bash
   ./scripts/refresh_and_push.sh
   ```
This pulls the latest data, commits it with a timestamp, and pushes to GitHub.
Streamlit Cloud will auto-redeploy on push.

Note: keep the repo private if you are committing data snapshots.

## Data Sources

- **Slate API**: Live application data from Stevens Slate system
- **Census Files**: Daily census CSV files with enrollment data
- **Historical Files**: Excel files for year-over-year comparisons

## Data Refresh

Data is automatically cached and refreshed every 3 hours. Users can see:
- Last refresh timestamp
- Countdown to next refresh
- Manual "Force Refresh" button

## Password Protection

The dashboard requires password authentication. Configure the password in:
- Local: `.streamlit/secrets.toml`
- Cloud: Streamlit Cloud Secrets settings

## Technology Stack

- **Streamlit**: Web framework
- **Plotly**: Interactive visualizations
- **Pandas**: Data processing
- **NumPy**: Numerical operations

## Project Structure

```
CPE Funnel Dashboard/
├── app.py                 # Main entry point
├── auth.py                # Password authentication
├── data_loader.py         # Data fetching & caching
├── ntr_calculator.py      # NTR calculation logic
├── analytics.py           # Analytics engine
├── components/
│   ├── executive_summary.py
│   ├── enrollment_funnel.py
│   ├── ntr_tracker.py
│   ├── program_intelligence.py
│   ├── corporate_cohorts.py
│   └── historical_yoy.py
├── utils/
│   └── formatting.py
├── requirements.txt
└── .streamlit/
    ├── config.toml        # Theme configuration
    └── secrets.toml       # Secrets (gitignored)
```

## NTR Calculation

Net Tuition Revenue is calculated using Cost Per Credit (CPC) rates:

| Category | Degree Type | New Student | Current Student |
|----------|-------------|-------------|-----------------|
| Select Professional Online | Masters | $1,395 | $1,650 |
| Beacon | Masters | $290 | $290 |
| Corporate | Masters | $1,300 | $1,550 |
| Corporate | Grad Cert | $1,195 | $1,195 |
| Retail | Masters | $1,395 | $1,723 |
| Retail | Grad Cert | $1,993 | $2,030 |
| ASAP | Non-Degree | $875 | $875 |

## Contact

Stevens Institute of Technology
Center for Professional Education

