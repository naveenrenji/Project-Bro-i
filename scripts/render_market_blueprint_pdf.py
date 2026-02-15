#!/usr/bin/env python3
"""
Render the Strategic Market Blueprint as a brand-compliant PDF.

Uses Playwright to render a branded HTML page with Chart.js charts
and export as a multi-page PDF following CPE brand guidelines.

Usage:
    source .venv/bin/activate
    python scripts/render_market_blueprint_pdf.py
"""

from __future__ import annotations

import base64
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

LOGO_SVG = (
    ROOT
    / "CPE-assets(logos)"
    / "CPE Canva"
    / "Stevens-CPE-logo-RGB_Linear-4C.svg"
)

OUT_PDF = ROOT / "docs" / "Strategic_Market_Blueprint.pdf"
TEMP_HTML = ROOT / "scripts" / "_temp_blueprint.html"
SCREENSHOT = ROOT / "scripts" / "blueprint_screenshot.png"


# ── Header / footer templates for Playwright PDF ─────────────────────

HEADER_TPL = (
    '<div style="width:100%;height:3px;background:#A32638;'
    'margin:0;padding:0;"></div>'
)

FOOTER_TPL = (
    '<div style="width:100%;font-size:9px;color:#363D45;'
    "font-family:'IBM Plex Sans',Arial,sans-serif;"
    "display:flex;justify-content:space-between;"
    'padding:0 0.75in;">'
    "<span>Stevens Institute of Technology &nbsp;|&nbsp; "
    "College of Professional Education</span>"
    '<span><span class="pageNumber"></span> / '
    '<span class="totalPages"></span></span></div>'
)


# ── Full branded HTML template ───────────────────────────────────────

HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Stevens CPE — Strategic Market Blueprint</title>

  <!-- Brand fonts: Saira (headlines) + IBM Plex Sans (body) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Saira:wght@100;200;300;400;500&display=swap" rel="stylesheet">

  <!-- Tailwind (layout utilities) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    :root {
      --bg:#FFFFFF;
      --surface:#F5F5F6;
      --surface2:rgba(0,0,0,.03);
      --elevated:#EBEBEC;
      --border:rgba(0,0,0,.12);
      --red:#A32638;
      --dark-gray:#363D45;
      --gray:#7F7F7F;
      --light-gray:#E4E5E6;
      --text:#000000;
      --muted:rgba(0,0,0,.55);
      --ai:#7E57C2; --fin:#00897B; --soft:#1E88E5; --biz:#F57C00;
    }

    body {
      background:var(--bg);color:var(--text);
      font-family:'IBM Plex Sans',Arial,sans-serif;
      font-size:10.5pt;line-height:1.55;margin:0;padding:0;
    }

    h1,h2,h3,h4 {
      font-family:'Saira','Arial Narrow',Arial,sans-serif;
      font-weight:200;color:#000;margin:0;
    }
    h1{font-size:32pt;line-height:1.15}
    h2{font-size:18pt;line-height:1.3}
    h3{font-size:13pt;line-height:1.3;font-weight:300}

    .glass{background:var(--surface2);border:1px solid var(--border);border-radius:10px;}

    .badge{display:inline-flex;padding:.15rem .6rem;border-radius:99px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:1px solid transparent;font-family:'IBM Plex Sans',Arial,sans-serif;}
    .b-ai{color:var(--ai);border-color:rgba(126,87,194,.35);background:rgba(126,87,194,.08)}
    .b-fin{color:var(--fin);border-color:rgba(0,137,123,.35);background:rgba(0,137,123,.08)}
    .b-soft{color:var(--soft);border-color:rgba(30,136,229,.35);background:rgba(30,136,229,.08)}
    .b-biz{color:var(--biz);border-color:rgba(245,124,0,.35);background:rgba(245,124,0,.08)}
    .dot{width:8px;height:8px;border-radius:50%;margin-right:6px;display:inline-block}

    .section-title{
      font-family:'Saira',sans-serif;font-weight:200;color:#000;
      font-size:20pt;padding-bottom:6px;
      border-bottom:2px solid var(--red);margin-bottom:14px;
    }
    .tier-header{
      font-size:10pt;font-weight:700;color:var(--red);
      text-transform:uppercase;letter-spacing:.08em;
      padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,.1);
      margin-bottom:12px;font-family:'IBM Plex Sans',sans-serif;
    }

    /* ── Cover ─────────────────────────────────────── */
    .cover-page{
      min-height:100vh;display:flex;flex-direction:column;
      justify-content:center;padding:0 40px;position:relative;
    }
    .cover-page .logo{width:260px;margin-bottom:40px;}
    .cover-page .subtitle{font-size:12pt;color:var(--dark-gray);margin-top:10px;font-weight:300;}
    .cover-page .source{font-size:9pt;color:var(--red);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:20px;}
    .cover-page .date-line{font-size:9pt;color:var(--gray);margin-top:6px;}
    .cover-page .footer-text{position:absolute;bottom:30px;left:40px;font-size:8pt;color:var(--gray);}
    .asterism-svg{position:absolute;bottom:30px;right:30px;width:180px;height:180px;opacity:0.7;}

    /* ── Print / PDF ───────────────────────────────── */
    @page{size:Letter;margin:0.75in;}
    @media print{
      body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
      .cover-page{break-after:page;page-break-after:always;}
      .section-page{break-before:page;page-break-before:always;}
      .glass,.card-item{break-inside:avoid;page-break-inside:avoid;}
    }
  </style>
</head>
<body>

<!-- ═══════════════ COVER PAGE ═══════════════════════════════════════ -->
<div class="cover-page">
  <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:var(--red);"></div>

  <img src="__LOGO_DATA_URI__" alt="Stevens CPE" class="logo" />

  <h1>Strategic Market<br>Blueprint</h1>
  <p class="subtitle">Generated Market Analysis &amp; Portfolio Blueprint</p>
  <p class="source">Data Source: BLS Employment Projections 2024&ndash;2034</p>
  <p class="date-line">__GENERATION_DATE__</p>

  <!-- Asterism gesture (brand Section 2.4) -->
  <svg class="asterism-svg" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fadeH" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#7F7F7F" stop-opacity="1"/>
        <stop offset="100%" stop-color="#7F7F7F" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="fadeD" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#363D45" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#363D45" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="90" y1="90" x2="180" y2="90" stroke="url(#fadeH)" stroke-width="1"/>
    <line x1="90" y1="90" x2="90"  y2="0"  stroke="#363D45" stroke-width="1"/>
    <line x1="90" y1="90" x2="172" y2="52" stroke="#7F7F7F" stroke-width="1"/>
    <line x1="90" y1="90" x2="172" y2="128" stroke="url(#fadeD)" stroke-width="1"/>
  </svg>

  <p class="footer-text">Stevens Institute of Technology &nbsp;|&nbsp; College of Professional Education</p>
</div>

<!-- ═══════════════ STRATEGY ═════════════════════════════════════════ -->
<section class="section-page" style="padding-top:10px;">
  <h2 class="section-title">Strategic Product Categorization</h2>
  <p style="color:var(--dark-gray);max-width:600px;margin-bottom:8px;">
    Creating tiered product categories suitable for the market based on high-signal domains.
  </p>
  <p style="color:var(--red);font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">
    Data Source: Signals from BLS Employment Projections 2024&ndash;2034.
  </p>
  <p style="color:var(--dark-gray);font-size:9.5pt;margin-bottom:20px;max-width:620px;line-height:1.6;">
    Tiered product strategy: launch fast, workforce-aligned <strong style="color:#000">PGCs</strong> to capture
    high-signal skill demand, then enable stackable pathways into <strong style="color:#000">Master&rsquo;s</strong>
    programs for depth and credential lift, and into a <strong style="color:#000">Professional Doctorate</strong>
    for applied leadership and advanced practice within aligned domains.
  </p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
    <!-- AI & Data -->
    <div class="glass" style="padding:16px;border-left:4px solid var(--ai);">
      <span class="badge b-ai" style="margin-bottom:8px;">AI &amp; Data</span>
      <div style="font-size:9.5pt;color:var(--dark-gray);margin-top:8px;">
        <strong style="color:#000;display:block;margin-bottom:3px;">Packaging Cluster</strong>
        Applied AI, MLOps, Data Science Foundations.
        <div style="margin-top:8px;font-size:8.5pt;color:var(--gray);">
          <strong style="color:#000;display:block;margin-bottom:2px;">Evidence Skills</strong>
          Python, Machine Learning, SQL, Data Visualization.
        </div>
      </div>
    </div>
    <!-- FinTech -->
    <div class="glass" style="padding:16px;border-left:4px solid var(--fin);">
      <span class="badge b-fin" style="margin-bottom:8px;">FinTech</span>
      <div style="font-size:9.5pt;color:var(--dark-gray);margin-top:8px;">
        <strong style="color:#000;display:block;margin-bottom:3px;">Packaging Cluster</strong>
        Quant Finance, AI in Finance, Market Infrastructure.
        <div style="margin-top:8px;font-size:8.5pt;color:var(--gray);">
          <strong style="color:#000;display:block;margin-bottom:2px;">Evidence Skills</strong>
          Risk Management, Financial Modeling, Compliance, Algorithms.
        </div>
      </div>
    </div>
    <!-- Software -->
    <div class="glass" style="padding:16px;border-left:4px solid var(--soft);">
      <span class="badge b-soft" style="margin-bottom:8px;">Software</span>
      <div style="font-size:9.5pt;color:var(--dark-gray);margin-top:8px;">
        <strong style="color:#000;display:block;margin-bottom:3px;">Packaging Cluster</strong>
        Cloud, SRE, Cybersecurity, Agentic Engineering.
        <div style="margin-top:8px;font-size:8.5pt;color:var(--gray);">
          <strong style="color:#000;display:block;margin-bottom:2px;">Evidence Skills</strong>
          Java/Python, System Design, Cloud Security, DevOps.
        </div>
      </div>
    </div>
    <!-- Business -->
    <div class="glass" style="padding:16px;border-left:4px solid var(--biz);">
      <span class="badge b-biz" style="margin-bottom:8px;">Business &amp; Leadership</span>
      <div style="font-size:9.5pt;color:var(--dark-gray);margin-top:8px;">
        <strong style="color:#000;display:block;margin-bottom:3px;">Packaging Cluster</strong>
        Tech Management, Digital Strategy, Leadership.
        <div style="margin-top:8px;font-size:8.5pt;color:var(--gray);">
          <strong style="color:#000;display:block;margin-bottom:2px;">Evidence Skills</strong>
          Strategic Planning, Project Mgmt, Change Leadership.
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════ MARKET SIGNALS ═══════════════════════════════════ -->
<section class="section-page" style="padding-top:10px;">
  <h2 class="section-title">Market Signals: Volume &times; Growth</h2>
  <p style="color:var(--gray);font-size:9pt;margin-bottom:14px;">
    X&nbsp;=&nbsp;employment volume (2024). Y&nbsp;=&nbsp;projected growth (2024&ndash;2034).
    Bubble size&nbsp;=&nbsp;opportunity score.
  </p>
  <div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
    <span class="badge b-ai"><span class="dot" style="background:var(--ai)"></span>AI &amp; Data</span>
    <span class="badge b-fin"><span class="dot" style="background:var(--fin)"></span>FinTech</span>
    <span class="badge b-soft"><span class="dot" style="background:var(--soft)"></span>Software Eng</span>
    <span class="badge b-biz"><span class="dot" style="background:var(--biz)"></span>Business</span>
  </div>
  <div style="position:relative;height:420px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;">
    <canvas id="signalsChart"></canvas>
  </div>
  <div style="margin-top:8px;font-size:8pt;color:var(--gray);" id="bubbleLegendInline"></div>
</section>

<!-- ═══════════════ TOP-RIGHT ROLES ══════════════════════════════════ -->
<section class="section-page" style="padding-top:10px;">
  <h3 class="section-title" style="font-size:16pt;">High Volume &times; High Growth Roles</h3>
  <p style="color:var(--gray);font-size:9pt;margin-bottom:10px;">
    Roles in the top-right quadrant, ranked by opportunity score.
  </p>
  <div class="glass" style="padding:14px;" id="topRightList"></div>
</section>

<!-- ═══════════════ OPPORTUNITY BLUEPRINT ════════════════════════════ -->
<section class="section-page" style="padding-top:10px;">
  <div style="text-align:center;margin-bottom:20px;">
    <h2 class="section-title" style="display:inline-block;">The Opportunity Blueprint</h2>
    <p style="color:var(--gray);font-size:9.5pt;margin-top:8px;">
      A fully stackable ecosystem: PGC (9cr) &rarr; Master&rsquo;s (30cr) &rarr; Doctorate (60cr).
    </p>
  </div>

  <!-- TIER 1: PGCs -->
  <div style="margin-bottom:24px;">
    <div class="tier-header">
      Tier 1: Professional Graduate Certificates (9 Credits)
      <span style="float:right;font-size:8pt;font-weight:400;color:var(--gray);text-transform:none;letter-spacing:0;">
        *Certificates stack into aligned Masters and Doctorate programs.
      </span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" id="pgcGrid"></div>
  </div>

  <!-- TIER 2: MASTERS -->
  <div style="margin-bottom:24px;">
    <div class="tier-header">
      Tier 2: Master&rsquo;s Degrees (30 Credits)
      <span style="float:right;font-size:8pt;font-weight:400;color:var(--gray);text-transform:none;letter-spacing:0;">
        *Eligible PGCs stack into this.
      </span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" id="mastersGrid"></div>
  </div>

  <!-- TIER 3: DOCTORATES -->
  <div>
    <div class="tier-header">Tier 3: Professional Doctorates</div>
    <div class="glass" style="padding:16px;border-left:4px solid var(--red);display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(163,38,56,0.2);display:flex;align-items:center;justify-content:center;color:var(--red);font-weight:700;font-size:18px;border:1px solid rgba(163,38,56,0.4);">D</div>
        <div>
          <div style="font-weight:600;color:#000;font-size:12pt;">Professional Doctorate in [Management / Engineering]</div>
          <div style="font-size:8.5pt;color:var(--gray);margin-top:2px;">Advanced applied research for executive leadership.</div>
        </div>
      </div>
      <div style="text-align:right;">
        <span class="badge" style="background:rgba(163,38,56,0.1);color:var(--red);border-color:rgba(163,38,56,0.3);margin-bottom:4px;display:block;">60 Credits</span>
        <div style="font-size:7.5pt;color:var(--gray);">Up to 30 credits eligible to be stacked.</div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════ JAVASCRIPT ═══════════════════════════════════════ -->
<script>
const DATA = {
  market: [
    {"domain":"Business & Leadership","soc_code":"11-1011","occupation_title":"Chief executives","employment_2024":309400,"employment_2034":322700,"growth_pct":4.3,"annual_openings":22200,"median_wage":206420,"opportunity_score":57.0,"sweet_spot":false},
    {"domain":"Business & Leadership","soc_code":"11-1021","occupation_title":"General and operations managers","employment_2024":3712900,"employment_2034":3876800,"growth_pct":4.4,"annual_openings":308700,"median_wage":102950,"opportunity_score":55.6,"sweet_spot":false},
    {"domain":"Business & Leadership","soc_code":"11-2021","occupation_title":"Marketing managers","employment_2024":407000,"employment_2034":433700,"growth_pct":6.6,"annual_openings":34300,"median_wage":161030,"opportunity_score":67.4,"sweet_spot":false},
    {"domain":"Business & Leadership","soc_code":"11-3021","occupation_title":"Computer and information systems managers","employment_2024":667100,"employment_2034":768700,"growth_pct":15.2,"annual_openings":55600,"median_wage":171200,"opportunity_score":83.7,"sweet_spot":true},
    {"domain":"FinTech","soc_code":"11-3031","occupation_title":"Financial managers","employment_2024":868600,"employment_2034":997400,"growth_pct":14.8,"annual_openings":74600,"median_wage":161700,"opportunity_score":83.0,"sweet_spot":true},
    {"domain":"Business & Leadership","soc_code":"11-3121","occupation_title":"Human resources managers","employment_2024":221900,"employment_2034":233000,"growth_pct":5.0,"annual_openings":17900,"median_wage":140030,"opportunity_score":50.7,"sweet_spot":false},
    {"domain":"Business & Leadership","soc_code":"11-3131","occupation_title":"Training and development managers","employment_2024":46400,"employment_2034":49200,"growth_pct":5.8,"annual_openings":3800,"median_wage":127090,"opportunity_score":34.8,"sweet_spot":false},
    {"domain":"Business & Leadership","soc_code":"13-1082","occupation_title":"Project management specialists","employment_2024":1046300,"employment_2034":1105000,"growth_pct":5.6,"annual_openings":78200,"median_wage":100750,"opportunity_score":47.8,"sweet_spot":false},
    {"domain":"Business & Leadership","soc_code":"13-1111","occupation_title":"Management analysts","employment_2024":1075100,"employment_2034":1169700,"growth_pct":8.8,"annual_openings":98100,"median_wage":101190,"opportunity_score":60.4,"sweet_spot":false},
    {"domain":"FinTech","soc_code":"13-2051","occupation_title":"Financial and investment analysts","employment_2024":368500,"employment_2034":389600,"growth_pct":5.7,"annual_openings":25100,"median_wage":101350,"opportunity_score":43.7,"sweet_spot":false},
    {"domain":"FinTech","soc_code":"13-2052","occupation_title":"Personal financial advisors","employment_2024":326000,"employment_2034":357200,"growth_pct":9.6,"annual_openings":24100,"median_wage":102140,"opportunity_score":51.9,"sweet_spot":false},
    {"domain":"FinTech","soc_code":"13-2054","occupation_title":"Financial risk specialists","employment_2024":60500,"employment_2034":64400,"growth_pct":6.5,"annual_openings":4800,"median_wage":106000,"opportunity_score":33.0,"sweet_spot":false},
    {"domain":"FinTech","soc_code":"13-2061","occupation_title":"Financial examiners","employment_2024":65100,"employment_2034":77200,"growth_pct":18.5,"annual_openings":5700,"median_wage":90400,"opportunity_score":34.4,"sweet_spot":false},
    {"domain":"Software Engineering","soc_code":"15-1211","occupation_title":"Computer systems analysts","employment_2024":521100,"employment_2034":566500,"growth_pct":8.7,"annual_openings":34200,"median_wage":103790,"opportunity_score":59.4,"sweet_spot":false},
    {"domain":"Software Engineering","soc_code":"15-1212","occupation_title":"Information security analysts","employment_2024":182800,"employment_2034":234900,"growth_pct":28.5,"annual_openings":16000,"median_wage":124910,"opportunity_score":64.4,"sweet_spot":false},
    {"domain":"AI & Data","soc_code":"15-1221","occupation_title":"Computer and information research scientists","employment_2024":40300,"employment_2034":48300,"growth_pct":19.7,"annual_openings":3200,"median_wage":140910,"opportunity_score":55.6,"sweet_spot":false},
    {"domain":"Software Engineering","soc_code":"15-1241","occupation_title":"Computer network architects","employment_2024":179200,"employment_2034":200600,"growth_pct":11.9,"annual_openings":11200,"median_wage":130390,"opportunity_score":57.4,"sweet_spot":false},
    {"domain":"AI & Data","soc_code":"15-1242","occupation_title":"Database administrators","employment_2024":78000,"employment_2034":77500,"growth_pct":-0.7,"annual_openings":3800,"median_wage":104620,"opportunity_score":28.5,"sweet_spot":false},
    {"domain":"AI & Data","soc_code":"15-1243","occupation_title":"Database architects","employment_2024":66900,"employment_2034":72700,"growth_pct":8.7,"annual_openings":4000,"median_wage":135980,"opportunity_score":48.7,"sweet_spot":false},
    {"domain":"Software Engineering","soc_code":"15-1244","occupation_title":"Network and computer systems administrators","employment_2024":331500,"employment_2034":317700,"growth_pct":-4.2,"annual_openings":14300,"median_wage":96800,"opportunity_score":32.2,"sweet_spot":false},
    {"domain":"Software Engineering","soc_code":"15-1252","occupation_title":"Software developers","employment_2024":1693800,"employment_2034":1961400,"growth_pct":15.8,"annual_openings":115200,"median_wage":133080,"opportunity_score":84.1,"sweet_spot":true},
    {"domain":"Software Engineering","soc_code":"15-1253","occupation_title":"SQA analysts and testers","employment_2024":201700,"employment_2034":221900,"growth_pct":10.0,"annual_openings":14000,"median_wage":102610,"opportunity_score":48.1,"sweet_spot":false},
    {"domain":"Software Engineering","soc_code":"15-1254","occupation_title":"Web developers","employment_2024":86000,"employment_2034":92500,"growth_pct":7.5,"annual_openings":5400,"median_wage":90930,"opportunity_score":27.8,"sweet_spot":false},
    {"domain":"FinTech","soc_code":"15-2011","occupation_title":"Actuaries","employment_2024":33600,"employment_2034":40900,"growth_pct":21.8,"annual_openings":2400,"median_wage":125770,"opportunity_score":49.6,"sweet_spot":false},
    {"domain":"AI & Data","soc_code":"15-2031","occupation_title":"Operations research analysts","employment_2024":112100,"employment_2034":136200,"growth_pct":21.5,"annual_openings":9600,"median_wage":91290,"opportunity_score":44.8,"sweet_spot":false},
    {"domain":"AI & Data","soc_code":"15-2041","occupation_title":"Statisticians","employment_2024":32200,"employment_2034":34900,"growth_pct":8.5,"annual_openings":2000,"median_wage":103300,"opportunity_score":27.0,"sweet_spot":false},
    {"domain":"AI & Data","soc_code":"15-2051","occupation_title":"Data scientists","employment_2024":245900,"employment_2034":328300,"growth_pct":33.5,"annual_openings":23400,"median_wage":112590,"opportunity_score":68.9,"sweet_spot":true}
  ]
};

const BLUEPRINT = {
  pgc:[
    {name:"Enterprise AI",domain:"AI & Data",cluster:"ai",desc:"Enterprise-ready AI skills for building and deploying applied solutions."},
    {name:"Applied Data Science Foundations",domain:"AI & Data",cluster:"ai",desc:"Core analytics and modeling foundations for working professionals."},
    {name:"Agentic AI Engineering",domain:"Software",cluster:"ai",desc:"Production engineering patterns for agentic systems and workflows."},
    {name:"AI for Engineering",domain:"Software",cluster:"soft",desc:"Apply AI to engineering systems, operations, and reliability use cases."},
    {name:"Mini-MBA",domain:"Business",cluster:"biz",desc:"Business fundamentals and leadership toolkit for technical leaders."},
    {name:"BI & Operational Excellence",domain:"AI & Data",cluster:"ai",desc:"Operational decision-making using BI, KPIs, and performance systems."},
    {name:"Technology Management",domain:"Business",cluster:"biz",desc:"Lead teams, delivery, and transformation across technology organizations."},
    {name:"AI & Market Infrastructure",domain:"FinTech",cluster:"fin",desc:"Modern finance systems + market infrastructure with AI-enabled analytics."}
  ],
  masters:[
    {name:"MBA (Business Admin)",domain:"Business",cluster:"biz",desc:"Leadership and strategy depth for managerial impact at scale."},
    {name:"MS Computer Science",domain:"Software",cluster:"soft",desc:"Advanced computing and systems depth for software engineering careers."},
    {name:"MS AI",domain:"AI & Data",cluster:"ai",desc:"Advanced AI study with applied pathways for real-world deployment."},
    {name:"MEng Applied Data Science",domain:"AI & Data",cluster:"ai",desc:"Engineering-grade applied data science and analytics depth."},
    {name:"MEng Engineering Mgmt",domain:"Business",cluster:"biz",desc:"Lead engineering organizations and technology operations end-to-end."}
  ]
};

/* ─── Chart helpers ──────────────────────────────────────────────── */
const domainColors={"AI & Data":"#7E57C2","FinTech":"#00897B","Software Engineering":"#1E88E5","Business & Leadership":"#F57C00"};

function fmtInt(n){return new Intl.NumberFormat('en-US').format(n);}
function median(arr){const a=[...arr].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function percentile(arr,p){const a=[...arr].sort((x,y)=>x-y);const idx=(p/100)*(a.length-1);const lo=Math.floor(idx),hi=Math.ceil(idx);if(lo===hi)return a[lo];return a[lo]+(a[hi]-a[lo])*(idx-lo);}

function radiusFor(row,minV,maxV){
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const v=row.opportunity_score;
  const sMin=Math.sqrt(minV),sMax=Math.sqrt(maxV),s=Math.sqrt(Math.max(v,0));
  const t=(s-sMin)/(sMax-sMin||1);
  return clamp(6+t*16,6,22);
}
function toRgba(c,a){
  if(!c)return'rgba(0,0,0,'+a+')';
  if(c.startsWith('#')){const hex=c.replace('#','');const v=hex.length===3?hex.split('').map(x=>x+x).join(''):hex;const r=parseInt(v.substring(0,2),16),g=parseInt(v.substring(2,4),16),b=parseInt(v.substring(4,6),16);return'rgba('+r+','+g+','+b+','+a+')';}
  return c;
}

/* ─── Chart Plugins ──────────────────────────────────────────────── */
const quadrantsPlugin={
  id:'quadrantsPlugin',
  afterDraw(chart,args,opts){
    const{ctx,chartArea,scales}=chart;if(!chartArea)return;
    const x=scales.x.getPixelForValue(opts.xMid),y=scales.y.getPixelForValue(opts.yMid);
    ctx.save();
    ctx.fillStyle='rgba(163,38,56,0.08)';
    ctx.fillRect(x,chartArea.top,chartArea.right-x,y-chartArea.top);
    ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);
    ctx.moveTo(chartArea.left,y);ctx.lineTo(chartArea.right,y);ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.font="700 11px 'IBM Plex Sans',Arial";
    const pad=10;
    ctx.fillText('Low volume · High growth',chartArea.left+pad,chartArea.top+pad+12);
    ctx.fillText('High volume · High growth',x+pad,chartArea.top+pad+12);
    ctx.fillText('Low volume · Low growth',chartArea.left+pad,y+pad+12);
    ctx.fillText('High volume · Low growth',x+pad,y+pad+12);
    ctx.fillStyle='rgba(163,38,56,0.85)';ctx.font="800 11px 'IBM Plex Sans',Arial";
    ctx.fillText('Target zone',x+pad,chartArea.top+34);
    ctx.restore();
  }
};

const labelTopPlugin={
  id:'labelTopPlugin',
  afterDatasetsDraw(chart,args,opts){
    const{ctx}=chart;const rows=opts.rows||[];
    const top=[...rows].sort((a,b)=>b.opportunity_score-a.opportunity_score).slice(0,6);
    const findEl=(row)=>{
      const dsIndex=chart.data.datasets.findIndex(ds=>ds.label===row.domain);
      if(dsIndex<0)return null;
      const idx=chart.data.datasets[dsIndex].data.findIndex(p=>p.__soc===row.soc_code);
      if(idx<0)return null;
      return chart.getDatasetMeta(dsIndex).data[idx];
    };
    ctx.save();ctx.font="700 10px 'IBM Plex Sans',Arial";
    ctx.fillStyle='rgba(0,0,0,0.82)';ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=3;
    top.forEach(r=>{
      const el=findEl(r);if(!el)return;
      const x=el.x+10,y=el.y-10;
      const txt=r.occupation_title.length>26?r.occupation_title.slice(0,26)+'\\u2026':r.occupation_title;
      ctx.strokeText(txt,x,y);ctx.fillText(txt,x,y);
    });
    ctx.restore();
  }
};

/* ─── Build Chart ────────────────────────────────────────────────── */
function buildSignalsChart(){
  const rows=DATA.market;if(!rows.length)return;
  const xMid=median(rows.map(r=>r.employment_2024));
  const yMid=median(rows.map(r=>r.growth_pct));
  const vals=rows.map(r=>r.opportunity_score);
  const minV=Math.min(...vals),maxV=Math.max(...vals);
  const domains=Object.keys(domainColors);
  const datasets=domains.map(dom=>{
    const color=domainColors[dom]||'#fff';
    const pts=rows.filter(r=>r.domain===dom).map(r=>({
      x:r.employment_2024,y:r.growth_pct,r:radiusFor(r,minV,maxV),
      __soc:r.soc_code,__score:r.opportunity_score,__title:r.occupation_title
    }));
    return{label:dom,data:pts,backgroundColor:toRgba(color,0.45),borderColor:toRgba(color,0.95),borderWidth:1.6};
  });

  const ctx=document.getElementById('signalsChart').getContext('2d');
  new Chart(ctx,{
    type:'bubble',data:{datasets},
    options:{
      responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{
        legend:{position:'top',labels:{color:'rgba(0,0,0,0.75)',usePointStyle:true,pointStyle:'circle',padding:14,font:{weight:'700',family:"'IBM Plex Sans',Arial"}}},
        tooltip:{enabled:false},
        quadrantsPlugin:{xMid:xMid,yMid:yMid},
        labelTopPlugin:{rows:rows}
      },
      scales:{
        x:{type:'logarithmic',
          title:{display:true,text:'Employment volume (2024) — jobs',color:'rgba(0,0,0,0.65)',font:{weight:'700',family:"'IBM Plex Sans',Arial"}},
          grid:{color:'rgba(0,0,0,0.08)'},
          ticks:{color:'rgba(0,0,0,0.55)',callback:function(val){const n=Number(val);if(!isFinite(n)||n<=0)return'';if(n>=1e6)return(n/1e6).toFixed(n>=1e7?0:1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return String(n);}},
          min:Math.max(1,Math.min(...rows.map(r=>r.employment_2024))*0.8),
          max:Math.max(...rows.map(r=>r.employment_2024))*1.15
        },
        y:{
          title:{display:true,text:'Projected growth (2024–2034) — %',color:'rgba(0,0,0,0.65)',font:{weight:'700',family:"'IBM Plex Sans',Arial"}},
          grid:{color:'rgba(0,0,0,0.08)'},
          ticks:{color:'rgba(0,0,0,0.55)',callback:function(v){return v+'%';}},
          suggestedMin:Math.min(...rows.map(r=>r.growth_pct))-2,
          suggestedMax:Math.max(...rows.map(r=>r.growth_pct))+2
        }
      }
    },
    plugins:[quadrantsPlugin,labelTopPlugin]
  });

  const p25=percentile(vals,25),p50=percentile(vals,50),p75=percentile(vals,75);
  document.getElementById('bubbleLegendInline').innerHTML=
    'Bubble size = <b style="color:rgba(0,0,0,0.8)">opportunity score</b> (P25: <span style="font-family:monospace">'+p25.toFixed(1)+'</span> \\u00b7 P50: <span style="font-family:monospace">'+p50.toFixed(1)+'</span> \\u00b7 P75: <span style="font-family:monospace">'+p75.toFixed(1)+'</span>).';
}

/* ─── Render helpers ─────────────────────────────────────────────── */
function renderTopRight(){
  const rows=DATA.market;
  const xMid=median(rows.map(r=>r.employment_2024));
  const yMid=median(rows.map(r=>r.growth_pct));
  const tr=rows.filter(r=>r.employment_2024>=xMid&&r.growth_pct>=yMid).sort((a,b)=>b.opportunity_score-a.opportunity_score);
  document.getElementById('topRightList').innerHTML=tr.length?tr.slice(0,12).map(r=>
    '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.08);">'+
    '<div><div style="font-weight:600;color:#000;font-size:10pt;">'+r.occupation_title+'</div>'+
    '<div style="font-size:8pt;color:#7F7F7F;">'+r.domain+' \\u00b7 Employment '+fmtInt(r.employment_2024)+' \\u00b7 Growth '+r.growth_pct.toFixed(1)+'%</div></div>'+
    '<div style="text-align:right;"><div style="font-size:10pt;font-weight:700;color:#000;">'+r.opportunity_score.toFixed(1)+'</div>'+
    '<div style="font-size:7pt;color:#7F7F7F;">Score</div></div></div>'
  ).join(''):'<div style="color:#7F7F7F;font-size:9pt;">No roles found.</div>';
}

function renderBlueprint(){
  document.getElementById('pgcGrid').innerHTML=BLUEPRINT.pgc.map(function(p){return(
    '<div class="glass card-item" style="padding:12px;border-left:4px solid var(--'+p.cluster+');">'+
    '<div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#7F7F7F;margin-bottom:3px;">'+p.domain+'</div>'+
    '<div style="font-weight:600;color:#000;font-size:11pt;margin-bottom:4px;">'+p.name+'</div>'+
    '<div style="font-size:8.5pt;color:#7F7F7F;line-height:1.4;">'+p.desc+'</div></div>'
  );}).join('');

  document.getElementById('mastersGrid').innerHTML=BLUEPRINT.masters.map(function(m){return(
    '<div class="glass card-item" style="padding:14px;border-top:4px solid var(--'+m.cluster+');">'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span class="badge b-'+m.cluster+'">'+m.domain+'</span>'+
    '<span style="font-size:8pt;font-family:monospace;color:#7F7F7F;">30 CR</span></div>'+
    '<div style="font-weight:600;color:#000;font-size:13pt;margin-bottom:4px;">'+m.name+'</div>'+
    '<div style="font-size:8.5pt;color:#7F7F7F;line-height:1.4;">'+m.desc+'</div></div>'
  );}).join('');
}

/* ─── Init ───────────────────────────────────────────────────────── */
window.onload=function(){
  renderBlueprint();
  setTimeout(function(){
    buildSignalsChart();
    renderTopRight();
  },200);
};
</script>
</body>
</html>"""


# ═══════════════════════ PYTHON LOGIC ════════════════════════════════


def _logo_data_uri() -> str:
    """Read the CPE logo from disk and return as a data URI."""
    if LOGO_SVG.exists():
        b64 = base64.b64encode(LOGO_SVG.read_bytes()).decode("ascii")
        return f"data:image/svg+xml;base64,{b64}"
    print("WARNING: Logo file not found, proceeding without logo.")
    return ""


def build_html() -> str:
    logo = _logo_data_uri()
    today = date.today().strftime("%B %d, %Y")
    html = HTML_TEMPLATE
    html = html.replace("__LOGO_DATA_URI__", logo)
    html = html.replace("__GENERATION_DATE__", today)
    return html


def main() -> None:
    html = build_html()
    TEMP_HTML.parent.mkdir(parents=True, exist_ok=True)
    TEMP_HTML.write_text(html, encoding="utf-8")
    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)

    print("Launching Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        print(f"Loading {TEMP_HTML}...")
        page.goto(f"file://{TEMP_HTML}", wait_until="networkidle")

        # Wait for fonts + Chart.js rendering
        page.wait_for_timeout(5000)

        # Verification screenshot (full page)
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        print(f"Screenshot -> {SCREENSHOT}")

        # Generate PDF
        page.emulate_media(media="print")
        page.pdf(
            path=str(OUT_PDF),
            format="Letter",
            print_background=True,
            display_header_footer=True,
            header_template=HEADER_TPL,
            footer_template=FOOTER_TPL,
            margin={
                "top": "0.4in",
                "right": "0.75in",
                "bottom": "0.6in",
                "left": "0.75in",
            },
        )
        print(f"PDF -> {OUT_PDF}")

        browser.close()

    print(f"Temp HTML -> {TEMP_HTML}")
    print("Done.")


if __name__ == "__main__":
    main()
