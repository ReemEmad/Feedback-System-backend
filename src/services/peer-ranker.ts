import { query, run } from '../config/database';

interface CollaborationMetric {
  peer_id: number;
  interaction_type: string;
  interaction_count: number;
  total_minutes: number;
  last_interaction: string;
}

interface PeerRanking {
  peer_id: number;
  collaboration_score: number;
  rank_position: number;
}

class PeerRanker {
  // Weights for different interaction types
  private readonly WEIGHTS = {
    chat: 1,
    meeting: 3,
    task: 5,
    file: 2,
  };

  /**
   * Calculate collaboration score between two employees
   */
  calculateCollaborationScore(metrics: CollaborationMetric[]): number {
    let score = 0;

    metrics.forEach((metric) => {
      const weight = this.WEIGHTS[metric.interaction_type as keyof typeof this.WEIGHTS] || 1;
      
      // Score = interaction count * weight + meeting minutes / 10
      score += metric.interaction_count * weight + metric.total_minutes / 10;
    });

    // Apply recency multiplier
    if (metrics.length > 0) {
      const mostRecentInteraction = new Date(
        Math.max(...metrics.map((m) => new Date(m.last_interaction).getTime()))
      );
      const daysSinceLastInteraction =
        (Date.now() - mostRecentInteraction.getTime()) / (1000 * 60 * 60 * 24);

      // Recency multiplier: 1.0 if recent, decays to 0.5 over 90 days
      const recencyMultiplier = Math.max(0.5, 1 - daysSinceLastInteraction / 90);
      score *= recencyMultiplier;
    }

    return score;
  }

  /**
   * Rank peers for a specific employee based on collaboration data
   */
  async rankPeers(employeeId: number): Promise<PeerRanking[]> {
    // Get all collaborations for this employee
    const sql = `
      SELECT 
        peer_id,
        interaction_type,
        SUM(interaction_count) as interaction_count,
        SUM(total_minutes) as total_minutes,
        MAX(last_interaction) as last_interaction
      FROM collaborations
      WHERE employee_id = ?
      GROUP BY peer_id, interaction_type
    `;

    const collaborations = await query(sql, [employeeId]);

    // Group by peer
    const peerMetrics: { [peerId: number]: CollaborationMetric[] } = {};
    collaborations.forEach((collab: CollaborationMetric) => {
      if (!peerMetrics[collab.peer_id]) {
        peerMetrics[collab.peer_id] = [];
      }
      peerMetrics[collab.peer_id].push(collab);
    });

    // Calculate scores and rank
    const rankings: PeerRanking[] = [];
    for (const [peerId, metrics] of Object.entries(peerMetrics)) {
      const score = this.calculateCollaborationScore(metrics);
      rankings.push({
        peer_id: parseInt(peerId),
        collaboration_score: score,
        rank_position: 0, // Will be set after sorting
      });
    }

    // Sort by score (highest first)
    rankings.sort((a, b) => b.collaboration_score - a.collaboration_score);

    // Assign rank positions
    rankings.forEach((ranking, index) => {
      ranking.rank_position = index + 1;
    });

    // Save rankings to database
    await this.saveRankings(employeeId, rankings);

    return rankings;
  }

  /**
   * Save peer rankings to database
   */
  private async saveRankings(employeeId: number, rankings: PeerRanking[]): Promise<void> {
    // Delete existing rankings for this employee
    await run('DELETE FROM peer_rankings WHERE employee_id = ?', [employeeId]);

    // Insert new rankings
    for (const ranking of rankings) {
      const sql = `
        INSERT INTO peer_rankings (employee_id, peer_id, collaboration_score, rank_position, calculated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      await run(sql, [
        employeeId,
        ranking.peer_id,
        ranking.collaboration_score,
        ranking.rank_position,
      ]);
    }
  }

  /**
   * Get ranked peers for an employee
   */
  async getRankedPeers(employeeId: number, limit: number = 10): Promise<any[]> {
    const sql = `
      SELECT 
        pr.*,
        e.name as peer_name,
        e.email as peer_email,
        e.department as peer_department,
        e.role as peer_role
      FROM peer_rankings pr
      JOIN employees e ON pr.peer_id = e.id
      WHERE pr.employee_id = ?
      ORDER BY pr.rank_position ASC
      LIMIT ?
    `;

    return await query(sql, [employeeId, limit]);
  }

  /**
   * Rank peers for all employees
   */
  async rankAllPeers(): Promise<void> {
    const employees = await query('SELECT id FROM employees');
    
    console.log(`🔄 Ranking peers for ${employees.length} employees...`);
    
    for (const employee of employees) {
      await this.rankPeers(employee.id);
    }
    
    console.log('✅ Peer ranking completed for all employees');
  }

  /**
   * Get collaboration network statistics
   */
  async getNetworkStats(): Promise<any> {
    const sql = `
      SELECT 
        COUNT(DISTINCT employee_id) as total_employees,
        COUNT(DISTINCT peer_id) as total_peers,
        AVG(collaboration_score) as avg_collaboration_score,
        MAX(collaboration_score) as max_collaboration_score,
        MIN(collaboration_score) as min_collaboration_score
      FROM peer_rankings
    `;

    return await query(sql);
  }
}

export default new PeerRanker();

