import { query, get } from '../config/database';

class AnalyticsService {
  /**
   * Get overall feedback statistics
   */
  async getOverallStats(): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_feedback,
        AVG(fr.overall_rating) as avg_rating,
        AVG(fa.sentiment_score) as avg_sentiment,
        SUM(CASE WHEN fa.is_constructive = 1 THEN 1 ELSE 0 END) as constructive_count,
        AVG(fa.quality_score) as avg_quality_score
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
    `;

    return await get(sql);
  }

  /**
   * Get sentiment trends over time
   */
  async getSentimentTrends(startDate: string, endDate: string): Promise<any[]> {
    const sql = `
      SELECT 
        DATE(fr.submitted_at) as date,
        AVG(fa.sentiment_score) as avg_sentiment,
        COUNT(*) as feedback_count
      FROM feedback_responses fr
      JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.submitted_at BETWEEN ? AND ?
      GROUP BY DATE(fr.submitted_at)
      ORDER BY date ASC
    `;

    return await query(sql, [startDate, endDate]);
  }

  /**
   * Get feedback statistics by department
   */
  async getStatsByDepartment(): Promise<any[]> {
    const sql = `
      SELECT 
        e.department,
        COUNT(*) as feedback_count,
        AVG(fr.overall_rating) as avg_rating,
        AVG(fa.sentiment_score) as avg_sentiment,
        AVG(fa.quality_score) as avg_quality
      FROM feedback_responses fr
      JOIN employees e ON fr.requester_id = e.id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE e.department IS NOT NULL
      GROUP BY e.department
      ORDER BY feedback_count DESC
    `;

    return await query(sql);
  }

  /**
   * Get team analytics for a manager
   */
  async getTeamAnalytics(managerId: number): Promise<any> {
    // Get team members
    const teamMembers = await query(
      'SELECT id, name, email, role FROM employees WHERE manager_id = ?',
      [managerId]
    );

    const teamMemberIds = teamMembers.map((m: any) => m.id);

    if (teamMemberIds.length === 0) {
      return {
        team_members: [],
        team_stats: null,
        individual_stats: [],
      };
    }

    // Get team-wide statistics
    const teamStats = await get(
      `SELECT 
        COUNT(*) as total_feedback,
        AVG(fr.overall_rating) as avg_rating,
        AVG(fa.sentiment_score) as avg_sentiment,
        SUM(CASE WHEN fa.sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN fa.sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative_count,
        SUM(CASE WHEN fa.sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral_count
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id IN (${teamMemberIds.join(',')})`,
      []
    );

    // Get individual statistics for each team member
    const individualStats = [];
    for (const member of teamMembers) {
      const stats = await get(
        `SELECT 
          ? as employee_id,
          ? as employee_name,
          COUNT(*) as feedback_count,
          AVG(fr.overall_rating) as avg_rating,
          AVG(fa.sentiment_score) as avg_sentiment
        FROM feedback_responses fr
        LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
        WHERE fr.requester_id = ?`,
        [member.id, member.name, member.id]
      );
      individualStats.push(stats);
    }

    return {
      team_members: teamMembers,
      team_stats: teamStats,
      individual_stats: individualStats,
    };
  }

  /**
   * Get individual employee analytics
   */
  async getEmployeeAnalytics(employeeId: number): Promise<any> {
    // Get feedback received
    const feedbackReceived = await query(
      `SELECT 
        fr.*,
        fa.sentiment_score,
        fa.sentiment_label,
        fa.themes,
        fa.quality_score,
        e.name as provider_name
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      JOIN employees e ON fr.provider_id = e.id
      WHERE fr.requester_id = ?
      ORDER BY fr.submitted_at DESC`,
      [employeeId]
    );

    // Parse JSON fields
    feedbackReceived.forEach((fb: any) => {
      if (fb.themes) fb.themes = JSON.parse(fb.themes);
    });

    // Calculate aggregated metrics
    const aggregated = await get(
      `SELECT 
        COUNT(*) as total_feedback,
        AVG(fr.overall_rating) as avg_overall_rating,
        AVG(fr.collaboration_rating) as avg_collaboration_rating,
        AVG(fr.communication_rating) as avg_communication_rating,
        AVG(fr.technical_rating) as avg_technical_rating,
        AVG(fa.sentiment_score) as avg_sentiment,
        AVG(fa.quality_score) as avg_quality
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id = ?`,
      [employeeId]
    );

    // Get theme distribution
    const themes = await query(
      `SELECT fa.themes
      FROM feedback_responses fr
      JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id = ?`,
      [employeeId]
    );

    const themeCount: { [key: string]: number } = {};
    themes.forEach((t: any) => {
      if (t.themes) {
        const themeList = JSON.parse(t.themes);
        themeList.forEach((theme: string) => {
          themeCount[theme] = (themeCount[theme] || 0) + 1;
        });
      }
    });

    // Get rating trends over time
    const ratingTrends = await query(
      `SELECT 
        DATE(fr.submitted_at) as date,
        AVG(fr.overall_rating) as avg_rating
      FROM feedback_responses fr
      WHERE fr.requester_id = ?
      GROUP BY DATE(fr.submitted_at)
      ORDER BY date ASC`,
      [employeeId]
    );

    return {
      feedback_received: feedbackReceived,
      aggregated_metrics: aggregated,
      theme_distribution: themeCount,
      rating_trends: ratingTrends,
    };
  }

  /**
   * Get completion rate statistics
   */
  async getCompletionRates(cycleId?: string): Promise<any> {
    let sql = `
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        ROUND(CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 2) as completion_rate
      FROM feedback_requests
    `;

    const params: any[] = [];
    if (cycleId) {
      sql += ' WHERE cycle_id = ?';
      params.push(cycleId);
    }

    return await get(sql, params);
  }

  /**
   * Get top performers based on feedback
   */
  async getTopPerformers(limit: number = 10): Promise<any[]> {
    const sql = `
      SELECT 
        e.id,
        e.name,
        e.department,
        e.role,
        COUNT(*) as feedback_count,
        AVG(fr.overall_rating) as avg_rating,
        AVG(fa.sentiment_score) as avg_sentiment
      FROM employees e
      JOIN feedback_responses fr ON e.id = fr.requester_id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      GROUP BY e.id, e.name, e.department, e.role
      HAVING feedback_count >= 3
      ORDER BY avg_rating DESC, avg_sentiment DESC
      LIMIT ?
    `;

    return await query(sql, [limit]);
  }

  /**
   * Get employees needing attention (low ratings or negative sentiment)
   */
  async getEmployeesNeedingAttention(): Promise<any[]> {
    const sql = `
      SELECT 
        e.id,
        e.name,
        e.department,
        e.role,
        e.manager_id,
        COUNT(*) as feedback_count,
        AVG(fr.overall_rating) as avg_rating,
        AVG(fa.sentiment_score) as avg_sentiment,
        SUM(CASE WHEN fa.sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative_count
      FROM employees e
      JOIN feedback_responses fr ON e.id = fr.requester_id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      GROUP BY e.id, e.name, e.department, e.role, e.manager_id
      HAVING (avg_rating < 3 OR avg_sentiment < -0.2 OR negative_count >= 2)
      ORDER BY avg_rating ASC, avg_sentiment ASC
    `;

    return await query(sql);
  }

  /**
   * Get feedback quality distribution
   */
  async getFeedbackQualityDistribution(): Promise<any> {
    const sql = `
      SELECT 
        CASE 
          WHEN quality_score >= 80 THEN 'High'
          WHEN quality_score >= 60 THEN 'Medium'
          ELSE 'Low'
        END as quality_level,
        COUNT(*) as count
      FROM feedback_analysis
      GROUP BY quality_level
    `;

    return await query(sql);
  }

  /**
   * Export feedback data for a specific employee or cycle
   */
  async exportFeedbackData(filters: { employeeId?: number; cycleId?: string }): Promise<any[]> {
    let sql = `
      SELECT 
        fr.*,
        e1.name as requester_name,
        e1.email as requester_email,
        e1.department as requester_department,
        e2.name as provider_name,
        e2.email as provider_email,
        fa.sentiment_score,
        fa.sentiment_label,
        fa.themes,
        fa.quality_score,
        fc.name as cycle_name
      FROM feedback_responses fr
      JOIN employees e1 ON fr.requester_id = e1.id
      JOIN employees e2 ON fr.provider_id = e2.id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      JOIN feedback_requests freq ON fr.request_id = freq.id
      JOIN feedback_cycles fc ON freq.cycle_id = fc.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.employeeId) {
      sql += ' AND fr.requester_id = ?';
      params.push(filters.employeeId);
    }

    if (filters.cycleId) {
      sql += ' AND freq.cycle_id = ?';
      params.push(filters.cycleId);
    }

    sql += ' ORDER BY fr.submitted_at DESC';

    const results = await query(sql, params);

    // Parse JSON fields
    results.forEach((row: any) => {
      if (row.themes) row.themes = JSON.parse(row.themes);
    });

    return results;
  }
}

export default new AnalyticsService();

