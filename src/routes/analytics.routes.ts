import { Router, Request, Response } from 'express';
import analyticsService from '../services/analytics-service';

const router = Router();

/**
 * Get overall statistics
 */
router.get('/overall', async (req: Request, res: Response) => {
  try {
    const stats = await analyticsService.getOverallStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get sentiment trends
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = req.query.endDate as string || new Date().toISOString();
    
    const trends = await analyticsService.getSentimentTrends(startDate, endDate);
    res.json(trends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get statistics by department
 */
router.get('/departments', async (req: Request, res: Response) => {
  try {
    const stats = await analyticsService.getStatsByDepartment();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get team analytics for a manager
 */
router.get('/team/:managerId', async (req: Request, res: Response) => {
  try {
    const managerId = parseInt(req.params.managerId);
    const analytics = await analyticsService.getTeamAnalytics(managerId);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employee analytics
 */
router.get('/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const analytics = await analyticsService.getEmployeeAnalytics(employeeId);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get completion rates
 */
router.get('/completion-rates', async (req: Request, res: Response) => {
  try {
    const cycleId = req.query.cycleId as string | undefined;
    const rates = await analyticsService.getCompletionRates(cycleId);
    res.json(rates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get top performers
 */
router.get('/top-performers', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const performers = await analyticsService.getTopPerformers(limit);
    res.json(performers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employees needing attention
 */
router.get('/needs-attention', async (req: Request, res: Response) => {
  try {
    const employees = await analyticsService.getEmployeesNeedingAttention();
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export feedback data
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const filters = {
      employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined,
      cycleId: req.query.cycleId as string | undefined,
    };

    const data = await analyticsService.exportFeedbackData(filters);
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
    
    // Convert to CSV (simple implementation)
    if (data.length === 0) {
      return res.send('No data to export');
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
    
    res.send(`${headers}\n${rows}`);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

