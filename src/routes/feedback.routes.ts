import { Router, Request, Response } from 'express';
import { run } from '../config/database';
import feedbackAssigner from '../services/feedback-assigner';
import structuredPrompts from '../services/structured-prompts';
import sentimentAnalyzer from '../services/sentiment-analyzer';
import notificationService from '../services/notification-service';
import { CreateFeedbackResponseDTO } from '../models/FeedbackResponse';

const router = Router();

/**
 * Get pending feedback requests for current user
 */
router.get('/requests/pending', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.query.employeeId as string);
    const requests = await feedbackAssigner.getPendingRequests(employeeId);
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get feedback requests for a requester (to see who they're waiting on)
 */
router.get('/requests/sent', async (req: Request, res: Response) => {
  try {
    const requesterId = parseInt(req.query.requesterId as string);
    const cycleId = req.query.cycleId as string | undefined;
    const requests = await feedbackAssigner.getRequestsForRequester(requesterId, cycleId);
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get role-based feedback questions for a specific request
 */
router.get('/requests/:id/questions', async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    const providerId = parseInt(req.query.providerId as string);
    
    // Get request details with requester info
    const request = await feedbackAssigner.getRequestDetails(requestId);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get provider details
    const { query: dbQuery } = await import('../config/database');
    const provider = await dbQuery('SELECT * FROM employees WHERE id = ?', [providerId]);
    
    if (!provider || provider.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const providerData = provider[0];

    // Get role-based questions
    const questions = structuredPrompts.getRoleBasedQuestions(
      providerData.role || 'General',
      request.requester_role || 'General',
      providerData.department || 'General',
      request.requester_department || 'General'
    );

    // Add rating sections
    questions.push({
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

    if (request.request_type === 'peer') {
      questions.push(
        {
          id: 'collaboration_rating',
          title: 'Collaboration Quality',
          description: 'How well do they collaborate with you and the team?',
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

    questions.push({
      id: 'additional_context',
      title: 'Additional Context (Optional)',
      description: 'Any other relevant information you would like to share',
      placeholder: 'Optional: Add any additional context or observations...',
      required: false,
    });

    res.json({
      questions,
      request: {
        id: request.id,
        requester_name: request.requester_name,
        requester_role: request.requester_role,
        requester_department: request.requester_department,
        request_type: request.request_type,
        due_date: request.due_date,
      },
      guidelines: [
        'Be specific rather than general',
        'Focus on behaviors, not personality',
        'Balance positive and constructive feedback',
        'Provide context and examples',
        'Suggest actionable next steps',
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Submit feedback
 */
router.post('/responses', async (req: Request, res: Response) => {
  try {
    const feedbackData: CreateFeedbackResponseDTO = req.body;

    // Validate feedback
    const validation = structuredPrompts.validateFeedback(feedbackData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Feedback validation failed',
        issues: validation.issues,
      });
    }

    // Save feedback response
    const sql = `
      INSERT INTO feedback_responses 
      (request_id, requester_id, provider_id, strengths, areas_for_improvement, 
       specific_examples, actionable_suggestions, additional_context, overall_rating, 
       collaboration_rating, communication_rating, technical_rating, is_anonymous)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await run(sql, [
      feedbackData.request_id,
      feedbackData.requester_id,
      feedbackData.provider_id,
      feedbackData.strengths,
      feedbackData.areas_for_improvement,
      feedbackData.specific_examples,
      feedbackData.actionable_suggestions,
      feedbackData.additional_context || null,
      feedbackData.overall_rating,
      feedbackData.collaboration_rating || null,
      feedbackData.communication_rating || null,
      feedbackData.technical_rating || null,
      feedbackData.is_anonymous ? 1 : 0,
    ]);

    const responseId = result.lastID;

    // Analyze sentiment
    const feedbackText = [
      feedbackData.strengths,
      feedbackData.areas_for_improvement,
      feedbackData.specific_examples,
      feedbackData.actionable_suggestions,
    ].join(' ');

    const analysis = await sentimentAnalyzer.analyzeAndSave(responseId, feedbackText);

    // Update request status
    await feedbackAssigner.updateRequestStatus(feedbackData.request_id, 'completed');

    // Send notification to requester
    const providerName = feedbackData.is_anonymous ? 'Anonymous' : 'A colleague';
    await notificationService.notifyFeedbackReceived(
      responseId,
      feedbackData.requester_id,
      providerName
    );

    res.json({
      id: responseId,
      message: 'Feedback submitted successfully',
      analysis: analysis,
      validation: validation,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get feedback received by an employee
 */
router.get('/responses/received', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.query.employeeId as string);
    const analyticsService = require('../services/analytics-service').default;
    const analytics = await analyticsService.getEmployeeAnalytics(employeeId);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

