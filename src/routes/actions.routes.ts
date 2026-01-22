import { Router, Request, Response } from 'express';
import { query, run, get } from '../config/database';
import notificationService from '../services/notification-service';

const router = Router();

/**
 * Create an action item
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { response_id, employee_id, assigned_by, action_type, title, description, due_date } = req.body;

    const sql = `
      INSERT INTO actions (response_id, employee_id, assigned_by, action_type, title, description, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await run(sql, [
      response_id || null,
      employee_id,
      assigned_by,
      action_type || 'development',
      title,
      description || null,
      due_date || null,
    ]);

    // Get assigner name
    const assigner = await get('SELECT name FROM employees WHERE id = ?', [assigned_by]);
    
    // Send notification
    await notificationService.notifyActionAssigned(
      result.lastID,
      employee_id,
      assigner?.name || 'Manager',
      title
    );

    res.json({
      id: result.lastID,
      message: 'Action created successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get actions for an employee
 */
router.get('/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const status = req.query.status as string | undefined;

    let sql = `
      SELECT 
        a.*,
        e.name as assigned_by_name
      FROM actions a
      JOIN employees e ON a.assigned_by = e.id
      WHERE a.employee_id = ?
    `;

    const params: any[] = [employeeId];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.created_at DESC';

    const actions = await query(sql, params);
    res.json(actions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get actions assigned by a manager
 */
router.get('/assigned-by/:managerId', async (req: Request, res: Response) => {
  try {
    const managerId = parseInt(req.params.managerId);

    const sql = `
      SELECT 
        a.*,
        e.name as employee_name,
        e.email as employee_email
      FROM actions a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.assigned_by = ?
      ORDER BY a.created_at DESC
    `;

    const actions = await query(sql, [managerId]);
    res.json(actions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update action status
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const actionId = parseInt(req.params.id);
    const { status } = req.body;

    let sql = 'UPDATE actions SET status = ?';
    const params: any[] = [status];

    if (status === 'completed') {
      sql += ', completed_at = datetime("now")';
    }

    sql += ' WHERE id = ?';
    params.push(actionId);

    await run(sql, params);

    res.json({ message: 'Action status updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete an action
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const actionId = parseInt(req.params.id);
    await run('DELETE FROM actions WHERE id = ?', [actionId]);
    res.json({ message: 'Action deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

