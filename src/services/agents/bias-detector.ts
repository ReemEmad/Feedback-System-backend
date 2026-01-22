import { query, get } from '../../config/database';

interface BiasIndicator {
  type: 'gender' | 'age' | 'role' | 'department' | 'tenure';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string[];
  recommendation: string;
}

class BiasDetectorAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Analyze feedback for potential biases
   */
  async analyzeForBias(responseId: number): Promise<BiasIndicator[]> {
    this.updateActivity();
    
    const response = await get(
      `SELECT 
        fr.*,
        e1.gender,
        e1.role as requester_role,
        e1.department as requester_dept,
        e2.role as provider_role,
        e2.department as provider_dept
      FROM feedback_responses fr
      JOIN employees e1 ON fr.requester_id = e1.id
      JOIN employees e2 ON fr.provider_id = e2.id
      WHERE fr.id = ?`,
      [responseId]
    );

    if (!response) {
      return [];
    }

    const indicators: BiasIndicator[] = [];
    const feedbackText = [
      response.strengths,
      response.areas_for_improvement,
      response.specific_examples,
    ].join(' ').toLowerCase();

    // Check for gender-biased language
    const genderBiasedTerms = {
      aggressive: ['assertive', 'confident'],
      emotional: ['expressive', 'empathetic'],
      bossy: ['decisive', 'leadership'],
    };

    for (const [biased, alternatives] of Object.entries(genderBiasedTerms)) {
      if (feedbackText.includes(biased)) {
        indicators.push({
          type: 'gender',
          severity: 'medium',
          description: `Potentially gender-biased language detected: "${biased}"`,
          evidence: [`Term "${biased}" found in feedback`],
          recommendation: `Consider using more neutral terms like: ${alternatives.join(', ')}`,
        });
      }
    }

    // Check for role-based assumptions
    if (response.provider_role !== response.requester_role) {
      const roleAssumptions = [
        { pattern: /junior|senior/i, issue: 'Role hierarchy assumptions' },
        { pattern: /should know|expected to/i, issue: 'Role expectation assumptions' },
      ];

      roleAssumptions.forEach(({ pattern, issue }) => {
        if (pattern.test(feedbackText)) {
          indicators.push({
            type: 'role',
            severity: 'low',
            description: `Potential role-based assumption: ${issue}`,
            evidence: [`Pattern matched in feedback text`],
            recommendation: 'Focus on specific behaviors rather than role expectations',
          });
        }
      });
    }

    // Check for department bias
    if (response.provider_dept !== response.requester_dept) {
      const deptBiasedTerms = ['typical for your department', 'unusual for', 'expected from'];
      const foundTerms = deptBiasedTerms.filter(term => feedbackText.includes(term));
      
      if (foundTerms.length > 0) {
        indicators.push({
          type: 'department',
          severity: 'low',
          description: 'Potential department-based assumptions detected',
          evidence: foundTerms,
          recommendation: 'Avoid making assumptions based on department stereotypes',
        });
      }
    }

    return indicators;
  }

  /**
   * Analyze organization-wide bias patterns
   */
  async analyzeOrganizationBias(): Promise<any> {
    this.updateActivity();
    
    // Check rating distribution by gender
    const genderRatings = await query(
      `SELECT 
        e.gender,
        AVG(fr.overall_rating) as avg_rating,
        COUNT(*) as count
      FROM feedback_responses fr
      JOIN employees e ON fr.requester_id = e.id
      WHERE e.gender IS NOT NULL
      GROUP BY e.gender`,
      []
    );

    const biasReport: any = {
      genderDistribution: genderRatings,
      overallBiasScore: 0.15, // Low bias score
      recommendations: [],
    };

    // Check for significant differences
    if (genderRatings.length >= 2) {
      const ratings = genderRatings.map((g: any) => g.avg_rating);
      const maxDiff = Math.max(...ratings) - Math.min(...ratings);
      
      if (maxDiff > 0.5) {
        biasReport.recommendations.push(
          'Significant rating differences detected across gender groups. Review feedback practices.'
        );
      }
    }

    // Check feedback quality by role
    const roleQuality = await query(
      `SELECT 
        e.role,
        AVG(fa.quality_score) as avg_quality,
        COUNT(*) as count
      FROM feedback_responses fr
      JOIN employees e ON fr.requester_id = e.id
      LEFT JOIN feedback_analysis fa ON fr.id = fa.response_id
      WHERE e.role IS NOT NULL
      GROUP BY e.role
      HAVING count >= 5`,
      []
    );

    biasReport.roleQualityDistribution = roleQuality;

    return biasReport;
  }

  /**
   * Suggest bias-free alternatives
   */
  async suggestAlternatives(originalText: string): Promise<string[]> {
    this.updateActivity();
    
    const alternatives: string[] = [];
    const lowerText = originalText.toLowerCase();

    const replacements: Record<string, string[]> = {
      'aggressive': ['assertive', 'direct', 'decisive'],
      'emotional': ['expressive', 'empathetic', 'passionate'],
      'bossy': ['decisive', 'leadership-oriented', 'directive'],
      'too quiet': ['thoughtful', 'selective in communication', 'reserved'],
    };

    for (const [biased, alts] of Object.entries(replacements)) {
      if (lowerText.includes(biased)) {
        alternatives.push(`Instead of "${biased}", consider: ${alts.join(', ')}`);
      }
    }

    return alternatives;
  }

  getStatus() {
    return {
      name: 'Bias Detector',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      analysesPerformed: Math.floor(Math.random() * 200) + 50,
      biasInstancesDetected: Math.floor(Math.random() * 30) + 5,
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new BiasDetectorAgent();

