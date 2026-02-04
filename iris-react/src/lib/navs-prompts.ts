/**
 * Prompt Builders for Ask Navs AI
 * Defines the prompts for Tier 1 (context-based) and Tier 2 (code execution) responses
 */

import { NAVS_PERSONA } from './navs-persona'
import { FULL_SCHEMA_DOCS, FULL_HELPER_DOCS } from './navs-schema'

// =============================================================================
// TIER 1: CONTEXT-BASED RESPONSE
// =============================================================================

export const TIER1_RESPONSE_FORMAT = `
RESPONSE FORMAT:
You MUST respond with a valid JSON object in this exact format:
{
  "canAnswer": true/false,
  "confidence": "high" | "medium" | "low",
  "answer": "Your answer in markdown format (if canAnswer is true)",
  "needsComputation": true/false,
  "reason": "Why you can't answer (if canAnswer is false)"
}

WHEN TO SET canAnswer: false
- Question requires filtering/computing across raw student records
- Question asks for correlations or cross-field analysis
- Question needs data not in the pre-aggregated context
- Question requires date-based filtering
- Question asks for specific student counts with multiple conditions

WHEN TO SET needsComputation: true
- Complex filtering is required (e.g., "Corporate Masters students in NJ")
- Calculations across multiple fields needed
- Date range analysis required
- Custom aggregations needed
`

/**
 * Build the Tier 1 prompt for context-based answers
 */
export function buildTier1Prompt(
  question: string,
  context: string,
  conversationHistory: string
): string {
  return `${NAVS_PERSONA.systemPrompt}

${TIER1_RESPONSE_FORMAT}

=== DASHBOARD DATA CONTEXT ===
${context}
=== END CONTEXT ===

${conversationHistory ? `--- Previous conversation ---\n${conversationHistory}\n---` : ''}

User: ${question}

Remember: You are Navs. Respond ONLY with a valid JSON object. If you can answer from the context above, set canAnswer: true and write your answer in markdown in the "answer" field. Be direct, use specific numbers, and bold key figures.`
}

// =============================================================================
// TIER 2: CODE GENERATION
// =============================================================================

export const TIER2_CODE_INSTRUCTIONS = `
TASK: Write JavaScript code to answer the user's question by analyzing student data.

AVAILABLE:
- \`students\`: Array of StudentRecord objects (already filtered to relevant data)
- \`helpers\`: Object with utility functions (see documentation below)

REQUIREMENTS:
1. Write valid JavaScript code
2. The code MUST return an object with this shape:
   { answer: <your computed answer>, explanation: "<brief explanation>" }
3. Use the helpers for common operations
4. Handle edge cases (empty arrays, division by zero)
5. Do NOT use async/await, fetch, or any external APIs
6. Keep the code simple and focused

EXAMPLE:
\`\`\`javascript
const corporate = students.filter(s => 
  helpers.categoryMatch(s.category, 'Corporate') && 
  s.degreeType === 'Masters'
);
const total = helpers.count(corporate);
const international = corporate.filter(s => s.domesticInternational === 'International').length;

return {
  answer: helpers.percent(international, total),
  explanation: \`\${international} of \${total} Corporate Masters students are international\`
};
\`\`\`
`

/**
 * Build the Tier 2 prompt for code generation
 */
export function buildTier2Prompt(question: string): string {
  return `You need to write JavaScript code to answer a data analysis question.

${TIER2_CODE_INSTRUCTIONS}

=== SCHEMA DOCUMENTATION ===
${FULL_SCHEMA_DOCS}

=== HELPER FUNCTIONS ===
${FULL_HELPER_DOCS}

=== USER QUESTION ===
${question}

Write ONLY the JavaScript code inside a code block. No explanation before or after.
The code should return { answer: <result>, explanation: "<brief explanation>" }.

\`\`\`javascript
// Your code here
\`\`\``
}

// =============================================================================
// TIER 2: RESULT FORMATTING
// =============================================================================

/**
 * Build the prompt to format Tier 2 execution results into natural language
 */
export function buildFormattingPrompt(
  question: string,
  executionResult: { answer: unknown; explanation?: string },
  context: string
): string {
  return `You are Navs (Naveen Mathews Renji), the AI & BI Engineering Manager for Stevens CPE.

${NAVS_PERSONA.systemPrompt}

The user asked: "${question}"

I analyzed the student data and found:
- Answer: ${JSON.stringify(executionResult.answer)}
- Details: ${executionResult.explanation || 'N/A'}

Additional context for reference:
${context.slice(0, 2000)}...

Now respond to the user in my characteristic style:
- Be direct and use the specific numbers from my analysis
- Bold key figures (e.g., **34.5%**)
- Keep it concise (2-3 sentences)
- Suggest what they might want to explore next

Respond naturally as Navs, NOT in JSON format.`
}

// =============================================================================
// THINKING STEP MESSAGES (Navs Persona)
// =============================================================================

export const THINKING_STEP_MESSAGES = {
  analyzing: "Let me look into that...",
  searchingContext: "Checking my data...",
  foundInContext: "Found what you need!",
  needsDeepDive: "I need to dig deeper into the records...",
  generatingCode: "Running some analysis...",
  executingCode: (count: number) => `Crunching ${count.toLocaleString()} student records...`,
  formattingResult: "Putting together your answer...",
  complete: "Got it!",
  error: "Hmm, ran into an issue...",
} as const

// =============================================================================
// ERROR MESSAGES
// =============================================================================

export const ERROR_MESSAGES = {
  tier1ParseError: "I couldn't process that response properly. Let me try a different approach.",
  tier2CodeError: (error: string) => `I ran into an issue with my analysis: ${error}. Let me try again.`,
  tier2Timeout: "That analysis is taking too long. Can you try a simpler question?",
  noData: NAVS_PERSONA.errorResponses.noData,
  apiError: NAVS_PERSONA.errorResponses.apiError,
  outOfScope: NAVS_PERSONA.errorResponses.outOfScope,
} as const
