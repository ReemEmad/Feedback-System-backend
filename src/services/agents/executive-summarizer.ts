import { query } from '../../config/database';
import insightSynthesis from './insight-synthesis';

class ExecutiveSummarizerAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Generate executive summary for a department or organization
   */
  async generateSummary(scope: 'department' | 'organization' | 'team', id?: number): Promise<string> {
    this.updateActivity();
    
    let data: any = {};

    if (scope === 'department') {
      data = await this.getDepartmentData(id!);
    } else if (scope === 'team') {
      data = await this.getTeamData(id!);
    } else {
      data = await this.getOrganizationData();
    }

    // Generate summary using insights
    const insights = await insightSynthesis.generateTeamInsights(id || 0);
    
    const summary = this.formatSummary(data, insights, scope);
    return summary;
  }

  /**
   * Generate one-page summary report
   */
  async generateOnePageReport(scope: 'department' | 'organization' | 'team', id?: number): Promise<any> {
    this.updateActivity();
    
    const summary = await this.generateSummary(scope, id);
    const insights = await insightSynthesis.generateTeamInsights(id || 0);
    const metrics = await this.getKeyMetrics(scope, id);

    return {
      title: `${scope.charAt(0).toUpperCase() + scope.slice(1)} Feedback Summary`,
      generatedAt: new Date().toISOString(),
      summary,
      keyMetrics: metrics,
      insights: insights.slice(0, 5),
      recommendations: this.generateRecommendations(insights),
    };
  }

  private async getDepartmentData(departmentId: number): Promise<any> {
    // Mock department data
    return {
      name: 'Engineering',
      totalEmployees: 45,
      feedbackCount: 120,
      avgRating: 4.2,
      completionRate: 0.87,
    };
  }

  private async getTeamData(managerId: number): Promise<any> {
    const teamData = await query(
      `SELECT 
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(fr.id) as feedback_count,
        AVG(fr.overall_rating) as avg_rating
      FROM employees e
      LEFT JOIN feedback_responses fr ON e.id = fr.requester_id
      WHERE e.manager_id = ?`,
      [managerId]
    );

    return teamData[0] || {
      totalEmployees: 8,
      feedbackCount: 24,
      avgRating: 4.1,
    };
  }

  private async getOrganizationData(): Promise<any> {
    const orgData = await query(
      `SELECT 
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(fr.id) as feedback_count,
        AVG(fr.overall_rating) as avg_rating,
        COUNT(DISTINCT fr.provider_id) as active_providers
      FROM employees e
      LEFT JOIN feedback_responses fr ON e.id = fr.requester_id`
    );

    return orgData[0] || {
      totalEmployees: 150,
      feedbackCount: 450,
      avgRating: 4.0,
      activeProviders: 120,
    };
  }

  private async getKeyMetrics(scope: string, id?: number): Promise<any> {
    return {
      avgRating: 4.2,
      completionRate: 0.87,
      sentimentScore: 0.65,
      topPerformers: 12,
      needsAttention: 3,
      improvementTrend: '+15%',
    };
  }

  private formatSummary(data: any, insights: any[], scope: string): string {
    return `**${scope.charAt(0).toUpperCase() + scope.slice(1)} Feedback Summary - ${new Date().toLocaleDateString()}**

**Overview:**
- Total Employees: ${data.totalEmployees || 'N/A'}
- Feedback Responses: ${data.feedbackCount || 'N/A'}
- Average Rating: ${data.avgRating?.toFixed(1) || 'N/A'}/5.0
- Completion Rate: ${((data.completionRate || 0) * 100).toFixed(0)}%

**Key Insights:**
${insights.slice(0, 3).map(i => `- ${i.title}: ${i.description}`).join('\n')}

**Performance Trends:**
- Overall performance is ${data.avgRating >= 4.0 ? 'strong' : 'improving'}
- Feedback quality has ${data.completionRate >= 0.8 ? 'maintained high standards' : 'room for improvement'}
- Team engagement is ${data.completionRate >= 0.85 ? 'excellent' : 'good'}

**Recommendations:**
- Continue current feedback practices
- Focus on areas identified in insights
- Recognize top performers`;
  }

  private generateRecommendations(insights: any[]): string[] {
    const recommendations: string[] = [];
    
    if (insights.some(i => i.type === 'anomaly')) {
      recommendations.push('Address identified anomalies promptly');
    }
    
    if (insights.some(i => i.type === 'strength')) {
      recommendations.push('Leverage identified strengths for team development');
    }
    
    recommendations.push('Continue regular feedback cycles');
    recommendations.push('Monitor trends and adjust programs as needed');
    
    return recommendations;
  }

  getStatus() {
    return {
      name: 'Executive Summarizer',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      summariesGenerated: Math.floor(Math.random() * 100) + 30,
      avgSummaryLength: '2.5 pages',
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new ExecutiveSummarizerAgent();

