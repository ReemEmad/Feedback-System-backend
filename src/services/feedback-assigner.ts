import { query, run, get } from '../config/database';
import peerRanker from './peer-ranker';
import { CreateFeedbackCycleDTO } from '../models/FeedbackCycle';
import { CreateFeedbackRequestDTO } from '../models/FeedbackRequest';

class FeedbackAssigner {
  /**
   * Create a new feedback cycle
   */
  async createCycle(cycleData: CreateFeedbackCycleDTO): Promise<string> {
    const cycleId = `cycle_${Date.now()}`;
    
    const sql = `
      INSERT INTO feedback_cycles (id, name, type, start_date, end_date, status, config, created_by)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `;

    await run(sql, [
      cycleId,
      cycleData.name,
      cycleData.type || 'peer',
      cycleData.start_date,
      cycleData.end_date,
      JSON.stringify(cycleData.config || {}),
      cycleData.created_by || null,
    ]);

    return cycleId;
  }

  /**
   * Automatically assign feedback requests based on peer rankings
   */
  async assignFeedbackRequests(
    cycleId: string,
    peersPerEmployee: number = 2,
    include360: boolean = false
  ): Promise<any[]> {
    // First, ensure all peer rankings are up to date
    await peerRanker.rankAllPeers();

    const cycle = await this.getCycle(cycleId);
    if (!cycle) {
      throw new Error('Cycle not found');
    }

    const employees = await query('SELECT * FROM employees');
    const assignments: any[] = [];

    for (const employee of employees) {
      // Get top ranked peers (excluding self)
      const rankedPeers = await peerRanker.getRankedPeers(employee.id, peersPerEmployee + 10);

      // Filter out peers who already provided feedback recently
      const availablePeers = await this.filterRecentFeedback(rankedPeers, employee.id);

      // Select top N peers
      const selectedPeers = availablePeers.slice(0, peersPerEmployee);

      // Create peer feedback requests
      for (const peer of selectedPeers) {
        const exists = await this.checkExistingAssignment(employee.id, peer.peer_id, cycleId);

        if (!exists) {
          const assignment = await this.createFeedbackRequest({
            requester_id: employee.id,
            provider_id: peer.peer_id,
            cycle_id: cycleId,
            request_type: 'peer',
            due_date: cycle.end_date,
          });
          assignments.push(assignment);
        }
      }

      // If 360-degree feedback, add manager and direct reports
      if (include360) {
        // Add manager feedback
        if (employee.manager_id) {
          const managerExists = await this.checkExistingAssignment(
            employee.id,
            employee.manager_id,
            cycleId
          );
          if (!managerExists) {
            const managerAssignment = await this.createFeedbackRequest({
              requester_id: employee.id,
              provider_id: employee.manager_id,
              cycle_id: cycleId,
              request_type: 'manager',
              due_date: cycle.end_date,
            });
            assignments.push(managerAssignment);
          }
        }

        // Add upward feedback (from direct reports)
        if (employee.is_manager) {
          const reports = await query('SELECT id FROM employees WHERE manager_id = ?', [
            employee.id,
          ]);
          for (const report of reports) {
            const reportExists = await this.checkExistingAssignment(
              employee.id,
              report.id,
              cycleId
            );
            if (!reportExists) {
              const reportAssignment = await this.createFeedbackRequest({
                requester_id: employee.id,
                provider_id: report.id,
                cycle_id: cycleId,
                request_type: 'upward',
                due_date: cycle.end_date,
              });
              assignments.push(reportAssignment);
            }
          }
        }
      }
    }

    console.log(`✅ Created ${assignments.length} feedback requests for cycle ${cycleId}`);
    return assignments;
  }

  /**
   * Create a single feedback request
   */
  async createFeedbackRequest(requestData: CreateFeedbackRequestDTO): Promise<any> {
    const sql = `
      INSERT INTO feedback_requests (requester_id, provider_id, cycle_id, request_type, due_date, assigned_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;

    const result = await run(sql, [
      requestData.requester_id,
      requestData.provider_id,
      requestData.cycle_id,
      requestData.request_type || 'peer',
      requestData.due_date,
    ]);

    return {
      id: result.lastID,
      ...requestData,
    };
  }

  /**
   * Filter out peers who provided feedback recently
   */
  private async filterRecentFeedback(peers: any[], requesterId: number): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentProviders = await query(
      `SELECT DISTINCT provider_id 
       FROM feedback_responses 
       WHERE requester_id = ? AND submitted_at > ?`,
      [requesterId, thirtyDaysAgo.toISOString()]
    );

    const recentProviderIds = new Set(recentProviders.map((r: any) => r.provider_id));
    return peers.filter((peer) => !recentProviderIds.has(peer.peer_id));
  }

  /**
   * Check if assignment already exists
   */
  private async checkExistingAssignment(
    requesterId: number,
    providerId: number,
    cycleId: string
  ): Promise<boolean> {
    const result = await get(
      `SELECT id FROM feedback_requests 
       WHERE requester_id = ? AND provider_id = ? AND cycle_id = ?`,
      [requesterId, providerId, cycleId]
    );
    return !!result;
  }

  /**
   * Get cycle by ID
   */
  async getCycle(cycleId: string): Promise<any> {
    const cycle = await get('SELECT * FROM feedback_cycles WHERE id = ?', [cycleId]);
    if (cycle && cycle.config) {
      cycle.config = JSON.parse(cycle.config);
    }
    return cycle;
  }

  /**
   * Get all active cycles
   */
  async getActiveCycles(): Promise<any[]> {
    const cycles = await query(
      "SELECT * FROM feedback_cycles WHERE status = 'active' ORDER BY created_at DESC"
    );
    return cycles.map((cycle: any) => ({
      ...cycle,
      config: cycle.config ? JSON.parse(cycle.config) : {},
    }));
  }

  /**
   * Get details for a specific feedback request
   */
  async getRequestDetails(requestId: number): Promise<any> {
    const sql = `
      SELECT 
        fr.*,
        e.name as requester_name,
        e.email as requester_email,
        e.department as requester_department,
        e.role as requester_role,
        fc.name as cycle_name,
        fc.type as cycle_type
      FROM feedback_requests fr
      JOIN employees e ON fr.requester_id = e.id
      JOIN feedback_cycles fc ON fr.cycle_id = fc.id
      WHERE fr.id = ?
    `;

    return await get(sql, [requestId]);
  }

  /**
   * Get pending feedback requests for an employee
   */
  async getPendingRequests(employeeId: number): Promise<any[]> {
    const sql = `
      SELECT 
        fr.*,
        e.name as requester_name,
        e.email as requester_email,
        e.department as requester_department,
        e.role as requester_role,
        fc.name as cycle_name,
        fc.type as cycle_type
      FROM feedback_requests fr
      JOIN employees e ON fr.requester_id = e.id
      JOIN feedback_cycles fc ON fr.cycle_id = fc.id
      WHERE fr.provider_id = ? AND fr.status = 'pending'
      ORDER BY fr.due_date ASC
    `;

    return await query(sql, [employeeId]);
  }

  /**
   * Get feedback requests for a requester (to see who they're waiting on)
   */
  async getRequestsForRequester(requesterId: number, cycleId?: string): Promise<any[]> {
    let sql = `
      SELECT 
        fr.*,
        e.name as provider_name,
        e.email as provider_email,
        e.department as provider_department
      FROM feedback_requests fr
      JOIN employees e ON fr.provider_id = e.id
      WHERE fr.requester_id = ?
    `;

    const params: any[] = [requesterId];

    if (cycleId) {
      sql += ' AND fr.cycle_id = ?';
      params.push(cycleId);
    }

    sql += ' ORDER BY fr.due_date ASC';

    return await query(sql, params);
  }

  /**
   * Update request status
   */
  async updateRequestStatus(requestId: number, status: string): Promise<void> {
    const sql = `
      UPDATE feedback_requests 
      SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END
      WHERE id = ?
    `;
    await run(sql, [status, status, requestId]);
  }

  /**
   * Get cycle statistics
   */
  async getCycleStats(cycleId: string): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        ROUND(CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 2) as completion_rate
      FROM feedback_requests
      WHERE cycle_id = ?
    `;

    return await get(sql, [cycleId]);
  }
}

export default new FeedbackAssigner();

