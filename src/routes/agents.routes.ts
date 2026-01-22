import { Router, Request, Response } from 'express';
import feedbackQualityCoach from '../services/agents/feedback-quality-coach';
import intelligentScheduler from '../services/agents/intelligent-scheduler';
import insightSynthesis from '../services/agents/insight-synthesis';
import developmentCoach from '../services/agents/development-coach';
import anomalyDetector from '../services/agents/anomaly-detector';
import executiveSummarizer from '../services/agents/executive-summarizer';
import actionRecommender from '../services/agents/action-recommender';
import enhancedPeerMatcher from '../services/agents/enhanced-peer-matcher';
import conversationalEnhancer from '../services/agents/conversational-enhancer';
import predictiveAnalytics from '../services/agents/predictive-analytics';
import biasDetector from '../services/agents/bias-detector';
import agentMonitor from '../services/agents/agent-monitor';

const router = Router();

/**
 * Get status of all agents
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = agentMonitor.getAllAgentStatus();
    const metrics = agentMonitor.getPerformanceMetrics();
    
    res.json({
      agents: status,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await agentMonitor.healthCheck();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent agent activity
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const activity = agentMonitor.getRecentActivity(limit);
    res.json({ activity });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Feedback Quality Coach endpoints
router.post('/quality-coach/analyze', async (req: Request, res: Response) => {
  try {
    const { feedbackText, field, requesterRole } = req.body;
    const suggestions = await feedbackQualityCoach.analyzeFeedbackQuality(
      feedbackText,
      field,
      requesterRole
    );
    res.json({ suggestions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/quality-coach/examples/:role/:field', async (req: Request, res: Response) => {
  try {
    const { role, field } = req.params;
    const examples = await feedbackQualityCoach.getRoleExamples(role, field);
    res.json({ examples });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Intelligent Scheduler endpoints
router.get('/scheduler/optimal-time/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const recommendation = await intelligentScheduler.findOptimalTime(parseInt(employeeId));
    res.json(recommendation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/scheduler/insights/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const insights = await intelligentScheduler.getScheduleInsights(parseInt(employeeId));
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Insight Synthesis endpoints
router.get('/insights/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const insights = await insightSynthesis.generateEmployeeInsights(parseInt(employeeId));
    res.json({ insights });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/insights/team/:managerId', async (req: Request, res: Response) => {
  try {
    const { managerId } = req.params;
    const insights = await insightSynthesis.generateTeamInsights(parseInt(managerId));
    res.json({ insights });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/insights/executive-summary', async (req: Request, res: Response) => {
  try {
    const scope = (req.query.scope as 'department' | 'organization' | 'team') || 'organization';
    const id = req.query.id ? parseInt(req.query.id as string) : undefined;
    const summary = await executiveSummarizer.generateSummary(scope, id);
    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/insights/executive-report', async (req: Request, res: Response) => {
  try {
    const scope = (req.query.scope as 'department' | 'organization' | 'team') || 'organization';
    const id = req.query.id ? parseInt(req.query.id as string) : undefined;
    const report = await executiveSummarizer.generateOnePageReport(scope, id);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Development Coach endpoints
router.get('/development/plan/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const plan = await developmentCoach.generateDevelopmentPlan(parseInt(employeeId));
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/development/recommendations/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    const recommendations = await developmentCoach.getRecommendations(parseInt(employeeId), limit);
    res.json({ recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/development/progress/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const progress = await developmentCoach.trackProgress(parseInt(employeeId));
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Anomaly Detector endpoints
router.get('/anomalies/scan', async (req: Request, res: Response) => {
  try {
    const anomalies = await anomalyDetector.scanForAnomalies();
    res.json({ anomalies, count: anomalies.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/anomalies/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const anomalies = await anomalyDetector.getEmployeeAnomalies(parseInt(employeeId));
    res.json({ anomalies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/anomalies/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const anomalies = anomalyDetector.getRecentAnomalies(limit);
    res.json({ anomalies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Action Recommender endpoints
router.get('/actions/recommendations', async (req: Request, res: Response) => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
    const managerId = req.query.managerId ? parseInt(req.query.managerId as string) : undefined;
    const recommendations = await actionRecommender.generateRecommendations(employeeId, managerId);
    res.json({ recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/actions/feedback/:responseId', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;
    const recommendations = await actionRecommender.getFeedbackSpecificRecommendations(parseInt(responseId));
    res.json({ recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced Peer Matcher endpoints
router.get('/peer-matching/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const count = parseInt(req.query.count as string) || 3;
    const matches = await enhancedPeerMatcher.getEnhancedMatches(parseInt(employeeId), count);
    res.json({ matches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/peer-matching/balanced/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const network = await enhancedPeerMatcher.getBalancedPeerNetwork(parseInt(employeeId));
    res.json(network);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conversational Enhancer endpoints
router.post('/conversation/enhance', async (req: Request, res: Response) => {
  try {
    const { message, employeeId, requesterId, context } = req.body;
    const enhanced = await conversationalEnhancer.enhanceMessage(
      message,
      employeeId,
      requesterId,
      context
    );
    res.json({ enhanced });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversation/examples/:employeeId/:requesterId/:field', async (req: Request, res: Response) => {
  try {
    const { employeeId, requesterId, field } = req.params;
    const examples = await conversationalEnhancer.generateContextualExamples(
      parseInt(employeeId),
      parseInt(requesterId),
      field
    );
    res.json({ examples });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Predictive Analytics endpoints
router.get('/predictions/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const predictions = await predictiveAnalytics.predictPerformanceTrends(parseInt(employeeId));
    res.json({ predictions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/predictions/cycle/:cycleId', async (req: Request, res: Response) => {
  try {
    const { cycleId } = req.params;
    const prediction = await predictiveAnalytics.predictCycleCompletionRate(cycleId);
    res.json({ prediction });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/predictions/at-risk', async (req: Request, res: Response) => {
  try {
    const atRisk = await predictiveAnalytics.identifyAtRiskEmployees();
    res.json({ employees: atRisk });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/predictions/team-health/:managerId', async (req: Request, res: Response) => {
  try {
    const { managerId } = req.params;
    const predictions = await predictiveAnalytics.predictTeamHealth(parseInt(managerId));
    res.json({ predictions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bias Detector endpoints
router.get('/bias/analyze/:responseId', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;
    const indicators = await biasDetector.analyzeForBias(parseInt(responseId));
    res.json({ indicators });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bias/organization', async (req: Request, res: Response) => {
  try {
    const report = await biasDetector.analyzeOrganizationBias();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

