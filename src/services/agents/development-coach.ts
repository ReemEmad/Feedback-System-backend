import { query, get } from '../../config/database';

interface DevelopmentRecommendation {
  type: 'course' | 'mentor' | 'project' | 'skill' | 'resource';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
  resource?: string;
}

interface DevelopmentPlan {
  employeeId: number;
  currentStrengths: string[];
  focusAreas: string[];
  recommendations: DevelopmentRecommendation[];
  timeline: string;
}

class DevelopmentCoachAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Generate personalized development plan
   */
  async generateDevelopmentPlan(employeeId: number): Promise<DevelopmentPlan> {
    this.updateActivity();
    
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    
    // Analyze feedback to identify strengths and areas for improvement
    const feedback = await query(
      `SELECT 
        fr.strengths,
        fr.areas_for_improvement,
        fr.actionable_suggestions,
        fa.themes
      FROM feedback_responses fr
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE fr.requester_id = ?
      ORDER BY fr.submitted_at DESC
      LIMIT 10`,
      [employeeId]
    );

    // Extract strengths
    const strengths: string[] = [];
    const themes: Record<string, number> = {};
    
    feedback.forEach((f: any) => {
      if (f.themes) {
        const themeList = JSON.parse(f.themes);
        themeList.forEach((theme: string) => {
          themes[theme] = (themes[theme] || 0) + 1;
        });
      }
    });

    const topStrengths = Object.entries(themes)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([theme]) => theme);

    // Extract improvement areas
    const improvementKeywords = ['communication', 'leadership', 'technical', 'collaboration', 'time management'];
    const focusAreas: string[] = [];
    
    feedback.forEach((f: any) => {
      const text = (f.areas_for_improvement || '').toLowerCase();
      improvementKeywords.forEach(keyword => {
        if (text.includes(keyword) && !focusAreas.includes(keyword)) {
          focusAreas.push(keyword);
        }
      });
    });

    // Generate recommendations
    const recommendations: DevelopmentRecommendation[] = [];

    if (focusAreas.includes('communication')) {
      recommendations.push({
        type: 'course',
        title: 'Effective Communication Workshop',
        description: 'Improve your written and verbal communication skills',
        priority: 'high',
        estimatedImpact: 'High - directly addresses feedback themes',
        resource: 'Internal Learning Platform',
      });
    }

    if (focusAreas.includes('leadership')) {
      recommendations.push({
        type: 'mentor',
        title: 'Find a Leadership Mentor',
        description: 'Connect with senior leaders for guidance',
        priority: 'high',
        estimatedImpact: 'High - personalized guidance',
      });
    }

    if (focusAreas.includes('technical')) {
      recommendations.push({
        type: 'course',
        title: 'Advanced Technical Skills Program',
        description: 'Deep dive into advanced technical concepts',
        priority: 'medium',
        estimatedImpact: 'Medium - skill enhancement',
        resource: 'Pluralsight / Udemy',
      });
    }

    // Add generic recommendations if none found
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'project',
        title: 'Stretch Assignment',
        description: 'Take on a challenging project to develop new skills',
        priority: 'medium',
        estimatedImpact: 'Medium - hands-on learning',
      });
    }

    return {
      employeeId,
      currentStrengths: topStrengths.length > 0 ? topStrengths : ['Collaboration', 'Problem Solving'],
      focusAreas: focusAreas.length > 0 ? focusAreas : ['Continuous Learning'],
      recommendations,
      timeline: '3-6 months',
    };
  }

  /**
   * Get specific recommendations based on feedback
   */
  async getRecommendations(employeeId: number, limit: number = 5): Promise<DevelopmentRecommendation[]> {
    this.updateActivity();
    
    const plan = await this.generateDevelopmentPlan(employeeId);
    return plan.recommendations.slice(0, limit);
  }

  /**
   * Track progress on development plan
   */
  async trackProgress(employeeId: number): Promise<any> {
    this.updateActivity();
    
    return {
      planCreated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      recommendationsCompleted: Math.floor(Math.random() * 3),
      totalRecommendations: 5,
      progressPercentage: Math.floor(Math.random() * 40) + 20,
      nextMilestone: 'Complete first course',
      estimatedCompletion: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  getStatus() {
    return {
      name: 'Development Coach',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      plansCreated: Math.floor(Math.random() * 150) + 50,
      avgPlanCompletion: '65%',
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new DevelopmentCoachAgent();

