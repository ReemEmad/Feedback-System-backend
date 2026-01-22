import { query, run } from '../config/database';

export interface CollaborationData {
  employee_id: number;
  peer_id: number;
  interaction_type: 'chat' | 'meeting' | 'task' | 'file';
  interaction_count: number;
  total_minutes: number;
}

class CollaborationTracker {
  /**
   * Record interaction between two employees
   */
  async recordInteraction(
    employeeId: number,
    peerId: number,
    type: 'chat' | 'meeting' | 'task' | 'file',
    count: number = 1,
    minutes: number = 0
  ): Promise<void> {
    const sql = `
      INSERT INTO collaborations (employee_id, peer_id, interaction_type, interaction_count, total_minutes, last_interaction)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(employee_id, peer_id, interaction_type) 
      DO UPDATE SET 
        interaction_count = interaction_count + ?,
        total_minutes = total_minutes + ?,
        last_interaction = datetime('now')
    `;

    await run(sql, [employeeId, peerId, type, count, minutes, count, minutes]);
    
    // Record reverse interaction (bidirectional)
    await run(sql, [peerId, employeeId, type, count, minutes, count, minutes]);
  }

  /**
   * Get collaboration data for an employee
   */
  async getCollaborations(employeeId: number): Promise<any[]> {
    const sql = `
      SELECT 
        c.*,
        e.name as peer_name,
        e.email as peer_email,
        e.department as peer_department,
        e.role as peer_role
      FROM collaborations c
      JOIN employees e ON c.peer_id = e.id
      WHERE c.employee_id = ?
      ORDER BY c.last_interaction DESC
    `;

    return await query(sql, [employeeId]);
  }

  /**
   * Get aggregated collaboration metrics for an employee
   */
  async getAggregatedMetrics(employeeId: number): Promise<any> {
    const sql = `
      SELECT 
        COUNT(DISTINCT peer_id) as unique_collaborators,
        SUM(interaction_count) as total_interactions,
        SUM(total_minutes) as total_meeting_minutes,
        AVG(interaction_count) as avg_interactions_per_peer
      FROM collaborations
      WHERE employee_id = ?
    `;

    return await query(sql, [employeeId]);
  }

  /**
   * Generate sample collaboration data for demo/testing
   */
  async generateSampleData(): Promise<void> {
    const employees = await query('SELECT id, department FROM employees');
    
    if (employees.length === 0) {
      throw new Error('No employees found. Please seed employees first.');
    }

    // Clear existing collaboration data
    await run('DELETE FROM collaborations');

    // Generate realistic collaboration patterns
    for (let i = 0; i < employees.length; i++) {
      for (let j = i + 1; j < employees.length; j++) {
        const emp1 = employees[i];
        const emp2 = employees[j];

        // Same department = more collaboration
        const sameDepartment = emp1.department === emp2.department;
        const baseMultiplier = sameDepartment ? 3 : 1;

        // Chat interactions
        const chatCount = Math.floor(Math.random() * 30 * baseMultiplier) + 5;
        await this.recordInteraction(emp1.id, emp2.id, 'chat', chatCount, 0);

        // Meeting minutes
        if (Math.random() > 0.3) {
          const meetingMinutes = Math.floor(Math.random() * 200 * baseMultiplier) + 30;
          await this.recordInteraction(emp1.id, emp2.id, 'meeting', 1, meetingMinutes);
        }

        // Task collaborations
        if (sameDepartment && Math.random() > 0.4) {
          const taskCount = Math.floor(Math.random() * 8) + 1;
          await this.recordInteraction(emp1.id, emp2.id, 'task', taskCount, 0);
        }

        // File sharing
        if (Math.random() > 0.5) {
          const fileCount = Math.floor(Math.random() * 10) + 1;
          await this.recordInteraction(emp1.id, emp2.id, 'file', fileCount, 0);
        }
      }
    }

    console.log(`✅ Generated sample collaboration data for ${employees.length} employees`);
  }

  /**
   * Sync collaboration data from Microsoft Teams (via Graph API)
   * This would be called by a scheduled job
   */
  async syncFromTeams(tenantId: string): Promise<void> {
    // This will be implemented with Graph API integration
    // For now, it's a placeholder
    console.log(`Syncing collaboration data from Teams for tenant: ${tenantId}`);
  }
}

export default new CollaborationTracker();

