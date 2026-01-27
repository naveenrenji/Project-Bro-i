# Project Iris - Executive Intelligence Platform

A modern React dashboard for Stevens CPE enrollment analytics, featuring **Navs** - an AI-powered assistant that helps executives understand their data and make strategic decisions.

## Features

### Three Core Views

1. **Command Center** - Real-time pulse of enrollment with KPIs, funnel visualization, and proactive alerts
2. **Deep Dive** - Smart exploration tabs (Revenue, Pipeline, Segment, Student, Time) with AI summaries
3. **Ask Navs** - Conversational AI analytics with multi-model support (Gemini, GPT-4o, Claude)

### AI Integration

- **Navs** is woven throughout the platform, not just a chatbot
- Contextual "Ask Navs" buttons on every chart
- Proactive alerts and insights
- Natural language queries that generate insights
- Multi-model flexibility (switch between AI providers)

### Design

- Futuristic dark theme with glass morphism effects
- Animated visualizations with Framer Motion
- Responsive design for all screen sizes
- Stevens brand colors and identity

## Tech Stack

- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts + custom SVG
- **State**: Zustand
- **Routing**: React Router v6
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Data Refresh

The dashboard uses pre-processed JSON data. To refresh:

```bash
# Process data from source files
python3 scripts/process_data.py

# Or use the full refresh script (commits and pushes)
./scripts/refresh_and_push.sh
```

## Project Structure

```
iris-react/
├── public/
│   └── data/           # Pre-processed JSON data
├── src/
│   ├── components/     # React components
│   │   ├── charts/     # Chart components
│   │   ├── layout/     # App shell, navigation
│   │   ├── navs/       # AI assistant components
│   │   └── shared/     # Reusable components
│   ├── views/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and constants
│   └── store/          # Zustand stores
├── scripts/
│   ├── process_data.py # Data processing
│   └── refresh_and_push.sh
└── vercel.json         # Deployment config
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# AI API Keys (for Ask Navs)
VITE_GEMINI_API_KEY=your-key
VITE_OPENAI_API_KEY=your-key
VITE_ANTHROPIC_API_KEY=your-key
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Netlify

1. Push to GitHub
2. Import project in Netlify
3. Set environment variables
4. Deploy

## Data Flow

```
Raw Data Files (Slate, Census, Apps)
        ↓
  process_data.py
        ↓
  public/data/dashboard.json
        ↓
  React App fetches JSON
        ↓
  Zustand stores data
        ↓
  Components render
```

## Contributing

1. Create a feature branch
2. Make changes
3. Run `npm run build` to verify
4. Submit PR

## License

Proprietary - Stevens Institute of Technology
