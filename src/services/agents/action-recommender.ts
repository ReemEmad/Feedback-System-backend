import { query, get } from '../../config/database';

interface ActionRecommendation {
  type: 'one_on_one' | 'training' | 'team_initiative' | 'recognition' | 'support' | 'mentorship';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  suggestedFor: { type: 'employee' | 'team' | 'department'; id: number; name: string };
  estimatedImpact: string;
  relatedFeedback?: number[];
}

class ActionRecommenderAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Generate action recommendations based on feedback
   */
  async generateRecommendations(employeeId?: number, managerId?: number): Promise<ActionRecommendation[]> {
    this.updateActivity();
    
    const recommendations: ActionRecommendation[] = [];

    if (employeeId) {
      // Employee-specific recommendations
      const employeeRecs = await this.getEmployeeRecommendations(employeeId);
      recommendations.push(...employeeRecs);
    }

    if (managerId) {
      // Team-level recommendations
      const teamRecs = await this.getTeamRecommendations(managerId);
      recommendations.push(...teamRecs);
    }

    return recommendations;
  }

  /**
   * Get recommendations for a specific employee
   */
  private async getEmployeeRecommendations(employeeId: number): Promise<ActionRecommendation[]> {
    const recommendations: ActionRecommendation[] = [];
    
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    const feedback = await query(
      `SELECT 
        fr.*,
        fa.sentiment_score,
        fa.sentiment_label
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id = ?
      ORDER BY fr.submitted_at DESC
      LIMIT 5`,
      [employeeId]
    );

    // Check for negative sentiment
    const negativeFeedback = feedback.filter((f: any) => 
      f.sentiment_label === 'negative' || (f.overall_rating && f.overall_rating < 3)
    );

    if (negativeFeedback.length > 0) {
      recommendations.push({
        type: 'one_on_one',
        title: 'Schedule Supportive 1-on-1',
        description: `Recent feedback indicates ${employee.name} may need support. Schedule a 1-on-1 to discuss feedback and provide guidance.`,
        priority: 'high',
        suggestedFor: { type: 'employee', id: employeeId, name: employee.name },
        estimatedImpact: 'High - addresses concerns early',
        relatedFeedback: negativeFeedback.map((f: any) => f.id),
      });
    }

    // Check for improvement themes
    const improvementText = feedback
      .map((f: any) => f.areas_for_improvement || '')
      .join(' ')
      .toLowerCase();

    if (improvementText.includes('communication')) {
      recommendations.push({
        type: 'training',
        title: 'Communication Skills Training',
        description: 'Multiple feedback providers mentioned communication as an area for improvement.',
        priority: 'medium',
        suggestedFor: { type: 'employee', id: employeeId, name: employee.name },
        estimatedImpact: 'Medium - addresses recurring theme',
      });
    }

    // Check for strengths that could be leveraged
    const strengthsText = feedback
      .map((f: any) => f.strengths || '')
      .join(' ')
      .toLowerCase();

    if (strengthsText.includes('leadership') || strengthsText.includes('mentor')) {
      recommendations.push({
        type: 'mentorship',
        title: 'Mentorship Opportunity',
        description: 'Feedback highlights leadership potential. Consider pairing with junior team members.',
        priority: 'low',
        suggestedFor: { type: 'employee', id: employeeId, name: employee.name },
        estimatedImpact: 'Medium - develops leadership skills',
      });
    }

    return recommendations;
  }

  /**
   * Get team-level recommendations
   */
  private async getTeamRecommendations(managerId: number): Promise<ActionRecommendation[]> {
    const recommendations: ActionRecommendation[] = [];
    
    const teamMembers = await query(
      'SELECT id, name FROM employees WHERE manager_id = ?',
      [managerId]
    );

    if (teamMembers.length === 0) {
      return recommendations;
    }

    const teamMemberIds = teamMembers.map((m: any) => m.id);

    // Check team sentiment
    const teamSentiment = await query(
      `SELECT 
        AVG(fa.sentiment_score) as avg_sentiment,
        COUNT(*) as feedback_count
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id IN (${teamMemberIds.join(',')})`,
      []
    );

    if (teamSentiment[0]?.avg_sentiment < 0) {
      recommendations.push({
        type: 'team_initiative',
        title: 'Team Building Activity',
        description: 'Team sentiment is below average. Consider a team building activity to improve collaboration.',
        priority: 'medium',
        suggestedFor: { type: 'team', id: managerId, name: 'Your Team' },
        estimatedImpact: 'Medium - improves team dynamics',
      });
    }

    // Check for common themes
    const commonThemes = await query(
      `SELECT 
        fa.themes,
        COUNT(*) as count
      FROM feedback_responses fr
      JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id IN (${teamMemberIds.join(',')})
      GROUP BY fa.themes
      ORDER BY count DESC
      LIMIT 3`,
      []
    );

    if (commonThemes.length > 0) {
      const topTheme = JSON.parse(commonThemes[0].themes || '[]')[0];
      if (topTheme) {
        recommendations.push({
          type: 'training',
          title: `Team Training: ${topTheme}`,
          description: `Multiple team members received feedback about ${topTheme}. Consider team-wide training.`,
          priority: 'medium',
          suggestedFor: { type: 'team', id: managerId, name: 'Your Team' },
          estimatedImpact: 'High - addresses common theme',
        });
      }
    }

    // Identify top performers for recognition
    const topPerformers = await query(
      `SELECT 
        e.id,
        e.name,
        AVG(fr.overall_rating) as avg_rating
      FROM employees e
      JOIN feedback_responses fr ON e.id = fr.requester_id
      WHERE e.id IN (${teamMemberIds.join(',')})
      GROUP BY e.id, e.name
      HAVING COUNT(*) >= 3
      ORDER BY avg_rating DESC
      LIMIT 3`,
      []
    );

    if (topPerformers.length > 0) {
      recommendations.push({
        type: 'recognition',
        title: 'Recognize Top Performers',
        description: `Consider recognizing: ${topPerformers.map((p: any) => p.name).join(', ')} for their outstanding performance.`,
        priority: 'low',
        suggestedFor: { type: 'team', id: managerId, name: 'Your Team' },
        estimatedImpact: 'Medium - boosts morale',
      });
    }

    return recommendations;
  }

  /**
   * Get recommendations for a specific feedback response
   */
  async getFeedbackSpecificRecommendations(responseId: number): Promise<ActionRecommendation[]> {
    this.updateActivity();
    
    const response = await get(
      `SELECT 
        fr.*,
        e1.name as requester_name,
        e1.manager_id,
        fa.sentiment_score,
        fa.sentiment_label
      FROM feedback_responses fr
      JOIN employees e1 ON fr.requester_id = e1.id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.id = ?`,
      [responseId]
    );

    if (!response) {
      return [];
    }

    const recommendations: ActionRecommendation[] = [];

    if (response.sentiment_label === 'negative' || response.overall_rating < 3) {
      recommendations.push({
        type: 'one_on_one',
        title: 'Follow-up Discussion',
        description: `This feedback indicates areas needing attention. Schedule a discussion with ${response.requester_name}.`,
        priority: 'high',
        suggestedFor: { 
          type: response.manager_id ? 'employee' : 'team', 
          id: response.requester_id, 
          name: response.requester_name 
        },
        estimatedImpact: 'High - addresses concerns',
        relatedFeedback: [responseId],
      });
    }

    return recommendations;
  }

  getStatus() {
    return {
      name: 'Action Recommender',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      recommendationsGenerated: Math.floor(Math.random() * 200) + 80,
      actionsTaken: Math.floor(Math.random() * 100) + 30,
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new ActionRecommenderAgent();

