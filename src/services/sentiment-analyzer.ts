import OpenAI from 'openai';
import { run } from '../config/database';

// Only initialize OpenAI if API key is provided
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface SentimentAnalysis {
  sentiment_score: number;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  themes: string[];
  keywords: string[];
  is_constructive: boolean;
  quality_score: number;
}

class SentimentAnalyzer {
  /**
   * Analyze feedback sentiment using AI
   */
  async analyzeFeedback(feedbackText: string): Promise<SentimentAnalysis> {
    // If OpenAI is not configured, use fallback
    if (!openai) {
      return this.fallbackAnalysis(feedbackText);
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a sentiment analysis expert for employee feedback. Analyze the feedback and return ONLY a JSON object with:
- sentiment_score: number between -1 (very negative) and 1 (very positive)
- sentiment_label: "positive", "negative", or "neutral"
- themes: array of key themes (e.g., ["collaboration", "communication", "technical skills"])
- keywords: array of important keywords
- is_constructive: boolean indicating if feedback is constructive and actionable
- quality_score: number 0-100 indicating feedback quality`,
          },
          {
            role: 'user',
            content: `Analyze this feedback: "${feedbackText}"`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        sentiment_score: analysis.sentiment_score || 0,
        sentiment_label: analysis.sentiment_label || 'neutral',
        themes: analysis.themes || [],
        keywords: analysis.keywords || [],
        is_constructive: analysis.is_constructive || false,
        quality_score: analysis.quality_score || 50,
      };
    } catch (error) {
      console.error('OpenAI sentiment analysis error:', error);
      return this.fallbackAnalysis(feedbackText);
    }
  }

  /**
   * Fallback sentiment analysis using keyword matching
   */
  private fallbackAnalysis(text: string): SentimentAnalysis {
    const lowerText = text.toLowerCase();

    // Positive and negative word lists
    const positiveWords = [
      'excellent',
      'great',
      'good',
      'outstanding',
      'strong',
      'effective',
      'helpful',
      'reliable',
      'proactive',
      'innovative',
      'collaborative',
      'dedicated',
    ];

    const negativeWords = [
      'poor',
      'weak',
      'lacking',
      'needs improvement',
      'struggle',
      'difficult',
      'challenge',
      'concern',
      'issue',
      'problem',
    ];

    // Count occurrences
    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) positiveCount += matches.length;
    });

    negativeWords.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) negativeCount += matches.length;
    });

    // Calculate sentiment score
    const total = positiveCount + negativeCount;
    let sentimentScore = 0;
    let sentimentLabel: 'positive' | 'negative' | 'neutral' = 'neutral';

    if (total > 0) {
      sentimentScore = (positiveCount - negativeCount) / total;
      if (sentimentScore > 0.2) sentimentLabel = 'positive';
      else if (sentimentScore < -0.2) sentimentLabel = 'negative';
    }

    // Extract themes (simple keyword extraction)
    const themes: string[] = [];
    if (lowerText.includes('collaborat')) themes.push('collaboration');
    if (lowerText.includes('communicat')) themes.push('communication');
    if (lowerText.includes('technical') || lowerText.includes('code')) themes.push('technical skills');
    if (lowerText.includes('leadership') || lowerText.includes('manage')) themes.push('leadership');
    if (lowerText.includes('time') || lowerText.includes('deadline')) themes.push('time management');

    // Check if constructive
    const isConstructive =
      text.length > 100 &&
      (lowerText.includes('suggest') ||
        lowerText.includes('recommend') ||
        lowerText.includes('could') ||
        lowerText.includes('improve'));

    // Quality score based on length and structure
    let qualityScore = 50;
    if (text.length > 300) qualityScore += 20;
    if (text.length > 500) qualityScore += 10;
    if (isConstructive) qualityScore += 20;

    return {
      sentiment_score: sentimentScore,
      sentiment_label: sentimentLabel,
      themes: themes,
      keywords: [],
      is_constructive: isConstructive,
      quality_score: Math.min(100, qualityScore),
    };
  }

  /**
   * Save analysis to database
   */
  async saveAnalysis(responseId: number, analysis: SentimentAnalysis): Promise<void> {
    const sql = `
      INSERT INTO feedback_analysis 
      (response_id, sentiment_score, sentiment_label, themes, keywords, is_constructive, quality_score, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    await run(sql, [
      responseId,
      analysis.sentiment_score,
      analysis.sentiment_label,
      JSON.stringify(analysis.themes),
      JSON.stringify(analysis.keywords),
      analysis.is_constructive ? 1 : 0,
      analysis.quality_score,
    ]);
  }

  /**
   * Analyze and save feedback
   */
  async analyzeAndSave(responseId: number, feedbackText: string): Promise<SentimentAnalysis> {
    const analysis = await this.analyzeFeedback(feedbackText);
    await this.saveAnalysis(responseId, analysis);
    return analysis;
  }
}

export default new SentimentAnalyzer();

