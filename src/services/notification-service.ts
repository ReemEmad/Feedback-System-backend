import { query, run } from '../config/database';

interface NotificationData {
  employee_id: number;
  type: string;
  title: string;
  message: string;
  related_id?: number;
  related_type?: string;
}

class NotificationService {
  /**
   * Create a notification
   */
  async createNotification(data: NotificationData): Promise<number> {
    const sql = `
      INSERT INTO notifications (employee_id, type, title, message, related_id, related_type, sent_via)
      VALUES (?, ?, ?, ?, ?, ?, 'in-app')
    `;

    const result = await run(sql, [
      data.employee_id,
      data.type,
      data.title,
      data.message,
      data.related_id || null,
      data.related_type || null,
    ]);

    return result.lastID;
  }

  /**
   * Send feedback request notification
   */
  async notifyFeedbackRequest(requestId: number, providerId: number, requesterName: string): Promise<void> {
    await this.createNotification({
      employee_id: providerId,
      type: 'feedback_request',
      title: 'New Feedback Request',
      message: `${requesterName} has requested your feedback. Please provide your input by the due date.`,
      related_id: requestId,
      related_type: 'feedback_request',
    });

    console.log(`📧 Notification sent to employee ${providerId} for feedback request ${requestId}`);
  }

  /**
   * Send feedback received notification
   */
  async notifyFeedbackReceived(responseId: number, requesterId: number, providerName: string): Promise<void> {
    await this.createNotification({
      employee_id: requesterId,
      type: 'feedback_received',
      title: 'New Feedback Received',
      message: `${providerName} has provided feedback for you. View it in your dashboard.`,
      related_id: responseId,
      related_type: 'feedback_response',
    });

    console.log(`📧 Notification sent to employee ${requesterId} for feedback received`);
  }

  /**
   * Send reminder notification
   */
  async sendReminder(requestId: number, providerId: number, requesterName: string, dueDate: string): Promise<void> {
    const daysUntilDue = Math.ceil(
      (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let message = '';
    if (daysUntilDue > 0) {
      message = `Reminder: Feedback for ${requesterName} is due in ${daysUntilDue} day(s). Please complete it soon.`;
    } else if (daysUntilDue === 0) {
      message = `Urgent: Feedback for ${requesterName} is due today! Please complete it as soon as possible.`;
    } else {
      message = `Overdue: Feedback for ${requesterName} was due ${Math.abs(daysUntilDue)} day(s) ago. Please complete it immediately.`;
    }

    await this.createNotification({
      employee_id: providerId,
      type: 'feedback_reminder',
      title: 'Feedback Reminder',
      message: message,
      related_id: requestId,
      related_type: 'feedback_request',
    });

    // Update reminder count
    await run(
      `UPDATE feedback_requests 
       SET reminder_count = reminder_count + 1, last_reminder_at = datetime('now')
       WHERE id = ?`,
      [requestId]
    );

    console.log(`⏰ Reminder sent to employee ${providerId} for request ${requestId}`);
  }

  /**
   * Send escalation notification to manager
   */
  async escalateToManager(requestId: number, providerId: number, managerId: number, requesterName: string): Promise<void> {
    const provider = await query('SELECT name FROM employees WHERE id = ?', [providerId]);
    const providerName = provider[0]?.name || 'Employee';

    await this.createNotification({
      employee_id: managerId,
      type: 'feedback_escalation',
      title: 'Overdue Feedback Alert',
      message: `${providerName} has not completed feedback for ${requesterName}. Please follow up.`,
      related_id: requestId,
      related_type: 'feedback_request',
    });

    console.log(`⚠️ Escalation sent to manager ${managerId} for request ${requestId}`);
  }

  /**
   * Send action assigned notification
   */
  async notifyActionAssigned(actionId: number, employeeId: number, assignedByName: string, actionTitle: string): Promise<void> {
    await this.createNotification({
      employee_id: employeeId,
      type: 'action_assigned',
      title: 'New Action Item',
      message: `${assignedByName} has assigned you an action: "${actionTitle}"`,
      related_id: actionId,
      related_type: 'action',
    });

    console.log(`✅ Action notification sent to employee ${employeeId}`);
  }

  /**
   * Get notifications for an employee
   */
  async getNotifications(employeeId: number, limit: number = 20, unreadOnly: boolean = false): Promise<any[]> {
    let sql = `
      SELECT * FROM notifications
      WHERE employee_id = ?
    `;

    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY sent_at DESC LIMIT ?';

    return await query(sql, [employeeId, limit]);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number): Promise<void> {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
  }

  /**
   * Mark all notifications as read for an employee
   */
  async markAllAsRead(employeeId: number): Promise<void> {
    await run('UPDATE notifications SET is_read = 1 WHERE employee_id = ? AND is_read = 0', [
      employeeId,
    ]);
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(employeeId: number): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE employee_id = ? AND is_read = 0',
      [employeeId]
    );
    return result[0]?.count || 0;
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(daysOld: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await run(
      "DELETE FROM notifications WHERE sent_at < ? AND is_read = 1",
      [cutoffDate.toISOString()]
    );

    console.log(`🧹 Deleted notifications older than ${daysOld} days`);
  }
}

export default new NotificationService();

