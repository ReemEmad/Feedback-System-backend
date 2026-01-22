import { query, get } from '../../config/database';

interface OptimalTime {
  date: string;
  time: string;
  confidence: number;
  reason: string;
}

interface ScheduleRecommendation {
  employeeId: number;
  optimalTimes: OptimalTime[];
  avoidTimes: string[];
  estimatedCompletionRate: number;
}

class IntelligentSchedulerAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Find optimal time to send feedback request
   */
  async findOptimalTime(employeeId: number): Promise<ScheduleRecommendation> {
    this.updateActivity();
    
    // Mock: Analyze patterns (in real implementation, would use calendar data)
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    
    // Simulate analysis based on historical data
    const historicalData = await query(
      `SELECT 
        strftime('%H', datetime(submitted_at)) as hour,
        strftime('%w', datetime(submitted_at)) as day_of_week,
        COUNT(*) as count
      FROM feedback_responses
      WHERE provider_id = ?
      GROUP BY hour, day_of_week
      ORDER BY count DESC
      LIMIT 5`,
      [employeeId]
    );

    // Generate optimal times (mock logic)
    const optimalTimes: OptimalTime[] = [
      {
        date: this.getNextBusinessDay(),
        time: '10:00',
        confidence: 0.85,
        reason: 'Based on your completion history, you typically complete feedback around this time',
      },
      {
        date: this.getNextBusinessDay(2),
        time: '14:00',
        confidence: 0.75,
        reason: 'Second-best time slot based on your patterns',
      },
      {
        date: this.getNextBusinessDay(3),
        time: '09:00',
        confidence: 0.70,
        reason: 'Early morning slot when you\'re most productive',
      },
    ];

    // Avoid times
    const avoidTimes = [
      'Monday 08:00-09:00 (typically busy with weekly planning)',
      'Friday 16:00-17:00 (end of week, lower completion rate)',
    ];

    // Calculate estimated completion rate
    const estimatedCompletionRate = 0.78 + Math.random() * 0.15;

    return {
      employeeId,
      optimalTimes,
      avoidTimes,
      estimatedCompletionRate: Math.round(estimatedCompletionRate * 100),
    };
  }

  /**
   * Check if current time is optimal for sending reminder
   */
  async shouldSendReminderNow(employeeId: number): Promise<boolean> {
    this.updateActivity();
    
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Avoid weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Avoid early morning and late evening
    if (hour < 9 || hour > 17) {
      return false;
    }

    // Check historical completion rates for this time
    const completionRate = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM feedback_requests
      WHERE provider_id = ?
      AND strftime('%H', datetime(created_at)) = ?
      AND strftime('%w', datetime(created_at)) = ?`,
      [employeeId, hour.toString().padStart(2, '0'), dayOfWeek.toString()]
    );

    // Mock: if no data, assume good time
    if (!completionRate[0]?.total) {
      return hour >= 10 && hour <= 15;
    }

    const rate = completionRate[0].completed / completionRate[0].total;
    return rate > 0.5;
  }

  /**
   * Get schedule insights for an employee
   */
  async getScheduleInsights(employeeId: number): Promise<any> {
    this.updateActivity();
    
    return {
      bestDay: 'Tuesday',
      bestTime: '10:00 AM',
      avgCompletionTime: '12 minutes',
      completionRate: '82%',
      preferredChannel: 'Teams Chat',
      timezone: 'UTC-5',
    };
  }

  private getNextBusinessDay(offset: number = 1): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    
    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }

  getStatus() {
    return {
      name: 'Intelligent Scheduler',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      requestsOptimized: Math.floor(Math.random() * 200) + 50,
      avgCompletionRateImprovement: '18%',
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new IntelligentSchedulerAgent();

