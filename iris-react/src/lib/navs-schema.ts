/**
 * Schema Documentation for Ask Navs AI
 * This file defines the data structures and business rules that the AI uses
 * to understand and query student enrollment data.
 */

// =============================================================================
// STUDENT RECORD SCHEMA
// =============================================================================

export const STUDENT_SCHEMA = `
## StudentRecord Schema

Each student record has the following fields:

| Field | Type | Source | Description | Example Values |
|-------|------|--------|-------------|----------------|
| id | string | Both | Unique identifier | "slate_2026_123", "census_2026_456" |
| source | string | Both | Data origin | "slate" (pipeline), "census" (enrollment) |
| year | string | Both | Academic year | "2024", "2025", "2026" |
| category | string | Both | Student category | "Stevens Online (Corporate)", "Stevens Online (Retail)", "Select Professional Online", "Beacon", "CPE", "ASAP" |
| school | string | Both | Academic school | "SSB", "SES", "CPE" |
| degreeType | string | Both | Degree level | "Masters", "Graduate Certificate", "Non-Degree" |
| program | string | Both | Program name | "Business Intelligence & Analytics", "Financial Engineering" |
| studentType | string | Both | New vs returning | "New", "Current" |
| studentStatus | string | Both | Enrollment status | "New", "Continuing", "Returning" |
| funnelStage | string | Slate only | Pipeline stage | "application", "admitted", "accepted", "enrolled" |
| credits | number | Census only | Credits this term | 6, 9, 12 |
| creditsRemaining | number | Census only | Credits to graduate | 0, 15, 30 |
| creditsAfterTerm | number | Census only | Credits remaining after term | -6, 0, 24 |
| graduatingThisTerm | boolean | Census only | Will graduate this term | true, false |
| cpcRate | number | Census only | Cost per credit rate | 1520, 1824 |
| ntr | number | Census only | Net Tuition Revenue (pre-calculated) | 9120, 18240 |
| domesticInternational | string | Census only | Domestic/International status | "Domestic", "International" |
| state | string | Census only | US state | "NJ", "NY", "CA" |
| country | string | Census only | Country of origin | "United States", "India" |
| canvasLastLogin | string | Census only | Last LMS login date | "2026-01-15" |
| canvasWeeksSinceLogin | number | Census only | Weeks since login | 0, 2, 5 |
| company | string | Both | Corporate sponsor | "Amazon", "Google", null |
| submittedDate | string | Slate only | Application date | "2025-10-15" |
| enrollmentDate | string | Slate only | Enrollment date | "2025-12-01" |
`

// =============================================================================
// DATA SOURCE RULES
// =============================================================================

export const DATA_SOURCE_RULES = `
## Data Source Rules (CRITICAL)

### When to Use Slate Data (source === "slate")
- Application counts
- Admit counts  
- Accepted offer counts
- Pipeline/funnel metrics
- Year-over-Year comparisons for NEW student pipeline
- Application and enrollment dates

### When to Use Census Data (source === "census")
- Enrolled student counts (total enrollment)
- NTR (Net Tuition Revenue) calculations
- Credit hours and graduation tracking
- Demographics (domestic/international, state, country)
- Student engagement (Canvas login data)
- Year-over-Year comparisons for OVERALL enrollment

### Category Aliases (handle both forms)
- "Corporate" = "Stevens Online (Corporate)"
- "Retail" = "Stevens Online (Retail)"
- When filtering by category, check for both variants
`

// =============================================================================
// BUSINESS RULES
// =============================================================================

export const BUSINESS_RULES = `
## Business Rules

### Category Classification Priority (applied in order)
1. CPE: School contains "CPE" OR program is in CPE list
2. ASAP: degreeType === "Non-Degree" (Census) OR source === "ASAP" (Slate)
3. Select Professional Online: Location is "Online Noodle"
4. Beacon: Beacon flag is set
5. Corporate: Has corporate flag AND valid company (NOT "Not reported")
6. Retail: Default for all other online students

**IMPORTANT**: If company field is "Not reported", empty, or null, the student is categorized as Retail, NOT Corporate.

### CPC (Cost Per Credit) Rates

| Category | Degree Type | Student Type | CPC Rate |
|----------|-------------|--------------|----------|
| Select Professional Online | Masters | New | $1,395 |
| Select Professional Online | Masters | Current | $1,650 |
| Beacon | Masters | New/Current | $290 |
| Corporate | Masters | New | $1,300 |
| Corporate | Masters | Current | $1,550 |
| Corporate | Grad Certificate | New/Current | $1,195 |
| Retail | Masters | New | $1,395 |
| Retail | Masters | Current | $1,723 |
| Retail | Grad Certificate | New | $1,993 |
| Retail | Grad Certificate | Current | $2,030 |
| ASAP | Non-Degree | New/Current | $875 |
| CPE | Masters | New/Current | $800 |
| CPE | Grad Certificate | New/Current | $583 |

### NTR Calculation
\`\`\`
NTR = credits × cpcRate
\`\`\`
The \`ntr\` field is pre-calculated on Census records.

### Student Type Classification
| Census Status | Previous Summer Enrolled | Result |
|---------------|-------------------------|--------|
| "Continuing" | - | "Current" |
| "Returning" | - | "Current" |
| "New" | Yes (1) | "Current" |
| "New" | No (0) | "New" |

### Pipeline Stage Order (Slate only)
application → admitted → accepted → enrolled

### Graduation Tracking (Census only, mutually exclusive buckets)
| Bucket | Condition |
|--------|-----------|
| Graduating This Term | creditsAfterTerm <= 0 |
| Within 10 Credits | creditsAfterTerm > 0 && creditsAfterTerm <= 10 |
| Within 20 Credits | creditsAfterTerm > 10 && creditsAfterTerm <= 20 |
| 20+ Credits | creditsAfterTerm > 20 |

### Year-over-Year Comparisons
**YoY Change Formula:**
\`\`\`javascript
yoyChange = ((current - previous) / previous) * 100
\`\`\`

### School Name Mappings
| Raw Values | Standardized |
|------------|--------------|
| SOB, SSB, "School of Business" | "SSB" |
| SES, SSE, "School of Engineering and Science" | "SES" |
| CPE, "Professional Education" | "CPE" |

### CPE Program Keywords
Programs containing these terms are classified as CPE:
- "applied data science"
- "meads"
- "enterprise ai"
- "enterprise artificial intelligence"
- "ads foundations"
- "systems engineering foundations"
`

// =============================================================================
// HELPER FUNCTIONS DOCUMENTATION
// =============================================================================

export const HELPER_FUNCTIONS_DOCS = `
## Available Helper Functions

You have access to a \`helpers\` object with these utility functions:

### Aggregation
\`\`\`javascript
helpers.sum(array, field)
// Sum numeric values: helpers.sum(students, 'ntr') → 7200000

helpers.avg(array, field)
// Average: helpers.avg(students, 'credits') → 8.5

helpers.count(array)
// Count: helpers.count(students) → 5800
\`\`\`

### Grouping & Filtering
\`\`\`javascript
helpers.groupBy(array, field)
// Group into object: helpers.groupBy(students, 'category')
// Returns: { "Corporate": [...], "Retail": [...], ... }

helpers.unique(array, field)
// Unique values: helpers.unique(students, 'program')
// Returns: ["Business Intelligence", "Financial Engineering", ...]

helpers.filter(array, fn)
// Filter: helpers.filter(students, s => s.ntr > 10000)
\`\`\`

### Sorting
\`\`\`javascript
helpers.sort(array, field, descending?)
// Sort: helpers.sort(students, 'ntr', true) // descending

helpers.top(array, n, field)
// Top N: helpers.top(students, 5, 'ntr') // top 5 by NTR
\`\`\`

### Date Utilities
\`\`\`javascript
helpers.between(dateStr, start, end)
// Date check: helpers.between('2025-11-15', '2025-11-01', '2025-12-31')
// Returns: true/false
\`\`\`

### Formatting
\`\`\`javascript
helpers.percent(part, total, decimals?)
// Percentage: helpers.percent(42, 122) → 34.4

helpers.formatCurrency(num)
// Format: helpers.formatCurrency(7200000) → "$7,200,000"

helpers.formatNumber(num)
// Format: helpers.formatNumber(5800) → "5,800"
\`\`\`

### Category Matching
\`\`\`javascript
helpers.categoryMatch(studentCategory, targetCategory)
// Smart category matching (handles aliases):
// helpers.categoryMatch("Stevens Online (Corporate)", "Corporate") → true
// helpers.categoryMatch("Retail", "Stevens Online (Retail)") → true
\`\`\`
`

// =============================================================================
// COMMON QUERY PATTERNS
// =============================================================================

export const COMMON_QUERY_PATTERNS = `
## Common Query Patterns

### Pipeline Counts (use Slate)
\`\`\`javascript
// Total applications for 2026
students.filter(s => s.source === 'slate' && s.year === '2026').length

// Enrolled from pipeline
students.filter(s => s.source === 'slate' && s.funnelStage === 'enrolled').length

// Yield rate
const apps = students.filter(s => s.source === 'slate' && s.year === '2026').length
const enrolled = students.filter(s => s.source === 'slate' && s.year === '2026' && s.funnelStage === 'enrolled').length
const yieldRate = helpers.percent(enrolled, apps)
\`\`\`

### Enrollment Metrics (use Census)
\`\`\`javascript
// Total enrolled students
students.filter(s => s.source === 'census' && s.year === '2026').length

// Total NTR
helpers.sum(students.filter(s => s.source === 'census'), 'ntr')

// Average credits per student
helpers.avg(students.filter(s => s.source === 'census'), 'credits')
\`\`\`

### Category Filtering (handle aliases)
\`\`\`javascript
// Corporate students (handle both variants)
students.filter(s => 
  s.category === 'Stevens Online (Corporate)' || 
  s.category === 'Corporate'
)

// Or use the helper:
students.filter(s => helpers.categoryMatch(s.category, 'Corporate'))
\`\`\`

### Demographics
\`\`\`javascript
// International students
students.filter(s => 
  s.source === 'census' && 
  s.domesticInternational === 'International'
)

// Students from a specific state
students.filter(s => s.source === 'census' && s.state === 'NJ')
\`\`\`

### Graduation Tracking
\`\`\`javascript
// Students graduating this term
students.filter(s => s.source === 'census' && s.graduatingThisTerm === true)

// Students with 20+ credits remaining
students.filter(s => s.source === 'census' && s.creditsAfterTerm > 20)
\`\`\`

### Year-over-Year
\`\`\`javascript
// Compare enrollment by year
const y2025 = students.filter(s => s.source === 'census' && s.year === '2025').length
const y2026 = students.filter(s => s.source === 'census' && s.year === '2026').length
const yoyChange = helpers.percent(y2026 - y2025, y2025)
\`\`\`
`

// =============================================================================
// DATA AVAILABILITY REFERENCE
// =============================================================================

export const DATA_AVAILABILITY = `
## Data Availability by Source

| Field | Slate | Census | Notes |
|-------|-------|--------|-------|
| funnelStage | ✓ | ✗ | Pipeline tracking only |
| credits | ✗ | ✓ | Credit hours this term |
| creditsRemaining | ✗ | ✓ | To graduation |
| ntr | ✗ | ✓ | Pre-calculated |
| cpcRate | ✗ | ✓ | Rate used for NTR |
| domesticInternational | ✗ | ✓ | Demographics |
| state, country | ✗ | ✓ | Location data |
| canvasLastLogin | ✗ | ✓ | LMS engagement |
| submittedDate | ✓ | ✗ | Application date |
| enrollmentDate | ✓ | ✗ | When enrolled |
| company | ✓ | ✓ | May differ between sources |
`

// =============================================================================
// TOP CORPORATE COMPANIES
// =============================================================================

export const CORPORATE_COMPANIES = `
## Top Corporate Companies (Normalized Names)

| Raw Variations | Standardized Name |
|----------------|-------------------|
| pfizer, Pfizer Inc | "Pfizer" |
| collins, Collins Aerospace | "Collins Aerospace" |
| bae, BAE Systems | "BAE Systems" |
| bank of america, merrill lynch | "Bank of America" |
| l3, l3harris | "L3Harris" |
| jpm, jpmorgan, jp morgan | "JPMorgan Chase" |
| amazon, aws | "Amazon" |
| google, alphabet | "Google" |
| meta, facebook | "Meta" |
| microsoft | "Microsoft" |
| johnson & johnson, j&j | "Johnson & Johnson" |
| lockheed, lockheed martin | "Lockheed Martin" |
| northrop, northrop grumman | "Northrop Grumman" |
| raytheon | "Raytheon" |
| verizon | "Verizon" |
| at&t | "AT&T" |
`

// =============================================================================
// COMBINED SCHEMA FOR AI PROMPTS
// =============================================================================

export const FULL_SCHEMA_DOCS = `
${STUDENT_SCHEMA}

${DATA_SOURCE_RULES}

${BUSINESS_RULES}

${DATA_AVAILABILITY}
`

export const FULL_HELPER_DOCS = `
${HELPER_FUNCTIONS_DOCS}

${COMMON_QUERY_PATTERNS}
`
