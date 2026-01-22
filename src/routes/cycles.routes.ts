import { Router, Request, Response } from 'express';
import feedbackAssigner from '../services/feedback-assigner';
import { CreateFeedbackCycleDTO } from '../models/FeedbackCycle';

const router = Router();

/**
 * Create a new feedback cycle
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const cycleData: CreateFeedbackCycleDTO = req.body;

    // Create cycle
    const cycleId = await feedbackAssigner.createCycle(cycleData);

    // Auto-assign feedback requests if configured
    const config = cycleData.config || {};
    const peersPerEmployee = config.peers_per_employee || 2;
    const include360 = cycleData.type === '360' || config.include_manager || config.include_reports;

    let assignments: any[] = [];
    if (config.auto_assign !== false) {
      assignments = await feedbackAssigner.assignFeedbackRequests(cycleId, peersPerEmployee, include360);
    }

    res.json({
      cycleId,
      assignments,
      assignmentCount: assignments.length,
      message: 'Cycle created successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all active cycles
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const cycles = await feedbackAssigner.getActiveCycles();
    res.json(cycles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get cycle by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const cycleId = req.params.id;
    const cycle = await feedbackAssigner.getCycle(cycleId);

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    // Get cycle statistics
    const stats = await feedbackAssigner.getCycleStats(cycleId);

    res.json({
      ...cycle,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get cycle statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const cycleId = req.params.id;
    const stats = await feedbackAssigner.getCycleStats(cycleId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

