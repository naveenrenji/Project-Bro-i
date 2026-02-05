/**
 * Project Iris - Constants & Design Tokens
 * Stevens CPE Executive Intelligence Platform
 */

// Stevens Brand Colors
export const COLORS = {
  // Primary Brand
  stevensRed: '#A41034',
  stevensGrayDark: '#54585A',
  stevensGrayLight: '#B1B3B3',
  
  // Backgrounds
  bgBase: '#0a0a0f',
  bgSurface: '#12121a',
  bgElevated: '#1a1a24',
  bgGlass: 'rgba(255, 255, 255, 0.03)',
  
  // Accent
  accentPrimary: '#A41034',
  accentGlow: '#ff2d55',
  accentDark: '#7A1F3D',
  
  // Semantic
  success: '#00d084',
  warning: '#ffb800',
  danger: '#ff4757',
  info: '#3b82f6',
  
  // Text
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  
  // Chart Palette
  chartColors: [
    '#A41034', // Stevens Red
    '#00d084', // Teal
    '#3b82f6', // Blue
    '#ffb800', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ],
} as const

// Navigation Items
export const NAV_ITEMS = [
  {
    id: 'command-center',
    label: 'Command Center',
    path: '/',
    icon: 'LayoutDashboard',
    description: 'Real-time pulse of enrollment',
  },
  {
    id: 'deep-dive',
    label: 'Deep Dive',
    path: '/explore',
    icon: 'Search',
    description: 'Explore and analyze data',
  },
  {
    id: 'ntr-projector',
    label: 'NTR Projector',
    path: '/projector',
    icon: 'Calculator',
    description: 'Project next term revenue',
  },
  {
    id: 'ask-navs',
    label: 'Ask Navs',
    path: '/ask-navs',
    icon: 'MessageSquare',
    description: 'AI-powered strategic insights',
  },
] as const

// Deep Dive Tabs
export const DEEP_DIVE_TABS = [
  { id: 'revenue', label: 'Revenue', icon: 'DollarSign' },
  { id: 'pipeline', label: 'Pipeline', icon: 'GitBranch' },
  { id: 'forecast', label: 'Forecast', icon: 'TrendingUp' },
  { id: 'programs', label: 'Programs', icon: 'PieChart' },
  { id: 'students', label: 'Students', icon: 'Users' },
  { id: 'trends', label: 'Trends', icon: 'BarChart' },
] as const

// AI Models Available
export const AI_MODELS = [
  { id: 'gemini', label: 'Gemini', description: 'Fast, good for data' },
  { id: 'gpt-4o', label: 'GPT-4o', description: 'Best reasoning' },
  { id: 'claude', label: 'Claude', description: 'Best for analysis' },
] as const

// Default NTR Goal
export const DEFAULT_NTR_GOAL = 9_800_000

// Application Categories
export const APP_CATEGORIES = [
  'Stevens Online (Retail)',
  'Stevens Online (Corporate)',
  'Select Professional Online',
  'Beacon',
  'ASAP',
  'CPE',
] as const

// Degree Types
export const DEGREE_TYPES = [
  'Masters',
  'Graduate Certificate',
  'Non-Degree',
  'Professional Graduate Certificate',
] as const

// Schools
export const SCHOOLS = [
  'SSB',
  'SES',
  'CPE',
  'Dual Degree',
] as const

// API Endpoints
export const API_ENDPOINTS = {
  data: '/api/data',
  chat: '/api/navs/chat',
  explain: '/api/navs/explain',
  briefing: '/api/navs/briefing',
} as const
