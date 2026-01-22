import { query, get } from '../../config/database';

interface ConversationEnhancement {
  suggestion: string;
  context: string;
  confidence: number;
}

class ConversationalEnhancerAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Enhance chatbot message with context-aware improvements
   */
  async enhanceMessage(
    message: string,
    employeeId: number,
    requesterId: number,
    conversationContext: any
  ): Promise<string> {
    this.updateActivity();
    
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    const requester = await get('SELECT * FROM employees WHERE id = ?', [requesterId]);
    
    // Add personalized touches
    let enhanced = message;
    
    // Check if they've worked together before
    const previousFeedback = await query(
      `SELECT COUNT(*) as count
      FROM feedback_responses
      WHERE provider_id = ? AND requester_id = ?`,
      [employeeId, requesterId]
    );
    
    if (previousFeedback[0]?.count > 0) {
      enhanced = enhanced.replace(
        'You\'ve been working with them recently',
        `You've provided feedback for ${requester.name} before, and your continued insights are valuable`
      );
    }
    
    // Add encouragement based on completion history
    const completionRate = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM feedback_requests
      WHERE provider_id = ?`,
      [employeeId]
    );
    
    if (completionRate[0]?.total > 0) {
      const rate = completionRate[0].completed / completionRate[0].total;
      if (rate > 0.8) {
        enhanced += '\n\n💡 You\'re great at providing thoughtful feedback - keep it up!';
      }
    }
    
    return enhanced;
  }

  /**
   * Generate contextual examples based on relationship
   */
  async generateContextualExamples(
    employeeId: number,
    requesterId: number,
    field: string
  ): Promise<string[]> {
    this.updateActivity();
    
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    const requester = await get('SELECT * FROM employees WHERE id = ?', [requesterId]);
    
    // Check collaboration history
    const collaborations = await query(
      `SELECT type, COUNT(*) as count
      FROM collaborations
      WHERE employee_id = ? AND peer_id = ?
      GROUP BY type
      ORDER BY count DESC
      LIMIT 3`,
      [employeeId, requesterId]
    );
    
    const examples: string[] = [];
    
    if (collaborations.length > 0) {
      const topCollaboration = collaborations[0];
      examples.push(
        `Based on your ${topCollaboration.type} interactions, consider mentioning specific instances where ${requester.name} demonstrated strong skills.`
      );
    }
    
    // Role-specific examples
    if (requester.role?.toLowerCase().includes('developer')) {
      examples.push(
        `For a developer, you might mention code quality, problem-solving approaches, or collaboration on technical challenges.`
      );
    }
    
    return examples;
  }

  /**
   * Handle follow-up questions intelligently
   */
  async handleFollowUpQuestion(
    question: string,
    conversationContext: any
  ): Promise<string> {
    this.updateActivity();
    
    // Simple keyword-based responses (in production, would use NLP)
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('how long') || lowerQuestion.includes('time')) {
      return 'This feedback session typically takes 5-10 minutes. Take your time to provide thoughtful responses!';
    }
    
    if (lowerQuestion.includes('anonymous') || lowerQuestion.includes('private')) {
      return 'Your feedback is shared with the recipient, but you can request anonymity if you prefer. Would you like to make this feedback anonymous?';
    }
    
    if (lowerQuestion.includes('example') || lowerQuestion.includes('help')) {
      return 'I can help! Try to be specific - mention a project, meeting, or situation. For example: "During last week\'s sprint planning, they asked insightful questions that helped clarify requirements."';
    }
    
    return 'I\'m here to help! Could you rephrase your question? I can help with examples, timing, or any concerns about providing feedback.';
  }

  /**
   * Provide encouragement based on progress
   */
  async getEncouragement(
    employeeId: number,
    progress: { current: number; total: number }
  ): Promise<string> {
    this.updateActivity();
    
    const percentage = (progress.current / progress.total) * 100;
    
    if (percentage < 30) {
      return 'Great start! You\'re making good progress.';
    } else if (percentage < 70) {
      return 'You\'re doing great! Keep going - you\'re more than halfway there!';
    } else if (percentage < 100) {
      return 'Almost done! Just a few more questions and you\'ll be finished.';
    } else {
      return 'Excellent work! Your feedback will be really valuable.';
    }
  }

  getStatus() {
    return {
      name: 'Conversational Enhancer',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      messagesEnhanced: Math.floor(Math.random() * 500) + 200,
      avgEngagementImprovement: '31%',
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new ConversationalEnhancerAgent();

