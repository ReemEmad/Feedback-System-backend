import cron from 'node-cron';
import { query, run } from '../config/database';
import notificationService from './notification-service';

class ReminderSystem {
  private isRunning: boolean = false;

  /**
   * Start the reminder system (runs daily)
   */
  start(): void {
    if (this.isRunning) {
      console.log('⏰ Reminder system is already running');
      return;
    }

    // Run every day at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Running daily reminder check...');
      await this.checkAndSendReminders();
    });

    // Also run immediately on startup
    this.checkAndSendReminders();

    this.isRunning = true;
    console.log('✅ Reminder system started');
  }

  /**
   * Check all pending requests and send appropriate reminders
   */
  async checkAndSendReminders(): Promise<void> {
    try {
      // Get all pending feedback requests
      const pendingRequests = await query(
        `SELECT 
          fr.*,
          e1.name as requester_name,
          e2.name as provider_name,
          e2.manager_id as provider_manager_id
        FROM feedback_requests fr
        JOIN employees e1 ON fr.requester_id = e1.id
        JOIN employees e2 ON fr.provider_id = e2.id
        WHERE fr.status = 'pending'`,
        []
      );

      const now = new Date();

      for (const request of pendingRequests) {
        const dueDate = new Date(request.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Send reminder 2 days before due date
        if (daysUntilDue === 2 && request.reminder_count === 0) {
          await notificationService.sendReminder(
            request.id,
            request.provider_id,
            request.requester_name,
            request.due_date
          );
        }

        // Send reminder on due date
        if (daysUntilDue === 0 && request.reminder_count === 1) {
          await notificationService.sendReminder(
            request.id,
            request.provider_id,
            request.requester_name,
            request.due_date
          );
        }

        // Mark as overdue and send escalation 2 days after due date
        if (daysUntilDue === -2) {
          // Update status to overdue
          await run('UPDATE feedback_requests SET status = ? WHERE id = ?', ['overdue', request.id]);

          // Send final reminder
          await notificationService.sendReminder(
            request.id,
            request.provider_id,
            request.requester_name,
            request.due_date
          );

          // Escalate to manager if available
          if (request.provider_manager_id) {
            await notificationService.escalateToManager(
              request.id,
              request.provider_id,
              request.provider_manager_id,
              request.requester_name
            );
          }
        }
      }

      console.log(`✅ Processed ${pendingRequests.length} pending requests`);
    } catch (error) {
      console.error('❌ Error in reminder system:', error);
    }
  }

  /**
   * Send weekly digest to employees with pending requests
   */
  async sendWeeklyDigest(): Promise<void> {
    try {
      // Get employees with pending requests
      const employeesWithPending = await query(
        `SELECT 
          e.id,
          e.name,
          e.email,
          COUNT(fr.id) as pending_count
        FROM employees e
        JOIN feedback_requests fr ON e.id = fr.provider_id
        WHERE fr.status = 'pending'
        GROUP BY e.id, e.name, e.email
        HAVING pending_count > 0`,
        []
      );

      for (const employee of employeesWithPending) {
        await notificationService.createNotification({
          employee_id: employee.id,
          type: 'weekly_digest',
          title: 'Weekly Feedback Digest',
          message: `You have ${employee.pending_count} pending feedback request(s). Please complete them soon.`,
        });
      }

      console.log(`✅ Sent weekly digest to ${employeesWithPending.length} employees`);
    } catch (error) {
      console.error('❌ Error sending weekly digest:', error);
    }
  }

  /**
   * Check for cycles ending soon and notify managers
   */
  async checkCycleDeadlines(): Promise<void> {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const endingCycles = await query(
        `SELECT * FROM feedback_cycles 
         WHERE status = 'active' 
         AND end_date <= ? 
         AND end_date >= datetime('now')`,
        [threeDaysFromNow.toISOString()]
      );

      for (const cycle of endingCycles) {
        // Get all managers
        const managers = await query('SELECT id FROM employees WHERE is_manager = 1');

        for (const manager of managers) {
          // Get pending requests for this cycle
          const pendingCount = await query(
            `SELECT COUNT(*) as count 
             FROM feedback_requests fr
             JOIN employees e ON fr.provider_id = e.id
             WHERE fr.cycle_id = ? AND fr.status = 'pending' AND e.manager_id = ?`,
            [cycle.id, manager.id]
          );

          if (pendingCount[0].count > 0) {
            await notificationService.createNotification({
              employee_id: manager.id,
              type: 'cycle_deadline',
              title: 'Feedback Cycle Ending Soon',
              message: `The "${cycle.name}" cycle ends on ${new Date(cycle.end_date).toLocaleDateString()}. Your team has ${pendingCount[0].count} pending request(s).`,
              related_id: cycle.id,
              related_type: 'feedback_cycle',
            });
          }
        }
      }

      console.log(`✅ Checked ${endingCycles.length} ending cycles`);
    } catch (error) {
      console.error('❌ Error checking cycle deadlines:', error);
    }
  }

  /**
   * Auto-close completed cycles
   */
  async autoCloseCycles(): Promise<void> {
    try {
      const now = new Date();

      // Find cycles that have ended
      const endedCycles = await query(
        `SELECT * FROM feedback_cycles 
         WHERE status = 'active' 
         AND end_date < ?`,
        [now.toISOString()]
      );

      for (const cycle of endedCycles) {
        // Check if all requests are completed
        const stats = await query(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
           FROM feedback_requests
           WHERE cycle_id = ?`,
          [cycle.id]
        );

        const completionRate = stats[0].completed / stats[0].total;

        // If 90% or more completed, or 7 days past end date, close the cycle
        const daysPastEnd = Math.ceil((now.getTime() - new Date(cycle.end_date).getTime()) / (1000 * 60 * 60 * 24));

        if (completionRate >= 0.9 || daysPastEnd >= 7) {
          await run('UPDATE feedback_cycles SET status = ? WHERE id = ?', ['completed', cycle.id]);
          console.log(`✅ Auto-closed cycle: ${cycle.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Error auto-closing cycles:', error);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerNow(): Promise<void> {
    await this.checkAndSendReminders();
  }
}

export default new ReminderSystem();

