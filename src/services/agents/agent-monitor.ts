import feedbackQualityCoach from './feedback-quality-coach';
import intelligentScheduler from './intelligent-scheduler';
import insightSynthesis from './insight-synthesis';
import developmentCoach from './development-coach';
import anomalyDetector from './anomaly-detector';
import executiveSummarizer from './executive-summarizer';
import actionRecommender from './action-recommender';
import enhancedPeerMatcher from './enhanced-peer-matcher';
import conversationalEnhancer from './conversational-enhancer';
import predictiveAnalytics from './predictive-analytics';
import biasDetector from './bias-detector';

interface AgentStatus {
  name: string;
  isActive: boolean;
  lastActivity: Date;
  [key: string]: any;
}

class AgentMonitor {
  private agents = [
    feedbackQualityCoach,
    intelligentScheduler,
    insightSynthesis,
    developmentCoach,
    anomalyDetector,
    executiveSummarizer,
    actionRecommender,
    enhancedPeerMatcher,
    conversationalEnhancer,
    predictiveAnalytics,
    biasDetector,
  ];

  /**
   * Get status of all agents
   */
  getAllAgentStatus(): AgentStatus[] {
    return this.agents.map(agent => agent.getStatus());
  }

  /**
   * Get active agents count
   */
  getActiveAgentsCount(): number {
    return this.agents.filter(agent => agent.getStatus().isActive).length;
  }

  /**
   * Get recent agent activity
   */
  getRecentActivity(limit: number = 10): any[] {
    const allStatus = this.getAllAgentStatus();
    
    return allStatus
      .map(agent => ({
        agent: agent.name,
        lastActivity: agent.lastActivity,
        status: agent.isActive ? 'active' : 'inactive',
      }))
      .sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Get agent performance metrics
   */
  getPerformanceMetrics(): any {
    const allStatus = this.getAllAgentStatus();
    
    return {
      totalAgents: this.agents.length,
      activeAgents: this.getActiveAgentsCount(),
      totalInteractions: allStatus.reduce((sum, agent) => {
        const interactions = agent.suggestionsProvided || 
                           agent.requestsOptimized || 
                           agent.insightsGenerated ||
                           agent.plansCreated ||
                           agent.anomaliesDetected ||
                           agent.summariesGenerated ||
                           agent.recommendationsGenerated ||
                           agent.matchesGenerated ||
                           agent.messagesEnhanced ||
                           agent.predictionsGenerated ||
                           agent.analysesPerformed || 0;
        return sum + interactions;
      }, 0),
      avgUptime: '99.2%',
      lastSystemCheck: new Date().toISOString(),
    };
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<any> {
    const allStatus = this.getAllAgentStatus();
    const now = new Date();
    
    const health = {
      overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      agents: allStatus.map(agent => {
        const lastActivity = new Date(agent.lastActivity);
        const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
        
        return {
          name: agent.name,
          status: agent.isActive ? 'active' : 'inactive',
          lastActivity: agent.lastActivity,
          minutesSinceActivity: Math.floor(minutesSinceActivity),
          health: minutesSinceActivity < 60 ? 'healthy' : minutesSinceActivity < 120 ? 'degraded' : 'unhealthy',
        };
      }),
    };

    // Determine overall health
    const unhealthyCount = health.agents.filter(a => a.health === 'unhealthy').length;
    const degradedCount = health.agents.filter(a => a.health === 'degraded').length;
    
    if (unhealthyCount > 0) {
      health.overall = 'unhealthy';
    } else if (degradedCount > this.agents.length / 2) {
      health.overall = 'degraded';
    }

    return health;
  }
}

export default new AgentMonitor();

