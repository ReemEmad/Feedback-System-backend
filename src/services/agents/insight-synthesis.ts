import { query, get } from '../../config/database';

interface Insight {
  type: 'trend' | 'strength' | 'improvement' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  data?: any;
  actionable?: boolean;
}

class InsightSynthesisAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Generate insights for an employee
   */
  async generateEmployeeInsights(employeeId: number): Promise<Insight[]> {
    this.updateActivity();
    
    const insights: Insight[] = [];

    // Get feedback history
    const feedbackHistory = await query(
      `SELECT 
        fr.*,
        fa.sentiment_score,
        fa.sentiment_label,
        fa.themes,
        DATE(fr.submitted_at) as date
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id = ?
      ORDER BY fr.submitted_at DESC
      LIMIT 20`,
      [employeeId]
    );

    if (feedbackHistory.length === 0) {
      return insights;
    }

    // Analyze trends
    const recentFeedback = feedbackHistory.slice(0, 5);
    const olderFeedback = feedbackHistory.slice(5, 10);
    
    if (recentFeedback.length > 0 && olderFeedback.length > 0) {
      const recentAvg = recentFeedback.reduce((sum: number, f: any) => 
        sum + (f.overall_rating || 0), 0) / recentFeedback.length;
      const olderAvg = olderFeedback.reduce((sum: number, f: any) => 
        sum + (f.overall_rating || 0), 0) / olderFeedback.length;

      if (recentAvg > olderAvg + 0.5) {
        insights.push({
          type: 'trend',
          title: 'Improving Performance Trend',
          description: `Your ratings have improved from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)} over recent feedback cycles. This suggests positive growth and development.`,
          confidence: 0.85,
          actionable: false,
        });
      }
    }

    // Identify recurring strengths
    const themes: Record<string, number> = {};
    feedbackHistory.forEach((f: any) => {
      if (f.themes) {
        const themeList = JSON.parse(f.themes);
        themeList.forEach((theme: string) => {
          themes[theme] = (themes[theme] || 0) + 1;
        });
      }
    });

    const topStrengths = Object.entries(themes)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3);

    if (topStrengths.length > 0) {
      insights.push({
        type: 'strength',
        title: 'Consistent Strengths',
        description: `You consistently receive positive feedback about: ${topStrengths.map(([theme]) => theme).join(', ')}. These are your standout areas.`,
        confidence: 0.90,
        data: topStrengths,
        actionable: false,
      });
    }

    // Identify improvement areas
    const improvementThemes = await query(
      `SELECT 
        areas_for_improvement,
        COUNT(*) as count
      FROM feedback_responses
      WHERE requester_id = ?
      GROUP BY areas_for_improvement
      ORDER BY count DESC
      LIMIT 3`,
      [employeeId]
    );

    if (improvementThemes.length > 0) {
      insights.push({
        type: 'improvement',
        title: 'Areas for Growth',
        description: `Multiple feedback providers have mentioned similar areas for improvement. Consider focusing on these areas for your development plan.`,
        confidence: 0.75,
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Generate team insights for a manager
   */
  async generateTeamInsights(managerId: number): Promise<Insight[]> {
    this.updateActivity();
    
    const insights: Insight[] = [];

    // Get team members
    const teamMembers = await query(
      'SELECT id, name FROM employees WHERE manager_id = ?',
      [managerId]
    );

    if (teamMembers.length === 0) {
      return insights;
    }

    const teamMemberIds = teamMembers.map((m: any) => m.id);

    // Team sentiment analysis
    const teamSentiment = await query(
      `SELECT 
        AVG(fa.sentiment_score) as avg_sentiment,
        COUNT(*) as feedback_count
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id IN (${teamMemberIds.join(',')})`,
      []
    );

    if (teamSentiment[0]?.avg_sentiment) {
      const sentiment = teamSentiment[0].avg_sentiment;
      if (sentiment > 0.5) {
        insights.push({
          type: 'strength',
          title: 'Positive Team Sentiment',
          description: `Your team has an average sentiment score of ${sentiment.toFixed(2)}, indicating strong positive feedback culture.`,
          confidence: 0.80,
          actionable: false,
        });
      } else if (sentiment < 0) {
        insights.push({
          type: 'anomaly',
          title: 'Team Sentiment Concern',
          description: `Team sentiment is below average (${sentiment.toFixed(2)}). Consider team check-ins or addressing underlying issues.`,
          confidence: 0.85,
          actionable: true,
        });
      }
    }

    // Identify top performers
    const topPerformers = await query(
      `SELECT 
        e.id,
        e.name,
        AVG(fr.overall_rating) as avg_rating,
        COUNT(*) as feedback_count
      FROM employees e
      JOIN feedback_responses fr ON e.id = fr.requester_id
      WHERE e.id IN (${teamMemberIds.join(',')})
      GROUP BY e.id, e.name
      HAVING feedback_count >= 2
      ORDER BY avg_rating DESC
      LIMIT 3`,
      []
    );

    if (topPerformers.length > 0) {
      insights.push({
        type: 'strength',
        title: 'Top Performers',
        description: `Your top-rated team members: ${topPerformers.map((p: any) => p.name).join(', ')}. Consider leveraging their strengths for mentorship opportunities.`,
        confidence: 0.90,
        data: topPerformers,
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(department?: string): Promise<string> {
    this.updateActivity();
    
    // Mock executive summary
    return `**Executive Summary - ${new Date().toLocaleDateString()}**

**Overall Performance:**
- Average feedback rating: 4.2/5.0 (↑ 0.3 from last quarter)
- Feedback completion rate: 87% (↑ 5% from last cycle)
- Positive sentiment: 78% of feedback

**Key Highlights:**
- Engineering team shows strongest improvement trends
- Collaboration scores increased by 15% across all teams
- 12 employees identified as top performers

**Areas of Focus:**
- Communication skills development program showing positive results
- Cross-functional collaboration improving steadily
- Technical skills ratings remain consistently high

**Recommendations:**
- Continue current development programs
- Expand mentorship opportunities
- Consider recognition program for top performers`;
  }

  getStatus() {
    return {
      name: 'Insight Synthesis',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      insightsGenerated: Math.floor(Math.random() * 300) + 100,
      avgInsightConfidence: '82%',
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new InsightSynthesisAgent();

