# Project Iris
## Stevens AI and BI Software
**by Naveen Mathews Renji**

---

## Overview

**Project Iris** is an AI-powered Business Intelligence dashboard built for Stevens Institute of Technology's College of Professional Education (CPE). It consolidates graduate enrollment data from Slate CRM and Census systems into a single, real-time analytics platform with an embedded AI assistant.

### Key Capabilities
- **Real-time enrollment funnel tracking** — Applications → Admits → Enrollments
- **Net Tuition Revenue (NTR) monitoring** — Goal progress, category breakdowns
- **Program-level intelligence** — Heatmaps, trend analysis, comparison tools
- **Corporate cohort analytics** — Partner enrollment tracking
- **Historical year-over-year analysis** — 3-year trends, conversion rates
- **AI-powered insights** — Ask Navs, a context-aware chat assistant available on every page

---

## Pages & Features

### 1. Executive Summary

![Executive Summary](screenshots/01.png)

The landing page provides a high-level snapshot of enrollment performance:

- **AI Insights** — Auto-generated summary highlighting key metrics (e.g., "Enrollments up 24% YoY with 381 new students. NTR at 82% of $9.8M goal.")
- **Enrollment Funnel KPIs** — Applications (878), Admits (798), Enrollments (381) with YoY deltas
- **Headcount Breakdown** — New (Slate), Continuing (Census), Returning (Census)
- **Mini Funnel Chart** — Visual funnel from applications to enrolled
- **By Application Category** — Horizontal bar chart showing enrollment by category
- **Floating Ask Navs Widget** — Available on every page for instant AI-powered Q&A

---

### 2. Enrollment Funnel

![Enrollment Funnel - Sankey](screenshots/02.png)

Interactive Sankey diagram showing student flow through the admissions pipeline:

- **Stage Cards** — Applications, Admits, Offers Accepted, Enrolled with rates
- **Sankey Flow** — Visualizes progression (green) and drop-off (gray) at each stage
- **Expandable Category Breakdowns** — Click to see per-category funnels

![Enrollment Funnel - Waterfall & YoY](screenshots/03.png)

- **Conversion Waterfall** — Bar chart showing student loss at each stage
- **Year-over-Year Table** — 2024/2025/2026 comparison with YoY percentages
- **By School** — Applications, Admits, Enrollments grouped by school (SES, CPE, Dual Degree, SSB)

---

### 3. NTR Tracker

![NTR Tracker](screenshots/04.png)

Tracks Net Tuition Revenue against the semester goal:

- **KPI Cards** — Total NTR ($8M), Goal ($9.8M), Progress (82%), Gap to Goal ($1.77M)
- **Gauge Chart** — Visual progress indicator
- **NTR by Category** — Horizontal bar chart (Corporate, Select Professional Online, Retail, etc.)
- **NTR by Degree** — Breakdown by degree type
- **Ask Navs Integration** — Example: "Best levers for growing NTR?" with AI response

---

### 4. Program Intelligence

![Program Intelligence - Heatmap](screenshots/05.png)

Deep dive into program-level performance:

- **Toggle Views** — Slate Funnel (Apps/Admits/Enroll) vs. Census Headcount
- **Performance Heatmap** — Programs on x-axis, metrics on y-axis, color intensity by volume
- **Programs by School** — Grouped bar chart

![Program Intelligence - Trends](screenshots/06.png)

- **Top Programs by Enrollment** — Horizontal bar chart (Management of AI leads with 222 enrollments)
- **Program Trends (YoY)** — Top Gainers and Needs Attention tables
- **Program Comparison** — Radar chart comparing selected programs across metrics

![Program Intelligence - Table](screenshots/07.png)

- **All Programs Table** — Filterable by School, Degree Type; sortable by Applications, Admits, Enrollments, Yield Rate, YoY %
- **Quick Stats** — Admit Rate, Yield Rate per program

---

### 5. Corporate Cohorts

![Corporate Cohorts](screenshots/08.png)

Analytics for corporate partnership enrollments:

- **KPI Cards** — Corporate Partners (31), Corporate Enrollments (1,063), Corporate Applications
- **Top Corporate Cohorts** — Horizontal bar chart (Pfizer leads with 587 enrollments)
- **Enrollment Distribution** — Pie chart showing cohort share
- **Headcount Intelligence** — Census-based breakdown of corporate headcount

---

### 6. Historical & YoY

![Historical & YoY - Trends](screenshots/09.png)

Three-year historical analysis:

- **3-Year Enrollment Funnel Trends** — Line chart (Applications, Admits, Enrollments from 2024–2026)
- **Year-over-Year Summary Table** — Applications, Admits, Enrollments, Admit Rate, Yield Rate by year
- **2026 Enrollments by Category** — Pie chart (Stevens Online Corporate 70%, CPE, ASAP, etc.)

![Historical & YoY - School & Rates](screenshots/10.png)

- **Applications by School (3-Year)** — Grouped bar chart (SES, CPE, Dual Degree, SSB)
- **Conversion Rates Over Time** — Admit Rate and Yield Rate line chart
- **YoY Change by Category** — Bar chart showing percentage change by enrollment category

---

### 7. Ask Navs (AI Assistant)

![Ask Navs](screenshots/11.png)

Dedicated AI chat page powered by Google Gemini:

- **Persona** — Naveen, a professional and approachable BI assistant
- **Two-Stage Context Planning** — AI determines which data categories are relevant before generating a response
- **Conversation Memory** — Chat history persists across page navigations
- **Suggested Questions** — Pre-built prompts for common queries
- **Floating Widget** — Also accessible on every other page via the bottom-right chat bubble

**Example Interaction:**
> **User:** What's driving enrollment growth?
>
> **Naveen:** Hey there! Great to see you. We have some solid momentum heading into Spring 2026. The 24% year over year growth in enrollments is a massive win for the team. Here is the breakdown of what is fueling that engine.
>
> **Corporate Channel Dominance**
> - Stevens Online (Corporate) is the primary engine behind our growth.
> - This category delivered 267 enrollments with an impressive 73% yield rate.
>
> **AI Program Momentum**
> - Management Of Artificial Intelligence is our standout performer.
> - This program alone brought in 222 enrollments and maintained a high 75% yield.

---

## Technical Highlights

| Component | Technology |
|-----------|------------|
| Frontend | Streamlit |
| Data Sources | Slate CRM API, Census CSV |
| AI Engine | Google Gemini (gemini-3-flash-preview) |
| Visualizations | Plotly |
| Hosting | Streamlit Community Cloud |
| Auth | Password-protected access |

---

## Data Flow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Slate CRM  │─────▶│  Dashboard  │◀─────│   Census    │
│   (Apps)    │      │   (Iris)    │      │  (Headcount)│
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Gemini    │
                    │  (Ask Navs) │
                    └─────────────┘
```

---

## Deployment

The dashboard auto-deploys to Streamlit Community Cloud on every push to the `main` branch. A refresh script (`scripts/refresh_and_push.sh`) can be run to:
1. Fetch the latest data from Slate and Census
2. Save snapshots to `data/snapshots/`
3. Commit and push to GitHub, triggering a redeploy

---

## Contact

**Naveen Mathews Renji**  
AI & BI Engineering Manager  
Stevens Institute of Technology — College of Professional Education

---

*Document generated January 2026*
