import { query, get } from '../../config/database';

interface Anomaly {
  type: 'rating_drop' | 'sentiment_shift' | 'completion_rate' | 'quality_degradation' | 'team_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedEntity: { type: 'employee' | 'team' | 'department'; id: number; name: string };
  detectedAt: string;
  recommendedAction: string;
  confidence: number;
}

class AnomalyDetectorAgent {
  private isActive = true;
  private lastActivity = new Date();
  private anomaliesDetected: Anomaly[] = [];

  /**
   * Scan for anomalies across the system
   */
  async scanForAnomalies(): Promise<Anomaly[]> {
    this.updateActivity();
    
    const anomalies: Anomaly[] = [];

    // Check for rating drops
    const ratingDrops = await this.detectRatingDrops();
    anomalies.push(...ratingDrops);

    // Check for sentiment shifts
    const sentimentShifts = await this.detectSentimentShifts();
    anomalies.push(...sentimentShifts);

    // Check for completion rate issues
    const completionIssues = await this.detectCompletionIssues();
    anomalies.push(...completionIssues);

    // Store detected anomalies
    this.anomaliesDetected = anomalies;

    return anomalies;
  }

  /**
   * Detect sudden rating drops
   */
  private async detectRatingDrops(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    const employees = await query(
      `SELECT 
        e.id,
        e.name,
        AVG(CASE WHEN fr.submitted_at >= datetime('now', '-30 days') THEN fr.overall_rating END) as recent_avg,
        AVG(CASE WHEN fr.submitted_at < datetime('now', '-30 days') THEN fr.overall_rating END) as older_avg
      FROM employees e
      JOIN feedback_responses fr ON e.id = fr.requester_id
      GROUP BY e.id, e.name
      HAVING recent_avg IS NOT NULL AND older_avg IS NOT NULL
      AND (older_avg - recent_avg) > 1.0`
    );

    employees.forEach((emp: any) => {
      anomalies.push({
        type: 'rating_drop',
        severity: emp.older_avg - emp.recent_avg > 1.5 ? 'high' : 'medium',
        title: `Significant Rating Drop Detected`,
        description: `${emp.name}'s average rating dropped from ${emp.older_avg.toFixed(1)} to ${emp.recent_avg.toFixed(1)} over the past 30 days.`,
        affectedEntity: { type: 'employee', id: emp.id, name: emp.name },
        detectedAt: new Date().toISOString(),
        recommendedAction: 'Schedule a 1-on-1 to understand what changed and provide support.',
        confidence: 0.85,
      });
    });

    return anomalies;
  }

  /**
   * Detect sentiment shifts
   */
  private async detectSentimentShifts(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    const sentimentShifts = await query(
      `SELECT 
        e.id,
        e.name,
        AVG(CASE WHEN fr.submitted_at >= datetime('now', '-14 days') THEN fa.sentiment_score END) as recent_sentiment,
        AVG(CASE WHEN fr.submitted_at < datetime('now', '-14 days') THEN fa.sentiment_score END) as older_sentiment
      FROM employees e
      JOIN feedback_responses fr ON e.id = fr.requester_id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      GROUP BY e.id, e.name
      HAVING recent_sentiment IS NOT NULL AND older_sentiment IS NOT NULL
      AND (older_sentiment - recent_sentiment) > 0.5`
    );

    sentimentShifts.forEach((emp: any) => {
      anomalies.push({
        type: 'sentiment_shift',
        severity: 'medium',
        title: `Negative Sentiment Shift`,
        description: `Feedback sentiment for ${emp.name} has shifted negatively. Recent sentiment: ${emp.recent_sentiment.toFixed(2)} vs previous: ${emp.older_sentiment.toFixed(2)}`,
        affectedEntity: { type: 'employee', id: emp.id, name: emp.name },
        detectedAt: new Date().toISOString(),
        recommendedAction: 'Review recent feedback themes and check in with the employee.',
        confidence: 0.75,
      });
    });

    return anomalies;
  }

  /**
   * Detect completion rate issues
   */
  private async detectCompletionIssues(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    const lowCompletion = await query(
      `SELECT 
        e.id,
        e.name,
        COUNT(*) as total_requests,
        SUM(CASE WHEN fr.status = 'completed' THEN 1 ELSE 0 END) as completed,
        CAST(SUM(CASE WHEN fr.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as completion_rate
      FROM employees e
      JOIN feedback_requests fr ON e.id = fr.provider_id
      GROUP BY e.id, e.name
      HAVING completion_rate < 0.5 AND total_requests >= 3`
    );

    lowCompletion.forEach((emp: any) => {
      anomalies.push({
        type: 'completion_rate',
        severity: emp.completion_rate < 0.3 ? 'high' : 'medium',
        title: `Low Feedback Completion Rate`,
        description: `${emp.name} has only completed ${(emp.completion_rate * 100).toFixed(0)}% of feedback requests (${emp.completed}/${emp.total_requests}).`,
        affectedEntity: { type: 'employee', id: emp.id, name: emp.name },
        detectedAt: new Date().toISOString(),
        recommendedAction: 'Reach out to understand barriers and provide support.',
        confidence: 0.90,
      });
    });

    return anomalies;
  }

  /**
   * Get anomalies for a specific employee
   */
  async getEmployeeAnomalies(employeeId: number): Promise<Anomaly[]> {
    this.updateActivity();
    
    const allAnomalies = await this.scanForAnomalies();
    return allAnomalies.filter(a => a.affectedEntity.id === employeeId);
  }

  /**
   * Get recent anomalies
   */
  getRecentAnomalies(limit: number = 10): Anomaly[] {
    return this.anomaliesDetected
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, limit);
  }

  getStatus() {
    return {
      name: 'Anomaly Detector',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      anomaliesDetected: this.anomaliesDetected.length,
      criticalAlerts: this.anomaliesDetected.filter(a => a.severity === 'critical').length,
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new AnomalyDetectorAgent();

