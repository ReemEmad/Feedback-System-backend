import { Router, Request, Response } from 'express';
import { query, run, get } from '../config/database';

const router = Router();

/**
 * Create a pulse survey
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, question, scale_min, scale_max, created_by } = req.body;

    const sql = `
      INSERT INTO pulse_surveys (title, question, scale_min, scale_max, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await run(sql, [
      title,
      question,
      scale_min || 1,
      scale_max || 5,
      created_by || null,
    ]);

    res.json({
      id: result.lastID,
      message: 'Pulse survey created successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all active pulse surveys
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const surveys = await query(
      "SELECT * FROM pulse_surveys WHERE status = 'active' ORDER BY created_at DESC"
    );
    res.json(surveys);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific pulse survey
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const survey = await get('SELECT * FROM pulse_surveys WHERE id = ?', [surveyId]);

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    res.json(survey);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Submit a pulse survey response
 */
router.post('/responses', async (req: Request, res: Response) => {
  try {
    const { survey_id, employee_id, rating, comment } = req.body;

    const sql = `
      INSERT INTO pulse_responses (survey_id, employee_id, rating, comment)
      VALUES (?, ?, ?, ?)
    `;

    const result = await run(sql, [survey_id, employee_id, rating, comment || null]);

    res.json({
      id: result.lastID,
      message: 'Response submitted successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pulse survey results
 */
router.get('/:id/results', async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);

    // Get aggregated results
    const aggregated = await get(
      `SELECT 
        COUNT(*) as response_count,
        AVG(rating) as avg_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM pulse_responses
      WHERE survey_id = ?`,
      [surveyId]
    );

    // Get rating distribution
    const distribution = await query(
      `SELECT 
        rating,
        COUNT(*) as count
      FROM pulse_responses
      WHERE survey_id = ?
      GROUP BY rating
      ORDER BY rating ASC`,
      [surveyId]
    );

    // Get recent comments
    const comments = await query(
      `SELECT 
        pr.comment,
        pr.submitted_at,
        e.name as employee_name
      FROM pulse_responses pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE pr.survey_id = ? AND pr.comment IS NOT NULL
      ORDER BY pr.submitted_at DESC
      LIMIT 20`,
      [surveyId]
    );

    res.json({
      aggregated,
      distribution,
      comments,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Close a pulse survey
 */
router.put('/:id/close', async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    await run("UPDATE pulse_surveys SET status = 'closed' WHERE id = ?", [surveyId]);
    res.json({ message: 'Survey closed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

