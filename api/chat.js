/**
 * @file api/chat.js
 * Vercel Serverless Function for BizChat AI backend.
 * Integrates with Google Gemini API (@google/genai) to deliver enterprise-grade conversational AI.
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Lazy client getter to ensure process.env.GEMINI_API_KEY is always fresh
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in AI Studio.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Persona-driven executive system instructions
const PERSONA_INSTRUCTIONS = {
  'Executive Strategy Advisor': 
    'You are BizChat AI, an elite Executive Strategy Advisor and Fortune 500 management consultant. Provide crisp, data-backed, high-impact strategic advice. Structure responses with executive summaries, clear bullet points, risk analyses, and actionable recommendations. Maintain a confident, professional, and pragmatic tone.',
  'Financial & Investment Analyst': 
    'You are BizChat AI acting as a Senior Financial & Investment Analyst. Focus on unit economics, valuation models, ROI/IRR, cash flow implications, risk assessments, and market indicators. Format financial figures clearly and provide structured breakdowns.',
  'Growth & Marketing Strategist': 
    'You are BizChat AI operating as a Chief Marketing Officer and B2B/B2C Growth Strategist. Specialize in Go-To-Market (GTM) execution, CAC/LTV optimization, demand generation, brand positioning, and conversion rate optimization.',
  'Corporate Legal & Compliance': 
    'You are BizChat AI acting as an enterprise Corporate Legal & Regulatory Compliance Specialist. Highlight potential contractual risks, compliance considerations, liability clauses, and governance best practices. Always include appropriate legal disclaimers.',
  'Operations & Process Architect': 
    'You are BizChat AI operating as a VP of Business Operations. Focus on process automation, operational bottlenecks, supply chain efficiency, agile workflows, and scalability metrics.',
};

/**
 * Vercel Serverless Function Handler
 * @param {import('express').Request} req - HTTP request object
 * @param {import('express').Response} res - HTTP response object
 */
export default async function handler(req, res) {
  // Enforce POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for this endpoint.',
    });
  }

  let ai;
  try {
    ai = getGeminiClient();
  } catch (keyErr) {
    return res.status(500).json({
      error: 'API Configuration Error',
      message: keyErr.message,
    });
  }

  try {
    const { prompt, messages = [], persona = 'Executive Strategy Advisor' } = req.body || {};

    // Validate that either prompt or messages is provided
    if (!prompt && (!Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'A text prompt or messages array is required.',
      });
    }

    // Determine appropriate system instruction
    const systemInstruction =
      PERSONA_INSTRUCTIONS[persona] ||
      PERSONA_INSTRUCTIONS['Executive Strategy Advisor'] +
        ' Communicate in polished markdown with clean headers, bullet points, and code formatting when applicable.';

    // Construct contents array for Gemini multi-turn conversation
    let contents = [];

    if (Array.isArray(messages) && messages.length > 0) {
      contents = messages.map((msg) => {
        const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
        return {
          role,
          parts: [{ text: String(msg.content || msg.text || '') }],
        };
      });

      // If an additional standalone prompt is passed, append it
      if (prompt && (!contents.length || contents[contents.length - 1].role !== 'user')) {
        contents.push({
          role: 'user',
          parts: [{ text: String(prompt) }],
        });
      }
    } else {
      contents = [
        {
          role: 'user',
          parts: [{ text: String(prompt) }],
        },
      ];
    }

    // Call Google Gemini API with fallback to gemini-3.1-flash-lite if 3.8-flash hits 503
    let response;
    let usedModel = 'gemini-3.8-flash';

    console.log(`[BizChat API] Processing request: "${prompt || (contents[contents.length - 1]?.parts?.[0]?.text)}" | Persona: ${persona}`);
    const startTime = Date.now();

    const callWithTimeout = (promise, ms) => {
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const err = new Error(`Request timed out after ${ms}ms`);
          err.status = 503;
          reject(err);
        }, ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
    };

    try {
      // Attempt fast primary generation with 5000ms threshold
      response = await callWithTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
          },
        }),
        5000
      );
    } catch (primaryErr) {
      console.warn(`[BizChat API] Primary model error/timeout (${primaryErr.message}). Switching to gemini-3.1-flash-lite...`);
      usedModel = 'gemini-3.1-flash-lite';
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: {
          systemInstruction,
        },
      });
    }

    const duration = Date.now() - startTime;
    const replyText = response.text || 'No response generated.';
    console.log(`[BizChat API] Response generated via ${usedModel} in ${duration}ms (${replyText.length} chars)`);

    return res.status(200).json({
      success: true,
      response: replyText,
      model: usedModel,
      persona,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Gemini Generation Failed',
      message: errorMessage,
    });
  }
}
