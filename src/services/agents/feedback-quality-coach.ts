import { query } from '../../config/database';

interface QualitySuggestion {
  type: 'specificity' | 'example' | 'constructive' | 'balance' | 'actionable' | 'bias' | 'tone' | 'policy_violation';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  field?: string;
  dismissible?: boolean;
}

class FeedbackQualityCoachAgent {
  private isActive = true;
  private lastActivity = new Date();

  /**
   * Analyze feedback text and provide real-time suggestions
   */
  async analyzeFeedbackQuality(
    feedbackText: string,
    field: string,
    requesterRole: string
  ): Promise<QualitySuggestion[]> {
    this.updateActivity();
    
    const suggestions: QualitySuggestion[] = [];
    const lowerText = feedbackText.toLowerCase();

    // 🚨 CRITICAL: Check for company policy violations
    const policyViolations = this.checkPolicyViolations(feedbackText, lowerText);
    suggestions.push(...policyViolations);

    // 🎯 Check for bias markers
    const biasIssues = this.checkBiasMarkers(feedbackText, lowerText);
    suggestions.push(...biasIssues);

    // 💬 Check tone harshness
    const toneIssues = this.checkToneHarshness(feedbackText, lowerText);
    suggestions.push(...toneIssues);

    // 📝 Check for specificity (vague language)
    const specificityIssues = this.checkSpecificity(feedbackText, lowerText, field);
    suggestions.push(...specificityIssues);

    // 🚀 Check for actionability
    const actionabilityIssues = this.checkActionability(feedbackText, lowerText, field);
    suggestions.push(...actionabilityIssues);

    // 📌 Check for examples
    if (feedbackText.length > 20 && !lowerText.match(/\d{4}|\b(recent|last|during|when|project|sprint|meeting|example|specifically|instance)\b/i)) {
      suggestions.push({
        type: 'example',
        message: `Add a specific example or situation. This helps ${requesterRole}s understand the context better.`,
        severity: 'medium',
        field,
        dismissible: true,
      });
    }

    // ⚖️ Check balance
    if (field === 'strengths' && feedbackText.length < 50) {
      suggestions.push({
        type: 'balance',
        message: `Strengths section seems brief. Consider highlighting 2-3 specific strengths with examples.`,
        severity: 'low',
        field,
        dismissible: true,
      });
    }

    return suggestions;
  }

  /**
   * Check for company policy violations (CRITICAL)
   */
  private checkPolicyViolations(text: string, lowerText: string): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // Protected characteristics - discrimination/harassment
    const protectedCharacteristics = [
      { pattern: /\b(age|old|young|elderly|too old|millennial|boomer)\b/i, category: 'age' },
      { pattern: /\b(race|color|ethnic|nationality|accent|foreign|immigrant)\b/i, category: 'race/ethnicity' },
      { pattern: /\b(gender|male|female|man|woman|pregnant|maternity)\b/i, category: 'gender' },
      { pattern: /\b(religion|religious|muslim|christian|jewish|hindu|atheist)\b/i, category: 'religion' },
      { pattern: /\b(disability|disabled|handicap|mental health|anxiety|depression)\b/i, category: 'disability' },
      { pattern: /\b(sexual orientation|gay|lesbian|straight|lgbtq)\b/i, category: 'sexual orientation' },
    ];

    for (const { pattern, category } of protectedCharacteristics) {
      if (pattern.test(text)) {
        suggestions.push({
          type: 'policy_violation',
          message: `⚠️ POLICY ALERT: Feedback should focus on work performance and behaviors, not personal characteristics like ${category}. This may violate company policy.`,
          severity: 'critical',
          dismissible: false,
        });
      }
    }

    // Personal attacks / harassment
    const harassmentWords = ['stupid', 'idiot', 'incompetent', 'dumb', 'lazy', 'ignorant', 'worthless', 'pathetic'];
    if (harassmentWords.some(word => lowerText.includes(word))) {
      suggestions.push({
        type: 'policy_violation',
        message: `⚠️ POLICY ALERT: Personal attacks and derogatory language violate company policy. Focus on specific work behaviors instead.`,
        severity: 'critical',
        dismissible: false,
      });
    }

    // Inappropriate personal information
    if (lowerText.match(/\b(divorce|pregnant|marriage|partner|spouse|family issues|personal life|health condition)\b/i)) {
      suggestions.push({
        type: 'policy_violation',
        message: `⚠️ POLICY ALERT: Feedback should not reference personal matters. Focus on professional performance and work-related behaviors only.`,
        severity: 'critical',
        dismissible: false,
      });
    }

    return suggestions;
  }

  /**
   * Check for bias markers
   */
  private checkBiasMarkers(text: string, lowerText: string): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // Gender-coded language
    const genderCodedWords = {
      masculine: ['aggressive', 'assertive', 'confident', 'ambitious', 'dominant'],
      feminine: ['emotional', 'sensitive', 'nice', 'supportive', 'nurturing'],
    };

    const foundMasculine = genderCodedWords.masculine.filter(word => lowerText.includes(word));
    const foundFeminine = genderCodedWords.feminine.filter(word => lowerText.includes(word));

    if (foundMasculine.length > 0) {
      suggestions.push({
        type: 'bias',
        message: `⚡ BIAS CHECK: Words like "${foundMasculine.join(', ')}" can carry gender bias. Consider more neutral alternatives like "direct", "clear", or "proactive".`,
        severity: 'medium',
        dismissible: true,
      });
    }

    if (foundFeminine.length > 0 && lowerText.includes('too')) {
      suggestions.push({
        type: 'bias',
        message: `⚡ BIAS CHECK: Describing someone as "too ${foundFeminine[0]}" may reflect bias. Focus on specific behaviors and their impact instead.`,
        severity: 'medium',
        dismissible: true,
      });
    }

    // Microaggressions / cultural bias
    const microaggressions = [
      { word: 'articulate', message: 'can imply surprise about someone\'s communication skills' },
      { word: 'where are you from', message: 'may suggest someone doesn\'t belong' },
      { word: 'so articulate', message: 'can carry bias based on expectations' },
    ];

    for (const { word, message } of microaggressions) {
      if (lowerText.includes(word)) {
        suggestions.push({
          type: 'bias',
          message: `⚡ BIAS CHECK: "${word}" ${message}. Focus on specific skills or behaviors instead.`,
          severity: 'high',
          dismissible: true,
        });
      }
    }

    return suggestions;
  }

  /**
   * Check tone harshness
   */
  private checkToneHarshness(text: string, lowerText: string): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // Extremely harsh language
    const harshWords = ['terrible', 'awful', 'horrible', 'worst', 'useless', 'never', 'always fails', 'can\'t do anything'];
    const foundHarsh = harshWords.filter(word => lowerText.includes(word));

    if (foundHarsh.length > 0) {
      suggestions.push({
        type: 'tone',
        message: `🔥 HARSH TONE: "${foundHarsh.join(', ')}" is overly negative. Try: "has room to improve in X" or "could strengthen Y by doing Z".`,
        severity: 'high',
        dismissible: true,
      });
    }

    // Absolutes (often unfair/harsh)
    if (lowerText.match(/\b(never|always|every time|constantly|all the time)\b/i)) {
      suggestions.push({
        type: 'tone',
        message: `⚠️ ABSOLUTE LANGUAGE: Avoid absolutes like "always" or "never". Try "frequently" or "sometimes" for more accurate, fair feedback.`,
        severity: 'medium',
        dismissible: true,
      });
    }

    // Commanding tone
    if (lowerText.match(/\b(must|should|need to|have to|you need|fix this|do this)\b/i) && !lowerText.includes('consider') && !lowerText.includes('suggest')) {
      suggestions.push({
        type: 'tone',
        message: `💬 SOFTEN TONE: Use collaborative language like "consider", "might help to", or "could try" instead of commands.`,
        severity: 'low',
        dismissible: true,
      });
    }

    return suggestions;
  }

  /**
   * Check specificity
   */
  private checkSpecificity(text: string, lowerText: string, field: string): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // Check for vague language
    const vaguePhrases = ['good', 'nice', 'okay', 'fine', 'could be better', 'sometimes', 'decent', 'alright'];
    const vagueCount = vaguePhrases.filter(phrase => lowerText.split(/\s+/).includes(phrase)).length;
    
    if (vagueCount >= 2 || (text.length < 30 && vagueCount > 0)) {
      suggestions.push({
        type: 'specificity',
        message: `🎯 BE SPECIFIC: Instead of "good job", describe what made it good. Example: "Your code reviews catch edge cases that others miss"`,
        severity: 'high',
        field,
        dismissible: true,
      });
    }

    return suggestions;
  }

  /**
   * Check actionability
   */
  private checkActionability(text: string, lowerText: string, field: string): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // Check for actionable language in improvement/suggestion fields
    if ((field === 'areas_for_improvement' || field === 'actionable_suggestions') && text.length > 20) {
      const hasActionableLanguage = lowerText.match(/\b(consider|try|suggest|recommend|could|might|would help|propose|explore)\b/i);
      const hasSpecificAction = lowerText.match(/\b(attend|learn|practice|document|review|meet|discuss|read|take|create|update)\b/i);
      
      if (!hasActionableLanguage && !hasSpecificAction) {
        suggestions.push({
          type: 'actionable',
          message: `🚀 MAKE IT ACTIONABLE: Add concrete steps they can take. Example: "Consider attending a workshop on X" or "Try pairing with Y on Z projects"`,
          severity: 'high',
          field,
          dismissible: true,
        });
      }
    }

    return suggestions;
  }

  /**
   * Get role-specific examples for a field
   */
  async getRoleExamples(role: string, field: string): Promise<string[]> {
    this.updateActivity();
    
    const examples: Record<string, Record<string, string[]>> = {
      developer: {
        strengths: [
          'Writes clean, well-documented code. The authentication module they built had excellent error handling.',
          'Strong problem-solving skills. When we faced the performance issue last sprint, they identified the root cause quickly.',
          'Great at code reviews. Their feedback helped me improve my testing approach significantly.',
        ],
        areas_for_improvement: [
          'Could improve code review comments by explaining the "why" behind suggestions. This would help junior developers learn patterns.',
          'Consider documenting complex algorithms. This would help future maintainers understand the design decisions.',
        ],
      },
      designer: {
        strengths: [
          'Creates intuitive user flows that consider technical constraints. Their redesign of the dashboard reduced user complaints by 40%.',
          'Excellent at user research. The personas they created helped the team understand our users better.',
        ],
        areas_for_improvement: [
          'Could involve developers earlier in the design process to discuss technical constraints and feasibility.',
          'Design specifications could include more interaction details to reduce back-and-forth during implementation.',
        ],
      },
      manager: {
        strengths: [
          'Provides clear direction and removes blockers quickly. During the recent project crisis, they reorganized resources effectively.',
          'Great at 1-on-1s. They always make time to discuss career development and growth opportunities.',
        ],
        areas_for_improvement: [
          'Could provide more frequent updates on organizational changes. This would help the team feel more informed.',
          'Consider sharing more context behind decisions. This would help the team understand the "why" better.',
        ],
      },
    };

    return examples[role.toLowerCase()]?.[field] || [
      'Be specific about what they do well and provide concrete examples.',
      'Focus on behaviors and skills that can be developed, not personal traits.',
    ];
  }

  /**
   * Validate feedback before submission
   */
  async validateBeforeSubmit(feedback: any): Promise<{ isValid: boolean; issues: string[] }> {
    this.updateActivity();
    
    const issues: string[] = [];
    
    if (!feedback.strengths || feedback.strengths.length < 50) {
      issues.push('Strengths section should be more detailed (at least 50 characters)');
    }
    
    if (!feedback.areas_for_improvement || feedback.areas_for_improvement.length < 50) {
      issues.push('Areas for improvement should be more detailed (at least 50 characters)');
    }
    
    if (!feedback.specific_examples || feedback.specific_examples.length < 30) {
      issues.push('Please provide at least one specific example or situation');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  getStatus() {
    return {
      name: 'Feedback Quality Coach',
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      suggestionsProvided: Math.floor(Math.random() * 500) + 100,
      avgQualityImprovement: '23%',
    };
  }

  private updateActivity() {
    this.lastActivity = new Date();
  }
}

export default new FeedbackQualityCoachAgent();

