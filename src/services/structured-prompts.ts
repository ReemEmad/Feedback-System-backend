import { FeedbackValidation, CreateFeedbackResponseDTO } from '../models/FeedbackResponse';

interface FeedbackPrompt {
  title: string;
  instructions: string;
  sections: FeedbackSection[];
  tips: string[];
}

interface FeedbackSection {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  required: boolean;
  type?: 'text' | 'rating';
  scale?: { min: number; max: number; labels: string[] };
}

class StructuredPrompts {
  /**
   * Get role-specific feedback questions based on provider and requester roles
   */
  getRoleBasedQuestions(
    providerRole: string,
    requesterRole: string,
    providerDepartment: string,
    requesterDepartment: string
  ): FeedbackSection[] {
    const normalizedProviderRole = this.normalizeRole(providerRole);
    const normalizedRequesterRole = this.normalizeRole(requesterRole);
    const sameDepartment = providerDepartment === requesterDepartment;

    // Base questions (always included)
    const questions: FeedbackSection[] = [
      {
        id: 'strengths',
        title: this.getStrengthsTitle(normalizedRequesterRole),
        description: this.getStrengthsDescription(normalizedProviderRole, normalizedRequesterRole, sameDepartment),
        placeholder: this.getStrengthsPlaceholder(normalizedRequesterRole),
        required: true,
        type: 'text',
      },
      {
        id: 'areas_for_improvement',
        title: 'Areas for Growth & Development',
        description: this.getImprovementDescription(normalizedProviderRole, normalizedRequesterRole),
        placeholder: this.getImprovementPlaceholder(normalizedRequesterRole),
        required: true,
        type: 'text',
      },
    ];

    // Add role-specific questions
    const specificQuestions = this.getSpecificQuestions(
      normalizedProviderRole,
      normalizedRequesterRole,
      sameDepartment
    );
    questions.push(...specificQuestions);

    // Add examples and suggestions
    questions.push(
      {
        id: 'specific_examples',
        title: 'Specific Examples & Situations',
        description: this.getExamplesDescription(normalizedProviderRole, normalizedRequesterRole),
        placeholder: this.getExamplesPlaceholder(normalizedRequesterRole),
        required: true,
        type: 'text',
      },
      {
        id: 'actionable_suggestions',
        title: 'Actionable Recommendations',
        description: 'Provide specific, practical steps they can take to improve or grow',
        placeholder: this.getSuggestionsPlaceholder(normalizedRequesterRole),
        required: true,
        type: 'text',
      }
    );

    return questions;
  }

  private normalizeRole(role: string): string {
    const lower = role.toLowerCase();
    if (lower.includes('developer') || lower.includes('engineer') && !lower.includes('qa')) return 'developer';
    if (lower.includes('qa') || lower.includes('quality')) return 'qa';
    if (lower.includes('designer') || lower.includes('ux') || lower.includes('ui')) return 'designer';
    if (lower.includes('product') && lower.includes('owner')) return 'product_owner';
    if (lower.includes('product') && lower.includes('manager')) return 'product_manager';
    if (lower.includes('manager') || lower.includes('lead')) return 'manager';
    if (lower.includes('marketing')) return 'marketing';
    if (lower.includes('sales')) return 'sales';
    if (lower.includes('writer') || lower.includes('content')) return 'content';
    return 'general';
  }

  private getStrengthsTitle(requesterRole: string): string {
    const titles: Record<string, string> = {
      developer: 'Technical Strengths & Code Quality',
      qa: 'Quality Assurance Excellence',
      designer: 'Design & User Experience Strengths',
      product_owner: 'Product Vision & Prioritization Strengths',
      product_manager: 'Product Strategy & Execution',
      manager: 'Leadership & Management Strengths',
      marketing: 'Marketing Impact & Creativity',
      sales: 'Sales Performance & Client Relations',
      content: 'Content Quality & Engagement',
    };
    return titles[requesterRole] || 'Key Strengths & Contributions';
  }

  private getStrengthsDescription(provider: string, requester: string, sameDept: boolean): string {
    if (provider === 'developer' && requester === 'designer') {
      return 'From a development perspective, what design strengths help with implementation?';
    }
    if (provider === 'designer' && requester === 'developer') {
      return 'How well does this developer understand and implement your design vision?';
    }
    if (provider === 'product_owner' && requester === 'developer') {
      return 'How effectively does this developer deliver on product requirements?';
    }
    if (provider === 'qa' && requester === 'developer') {
      return 'What technical practices contribute to code quality and testability?';
    }
    if (sameDept) {
      return 'Identify specific strengths relevant to your shared work and collaboration';
    }
    return 'Identify specific strengths you\'ve observed in your interactions';
  }

  private getStrengthsPlaceholder(requesterRole: string): string {
    const placeholders: Record<string, string> = {
      developer: 'Example: "Writes clean, well-documented code. The authentication module they built had excellent error handling and saved us debugging time..."',
      qa: 'Example: "Creates comprehensive test plans that catch edge cases. Their testing of the payment flow identified a critical bug before production..."',
      designer: 'Example: "Creates intuitive user flows that consider technical constraints. Their redesign of the dashboard reduced user complaints by 40%..."',
      product_owner: 'Example: "Excellent at prioritizing features based on user impact. Their roadmap for Q4 balanced business needs with technical feasibility..."',
      manager: 'Example: "Provides clear direction and removes blockers quickly. During the recent project crisis, they reorganized resources effectively..."',
    };
    return placeholders[requesterRole] || 'Example: "Consistently delivers high-quality work and collaborates effectively with the team..."';
  }

  private getImprovementDescription(provider: string, requester: string): string {
    if (provider === 'developer' && requester === 'designer') {
      return 'What design practices could better support development implementation?';
    }
    if (provider === 'designer' && requester === 'developer') {
      return 'How could this developer better collaborate on design implementation?';
    }
    if (provider === 'product_owner' && requester === 'qa') {
      return 'How could requirements be clearer to support better test coverage?';
    }
    return 'Focus on specific behaviors and skills that can be developed, framed constructively';
  }

  private getImprovementPlaceholder(requesterRole: string): string {
    const placeholders: Record<string, string> = {
      developer: 'Example: "Could improve code review comments by explaining the \'why\' behind suggestions. This would help junior developers learn patterns..."',
      qa: 'Example: "Test documentation could include more context about edge cases. This would help developers understand testing priorities..."',
      designer: 'Example: "Could involve developers earlier in the design process to discuss technical constraints and feasibility..."',
      product_owner: 'Example: "User stories could benefit from more acceptance criteria. This would reduce back-and-forth during development..."',
    };
    return placeholders[requesterRole] || 'Example: "Could improve by... This would help by..."';
  }

  private getSpecificQuestions(provider: string, requester: string, sameDept: boolean): FeedbackSection[] {
    const questions: FeedbackSection[] = [];

    // Developer receiving feedback
    if (requester === 'developer') {
      if (provider === 'developer' || provider === 'manager') {
        questions.push({
          id: 'technical_quality',
          title: 'Code Quality & Technical Skills',
          description: 'Comment on code quality, architecture decisions, and technical problem-solving',
          placeholder: 'Example: "Code is well-structured and follows team conventions. Could explore more design patterns for complex logic..."',
          required: false,
          type: 'text',
        });
      }
      if (provider === 'designer') {
        questions.push({
          id: 'design_implementation',
          title: 'Design Implementation Quality',
          description: 'How well do they translate designs into functional code? Do they understand design intent?',
          placeholder: 'Example: "Implements designs accurately and asks clarifying questions when needed. Suggests improvements when technical constraints exist..."',
          required: false,
          type: 'text',
        });
      }
      if (provider === 'product_owner' || provider === 'product_manager') {
        questions.push({
          id: 'requirement_understanding',
          title: 'Requirements Understanding & Delivery',
          description: 'How well do they understand and deliver on product requirements?',
          placeholder: 'Example: "Asks insightful questions during planning that improve feature clarity. Delivers working software that meets acceptance criteria..."',
          required: false,
          type: 'text',
        });
      }
      if (provider === 'qa') {
        questions.push({
          id: 'quality_collaboration',
          title: 'Quality & Testability',
          description: 'How do they support quality assurance and write testable code?',
          placeholder: 'Example: "Writes unit tests and considers edge cases. Responsive to bug reports and fixes issues thoroughly..."',
          required: false,
          type: 'text',
        });
      }
    }

    // QA receiving feedback
    if (requester === 'qa') {
      questions.push({
        id: 'testing_effectiveness',
        title: 'Testing Strategy & Coverage',
        description: 'Comment on test coverage, bug identification, and testing approach',
        placeholder: 'Example: "Creates thorough test plans that catch issues early. Bug reports are detailed with clear reproduction steps..."',
        required: false,
        type: 'text',
      });
      if (provider === 'product_owner' || provider === 'product_manager') {
        questions.push({
          id: 'quality_advocacy',
          title: 'Quality Advocacy & User Focus',
          description: 'How well do they advocate for quality and consider user experience in testing?',
          placeholder: 'Example: "Balances thoroughness with delivery timelines. Flags UX issues that might impact user satisfaction..."',
          required: false,
          type: 'text',
        });
      }
    }

    // Designer receiving feedback
    if (requester === 'designer') {
      if (provider === 'developer') {
        questions.push({
          id: 'design_feasibility',
          title: 'Design Clarity & Feasibility',
          description: 'Are designs clear, complete, and technically feasible? Do they consider development constraints?',
          placeholder: 'Example: "Designs are detailed with clear specifications. Open to discussing technical trade-offs and alternative approaches..."',
          required: false,
          type: 'text',
        });
      }
      if (provider === 'product_owner' || provider === 'product_manager') {
        questions.push({
          id: 'user_focus',
          title: 'User-Centered Design & Business Impact',
          description: 'How well do designs solve user problems and support business goals?',
          placeholder: 'Example: "Conducts user research before designing. Designs balance user needs with business constraints..."',
          required: false,
          type: 'text',
        });
      }
    }

    // Product Owner/Manager receiving feedback
    if (requester === 'product_owner' || requester === 'product_manager') {
      questions.push({
        id: 'requirement_clarity',
        title: 'Requirement Clarity & Prioritization',
        description: 'How clear are requirements? How well do they prioritize and manage scope?',
        placeholder: 'Example: "Requirements are well-defined with clear success criteria. Makes tough prioritization calls based on data..."',
        required: false,
        type: 'text',
      });
      if (provider === 'developer' || provider === 'designer' || provider === 'qa') {
        questions.push({
          id: 'stakeholder_communication',
          title: 'Communication & Collaboration',
          description: 'How effectively do they communicate with the team and manage expectations?',
          placeholder: 'Example: "Available for questions and provides context quickly. Shields the team from unnecessary distractions..."',
          required: false,
          type: 'text',
        });
      }
    }

    // Manager receiving feedback
    if (requester === 'manager') {
      questions.push({
        id: 'leadership_support',
        title: 'Leadership & Team Support',
        description: 'How effectively do they lead, support, and develop the team?',
        placeholder: 'Example: "Provides clear direction and removes blockers. Makes time for 1-on-1s and career development discussions..."',
        required: false,
        type: 'text',
      });
      questions.push({
        id: 'decision_making',
        title: 'Decision Making & Communication',
        description: 'How well do they make decisions and communicate with the team?',
        placeholder: 'Example: "Makes decisions with available information and explains reasoning. Welcomes input before deciding..."',
        required: false,
        type: 'text',
      });
    }

    return questions;
  }

  private getExamplesDescription(provider: string, requester: string): string {
    if (provider === 'developer' && requester === 'designer') {
      return 'Provide specific examples from projects where you worked with their designs';
    }
    if (provider === 'product_owner') {
      return 'Provide concrete examples from sprints, features, or projects you\'ve worked on together';
    }
    return 'Provide concrete examples or situations that illustrate your feedback';
  }

  private getExamplesPlaceholder(requesterRole: string): string {
    return 'Example: "During the Q4 dashboard project, when we faced the performance issue, they..."';
  }

  private getSuggestionsPlaceholder(requesterRole: string): string {
    const placeholders: Record<string, string> = {
      developer: 'Example: "Consider pair programming with junior devs once a week. Attend the architecture workshop next month..."',
      designer: 'Example: "Schedule a monthly design-dev sync to discuss upcoming features. Share work-in-progress designs earlier..."',
      qa: 'Example: "Create a testing checklist for common scenarios. Document known edge cases in the wiki..."',
      product_owner: 'Example: "Hold a quick mid-sprint check-in to catch issues early. Include technical feasibility notes in user stories..."',
    };
    return placeholders[requesterRole] || 'Example: "Consider... This would help by..."';
  }

  /**
   * Get structured feedback prompt for a specific request type
   */
  getFeedbackPrompt(
    requesterName: string,
    requesterRole: string,
    requestType: 'peer' | 'manager' | 'upward' | 'self' = 'peer'
  ): FeedbackPrompt {
    const basePrompt: FeedbackPrompt = {
      title: `Provide Feedback for ${requesterName}`,
      instructions: `Your feedback will help ${requesterName} grow and improve. Please be specific, constructive, and balanced.`,
      sections: [],
      tips: [
        'Be specific rather than general',
        'Focus on behaviors, not personality',
        'Balance positive and constructive feedback',
        'Provide context and examples',
        'Suggest actionable next steps',
      ],
    };

    // Common sections for all types
    basePrompt.sections = [
      {
        id: 'strengths',
        title: 'Strengths & What They Do Well',
        description: 'Identify specific strengths and positive contributions. Be concrete with examples.',
        placeholder:
          'Example: "John consistently delivers high-quality code. In the recent API project, his attention to error handling prevented several potential issues..."',
        required: true,
      },
      {
        id: 'areas_for_improvement',
        title: 'Areas for Improvement',
        description:
          'Focus on behaviors and skills that can be developed, not personal traits. Frame constructively.',
        placeholder:
          'Example: "During team meetings, you could benefit from summarizing action items at the end. This would help ensure everyone is aligned..."',
        required: true,
      },
      {
        id: 'specific_examples',
        title: 'Specific Examples',
        description: 'Provide concrete examples or situations that illustrate your feedback.',
        placeholder:
          "Example: \"In last week's sprint planning, when discussing the database migration, you asked clarifying questions that helped the team identify a potential issue early...\"",
        required: true,
      },
      {
        id: 'actionable_suggestions',
        title: 'Actionable Suggestions',
        description: 'Offer specific, actionable steps they can take to improve.',
        placeholder:
          'Example: "Consider scheduling a 15-minute check-in with stakeholders mid-week to ensure alignment. This could help catch issues earlier..."',
        required: true,
      },
    ];

    // Add type-specific sections
    if (requestType === 'manager') {
      basePrompt.sections.push({
        id: 'leadership_feedback',
        title: 'Leadership & Support',
        description: 'How effectively does this manager provide guidance and support?',
        placeholder:
          'Example: "You provide clear direction on priorities and are always available when I need help..."',
        required: false,
      });
    } else if (requestType === 'upward') {
      basePrompt.sections.push({
        id: 'support_provided',
        title: 'Support & Clarity',
        description: 'How well does your manager support you and provide clear direction?',
        placeholder:
          'Example: "I appreciate the weekly 1-on-1s where we discuss my progress and any blockers..."',
        required: false,
      });
    }

    // Rating sections
    basePrompt.sections.push({
      id: 'overall_rating',
      title: 'Overall Performance Rating',
      description: 'Rate their overall performance',
      placeholder: '',
      required: true,
      type: 'rating',
      scale: {
        min: 1,
        max: 5,
        labels: [
          'Needs Improvement',
          'Developing',
          'Meets Expectations',
          'Exceeds Expectations',
          'Outstanding',
        ],
      },
    });

    if (requestType === 'peer') {
      basePrompt.sections.push(
        {
          id: 'collaboration_rating',
          title: 'Collaboration Quality',
          description: 'How well do they collaborate with the team?',
          placeholder: '',
          required: false,
          type: 'rating',
          scale: { min: 1, max: 5, labels: [] },
        },
        {
          id: 'communication_rating',
          title: 'Communication Effectiveness',
          description: 'How effective is their communication?',
          placeholder: '',
          required: false,
          type: 'rating',
          scale: { min: 1, max: 5, labels: [] },
        }
      );
    }

    basePrompt.sections.push({
      id: 'additional_context',
      title: 'Additional Context (Optional)',
      description: 'Any other relevant information you would like to share',
      placeholder: 'Optional: Add any additional context or observations...',
      required: false,
    });

    return basePrompt;
  }

  /**
   * Validate feedback quality
   */
  validateFeedback(feedback: CreateFeedbackResponseDTO): FeedbackValidation {
    const issues: string[] = [];

    // Check required fields
    if (!feedback.strengths || feedback.strengths.trim().length < 20) {
      issues.push('Strengths section should be more detailed (at least 20 characters)');
    }

    if (
      !feedback.areas_for_improvement ||
      feedback.areas_for_improvement.trim().length < 20
    ) {
      issues.push('Areas for improvement should be more detailed (at least 20 characters)');
    }

    if (!feedback.specific_examples || feedback.specific_examples.trim().length < 20) {
      issues.push('Please provide specific examples (at least 20 characters)');
    }

    if (
      !feedback.actionable_suggestions ||
      feedback.actionable_suggestions.trim().length < 20
    ) {
      issues.push('Please provide actionable suggestions (at least 20 characters)');
    }

    if (!feedback.overall_rating || feedback.overall_rating < 1 || feedback.overall_rating > 5) {
      issues.push('Please provide an overall rating between 1 and 5');
    }

    // Check for constructive language
    const negativeWords = ['terrible', 'awful', 'hate', 'worst', 'useless', 'stupid', 'incompetent'];
    const feedbackText = [
      feedback.strengths,
      feedback.areas_for_improvement,
      feedback.specific_examples,
      feedback.actionable_suggestions,
      feedback.additional_context,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const hasNegativeLanguage = negativeWords.some((word) => feedbackText.includes(word));

    if (hasNegativeLanguage) {
      issues.push(
        'Please use more constructive language. Avoid harsh or personal criticism.'
      );
    }

    // Check for vague feedback
    const vaguePhrases = ['sometimes', 'could be better', 'not bad', 'okay', 'fine'];
    const hasVagueFeedback = vaguePhrases.some((phrase) => feedbackText.includes(phrase));

    if (hasVagueFeedback && feedbackText.length < 200) {
      issues.push(
        'Feedback seems vague. Please provide more specific examples and details.'
      );
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
    };
  }

  /**
   * Calculate feedback quality score (0-100)
   */
  calculateQualityScore(feedback: CreateFeedbackResponseDTO): number {
    let score = 0;

    // Length and detail (40 points)
    const totalLength =
      (feedback.strengths?.length || 0) +
      (feedback.areas_for_improvement?.length || 0) +
      (feedback.specific_examples?.length || 0) +
      (feedback.actionable_suggestions?.length || 0);

    if (totalLength > 500) score += 40;
    else if (totalLength > 300) score += 30;
    else if (totalLength > 150) score += 20;
    else score += 10;

    // Has specific examples (20 points)
    if (feedback.specific_examples && feedback.specific_examples.length > 50) {
      score += 20;
    }

    // Has actionable suggestions (20 points)
    if (feedback.actionable_suggestions && feedback.actionable_suggestions.length > 50) {
      score += 20;
    }

    // Balanced feedback (10 points)
    if (
      feedback.strengths &&
      feedback.areas_for_improvement &&
      feedback.strengths.length > 30 &&
      feedback.areas_for_improvement.length > 30
    ) {
      score += 10;
    }

    // Has ratings (10 points)
    if (feedback.overall_rating) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Get tips for improving feedback based on validation issues
   */
  getImprovementTips(validation: FeedbackValidation): string[] {
    const tips: string[] = [];

    validation.issues.forEach((issue) => {
      if (issue.includes('Strengths')) {
        tips.push('Add more specific examples of what this person does well');
      }
      if (issue.includes('improvement')) {
        tips.push('Provide concrete areas where they can grow, with specific behaviors to change');
      }
      if (issue.includes('examples')) {
        tips.push('Include real situations or projects where you observed these behaviors');
      }
      if (issue.includes('suggestions')) {
        tips.push('Suggest specific actions they can take, resources they can use, or habits to develop');
      }
      if (issue.includes('constructive')) {
        tips.push('Focus on behaviors and outcomes rather than personal characteristics');
      }
      if (issue.includes('vague')) {
        tips.push('Be more specific with dates, projects, or situations');
      }
    });

    return tips;
  }
}

export default new StructuredPrompts();

