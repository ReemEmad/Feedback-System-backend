import { Router, Request, Response } from 'express';
import { query, get, run } from '../config/database';
import feedbackAssigner from '../services/feedback-assigner';
import structuredPrompts from '../services/structured-prompts';
import sentimentAnalyzer from '../services/sentiment-analyzer';
import conversationalEnhancer from '../services/agents/conversational-enhancer';
import feedbackQualityCoach from '../services/agents/feedback-quality-coach';

const router = Router();

interface ChatSession {
  id: string;
  employee_id: number;
  request_id: number;
  state: string;
  context: any;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize a chat session for feedback
 * This is called when an employee opens the chatbot or when proactively triggered
 */
router.post('/sessions/init', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Get employee details
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check for pending feedback requests
    const pendingRequests = await feedbackAssigner.getPendingRequests(employeeId);

    if (pendingRequests.length === 0) {
      return res.json({
        hasRequests: false,
        message: `Hi ${employee.name}! 👋\n\nYou're all caught up! You have no pending feedback requests at the moment. Great job! 🎉`,
      });
    }

    // Get the next pending request (prioritize by due date)
    // Note: System is designed for ONE peer per session
    const nextRequest = pendingRequests[0];
    
    // Only show the first pending request (one peer per session policy)

    // Create or get chat session (exclude terminal states)
    let session = await get(
      'SELECT * FROM chat_sessions WHERE employee_id = ? AND request_id = ? AND state NOT IN ("completed", "cancelled", "snoozed")',
      [employeeId, nextRequest.id]
    );

    if (!session) {
      const sessionId = `chat_${Date.now()}_${employeeId}`;
      await run(
        `INSERT INTO chat_sessions (id, employee_id, request_id, state, context, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [sessionId, employeeId, nextRequest.id, 'greeting', JSON.stringify({})]
      );
      session = await get('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
    }

    // Get role-based questions
    const questions = structuredPrompts.getRoleBasedQuestions(
      employee.role || 'General',
      nextRequest.requester_role || 'General',
      employee.department || 'General',
      nextRequest.requester_department || 'General'
    );

    // Prepare greeting message
    let greetingMessage = `Hi ${employee.name}! 👋

It's time for your bi-weekly feedback session! 📅

I'd like to get your feedback on **${nextRequest.requester_name}** (${nextRequest.requester_role}).

You've been working with them recently, and your insights would be valuable for their growth and development.

This will take about 5-10 minutes. Ready to start?`;

    // Enhance message with conversational enhancer
    greetingMessage = await conversationalEnhancer.enhanceMessage(
      greetingMessage,
      employeeId,
      nextRequest.requester_id,
      {}
    );

    return res.json({
      hasRequests: true,
      sessionId: session.id,
      state: 'greeting',
      message: greetingMessage,
      request: {
        id: nextRequest.id,
        requesterName: nextRequest.requester_name,
        requesterRole: nextRequest.requester_role,
        requesterDepartment: nextRequest.requester_department,
        dueDate: nextRequest.due_date,
      },
      questions: questions,
      totalPending: pendingRequests.length,
      actions: [
        { type: 'button', label: 'Yes, let\'s start!', action: 'start_feedback' },
        { type: 'button', label: 'Remind me later', action: 'remind_later' },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle chat message/interaction
 */
router.post('/sessions/:sessionId/message', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { message, action, questionId, value } = req.body;

    // Get session
    const session = await get('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const context = JSON.parse(session.context || '{}');
    const employee = await get('SELECT * FROM employees WHERE id = ?', [session.employee_id]);
    const request = await feedbackAssigner.getRequestDetails(session.request_id);

    let newState = session.state;
    let responseMessage = '';
    let nextQuestion = null;
    let actions: any[] = [];
    let isComplete = false;

    console.log(`Processing action: ${action}, current state: ${session.state}`);

    // If user wants to start feedback, reset any non-greeting state
    if (action === 'start_feedback' && session.state !== 'greeting') {
      console.log(`Resetting session from ${session.state} to greeting for fresh start`);
      newState = 'greeting';
      session.state = 'greeting';
      // Clear the context for a fresh start
      context.currentQuestionIndex = undefined;
      context.responses = {};
      context.questions = undefined;
    }

    // Handle different states
    switch (session.state) {
      case 'greeting':
        console.log('In greeting state, action:', action);
        if (action === 'start_feedback') {
          console.log('Starting feedback collection...');
          newState = 'collecting';
          context.currentQuestionIndex = 0;
          context.responses = {};

          // Get questions
          const questions = structuredPrompts.getRoleBasedQuestions(
            employee.role || 'General',
            request.requester_role || 'General',
            employee.department || 'General',
            request.requester_department || 'General'
          );
          context.questions = questions;

          nextQuestion = questions[0];
          // Create progress bar
          const progressBar = '█'.repeat(1) + '░'.repeat(questions.length - 1);
          responseMessage = `Great! Let's begin.\n\n📊 Progress: ${progressBar} (1/${questions.length})\n\n**${nextQuestion.title}**\n\n${nextQuestion.description}\n\n${nextQuestion.placeholder ? `_Example: ${nextQuestion.placeholder}_` : ''}`;
          console.log('Response message:', responseMessage);
          console.log('Next question:', nextQuestion);
        } else if (action === 'remind_later') {
          responseMessage = `No problem! I'll remind you later. 👍`;
          newState = 'snoozed';
          isComplete = true;
        }
        break;

      case 'collecting':
        // Save response
        if (questionId && value) {
          context.responses[questionId] = value;
          
          // Get quality suggestions from AI agent
          const qualitySuggestions = await feedbackQualityCoach.analyzeFeedbackQuality(
            value,
            questionId,
            request.requester_role || 'General'
          );
          
          // Add suggestions to context if any
          if (qualitySuggestions.length > 0 && qualitySuggestions[0].severity === 'high') {
            context.qualitySuggestions = context.qualitySuggestions || {};
            context.qualitySuggestions[questionId] = qualitySuggestions;
          }
          
          context.currentQuestionIndex = (context.currentQuestionIndex || 0) + 1;

          const questions = context.questions || [];
          
          if (context.currentQuestionIndex < questions.length) {
            // Next question
            nextQuestion = questions[context.currentQuestionIndex];
            // Create progress bar
            const progressBar = '█'.repeat(context.currentQuestionIndex + 1) + '░'.repeat(questions.length - context.currentQuestionIndex - 1);
            
            // Get encouragement from conversational enhancer
            const encouragement = await conversationalEnhancer.getEncouragement(employee.id, {
              current: context.currentQuestionIndex + 1,
              total: questions.length,
            });
            
            responseMessage = `${encouragement}\n\n📊 Progress: ${progressBar} (${context.currentQuestionIndex + 1}/${questions.length})\n\n**${nextQuestion.title}**\n\n${nextQuestion.description}\n\n${nextQuestion.placeholder ? `_Example: ${nextQuestion.placeholder}_` : ''}`;
            
            // Add quality suggestion if available
            if (qualitySuggestions.length > 0 && qualitySuggestions[0].severity === 'high') {
              responseMessage += `\n\n💡 **Tip:** ${qualitySuggestions[0].message}`;
            }
          } else {
            // All questions answered - show summary
            newState = 'review';
            responseMessage = `Great! You've answered all the questions. 🎉\n\nLet me show you a summary of your feedback:\n\n`;
            
            // Build summary
            questions.forEach((q: any) => {
              if (context.responses[q.id]) {
                responseMessage += `**${q.title}:**\n${context.responses[q.id]}\n\n`;
              }
            });

            responseMessage += `\nWould you like to submit this feedback?`;
            actions = [
              { type: 'button', label: 'Submit Feedback', action: 'submit' },
              { type: 'button', label: 'Make Changes', action: 'edit' },
            ];
          }
        } else {
          responseMessage = 'Please provide your response to continue.';
        }
        break;

      case 'review':
        if (action === 'submit') {
          // Submit feedback
          const responses = context.responses;
          
          // Save to database
          const sql = `
            INSERT INTO feedback_responses 
            (request_id, requester_id, provider_id, strengths, areas_for_improvement, 
             specific_examples, actionable_suggestions, additional_context, overall_rating, 
             collaboration_rating, communication_rating, technical_rating, is_anonymous)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const result = await run(sql, [
            session.request_id,
            request.requester_id,
            session.employee_id,
            responses.strengths || '',
            responses.areas_for_improvement || '',
            responses.specific_examples || '',
            responses.actionable_suggestions || '',
            responses.additional_context || null,
            responses.overall_rating || 3,
            responses.collaboration_rating || null,
            responses.communication_rating || null,
            responses.technical_rating || null,
            0, // is_anonymous
          ]);

          const responseId = result.lastID;

          // Analyze sentiment
          const feedbackText = [
            responses.strengths,
            responses.areas_for_improvement,
            responses.specific_examples,
            responses.actionable_suggestions,
          ].filter(Boolean).join(' ');

          await sentimentAnalyzer.analyzeAndSave(responseId, feedbackText);

          // Update request status
          await feedbackAssigner.updateRequestStatus(session.request_id, 'completed');

          // Mark session complete
          newState = 'completed';
          isComplete = true;

          responseMessage = `✅ **Feedback Submitted Successfully!**\n\nThank you for taking the time to provide thoughtful feedback for ${request.requester_name}. Your insights will help them grow! 🌱\n\nYou're all set! We'll reach out again in 2 weeks for your next feedback session. 📅`;
          
          // No actions - session ends here (one peer per session)
        } else if (action === 'edit') {
          newState = 'collecting';
          context.currentQuestionIndex = 0;
          nextQuestion = context.questions[0];
          responseMessage = `Okay! Let's go through the questions again.\n\n**Question 1:**\n\n${nextQuestion.title}\n\n${nextQuestion.description}`;
        }
        break;
    }

    // Update session
    await run(
      'UPDATE chat_sessions SET state = ?, context = ?, updated_at = datetime("now") WHERE id = ?',
      [newState, JSON.stringify(context), sessionId]
    );

    const responsePayload = {
      sessionId,
      state: newState,
      message: responseMessage,
      question: nextQuestion,
      actions,
      isComplete,
      context: {
        currentQuestionIndex: context.currentQuestionIndex,
        totalQuestions: context.questions?.length || 0,
        requesterName: request.requester_name,
      },
    };

    console.log('Chatbot response payload:', JSON.stringify(responsePayload, null, 2));

    return res.json(responsePayload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get active session for employee
 */
router.get('/sessions/active/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;

    const session = await get(
      `SELECT cs.*, fr.requester_id, e.name as requester_name, e.role as requester_role
       FROM chat_sessions cs
       JOIN feedback_requests fr ON cs.request_id = fr.id
       JOIN employees e ON fr.requester_id = e.id
       WHERE cs.employee_id = ? AND cs.state NOT IN ('completed', 'snoozed', 'cancelled')
       ORDER BY cs.updated_at DESC
       LIMIT 1`,
      [employeeId]
    );

    if (!session) {
      return res.json({ hasActiveSession: false });
    }

    return res.json({
      hasActiveSession: true,
      session: {
        id: session.id,
        state: session.state,
        requesterName: session.requester_name,
        requesterRole: session.requester_role,
        updatedAt: session.updated_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel/Close a chat session
 */
router.post('/sessions/:sessionId/cancel', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Get session
    const session = await get('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update session to cancelled
    await run(
      'UPDATE chat_sessions SET state = ?, updated_at = datetime("now") WHERE id = ?',
      ['cancelled', sessionId]
    );

    return res.json({
      message: 'Session cancelled successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Webhook endpoint for external platforms (Teams, Slack, etc.)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { platform, userId, message, action } = req.body;

    // Map platform user ID to employee
    const employee = await get(
      'SELECT * FROM employees WHERE azure_id = ? OR email = ?',
      [userId, userId]
    );

    if (!employee) {
      return res.json({
        message: "I couldn't find your account. Please contact your administrator.",
      });
    }

    // Handle the message
    if (!message && !action) {
      // Initialize chat
      const initResponse = await fetch('http://localhost:3000/api/chatbot/sessions/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const data = await initResponse.json();
      return res.json(data);
    }

    // Forward to message handler
    return res.json({
      message: 'Message received',
      platform,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

