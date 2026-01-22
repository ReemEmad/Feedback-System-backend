import { Router, Request, Response } from 'express';
import notificationService from '../services/notification-service';

const router = Router();

/**
 * Get notifications for an employee
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.query.employeeId as string);
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await notificationService.getNotifications(employeeId, limit, unreadOnly);
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get unread notification count
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.query.employeeId as string);
    const count = await notificationService.getUnreadCount(employeeId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark notification as read
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    await notificationService.markAsRead(notificationId);
    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark all notifications as read
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.body.employeeId);
    await notificationService.markAllAsRead(employeeId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

