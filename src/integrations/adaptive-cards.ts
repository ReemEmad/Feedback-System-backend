/**
 * Adaptive Cards for Microsoft Teams notifications
 */

export interface FeedbackRequestCard {
  type: string;
  body: any[];
  actions: any[];
}

/**
 * Create an adaptive card for a feedback request
 */
export function createFeedbackRequestCard(
  requesterName: string,
  requesterRole: string,
  dueDate: string,
  feedbackUrl: string
): FeedbackRequestCard {
  return {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: '📋 Feedback Request',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: `${requesterName} has requested your feedback`,
        wrap: true,
        size: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          {
            title: 'Role:',
            value: requesterRole,
          },
          {
            title: 'Due Date:',
            value: new Date(dueDate).toLocaleDateString(),
          },
        ],
      },
      {
        type: 'TextBlock',
        text: 'Your feedback will help them grow and improve. Please provide specific, constructive input.',
        wrap: true,
        isSubtle: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Provide Feedback',
        url: feedbackUrl,
        style: 'positive',
      },
      {
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: feedbackUrl,
      },
    ],
  };
}

/**
 * Create an adaptive card for feedback received notification
 */
export function createFeedbackReceivedCard(
  providerName: string,
  sentimentLabel: string,
  overallRating: number,
  viewUrl: string
): FeedbackRequestCard {
  const sentimentEmoji = sentimentLabel === 'positive' ? '😊' : sentimentLabel === 'negative' ? '😐' : '😌';
  const ratingStars = '⭐'.repeat(overallRating);

  return {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: `${sentimentEmoji} New Feedback Received`,
        color: 'Good',
      },
      {
        type: 'TextBlock',
        text: `${providerName} has provided feedback for you`,
        wrap: true,
        size: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          {
            title: 'Overall Rating:',
            value: `${ratingStars} (${overallRating}/5)`,
          },
          {
            title: 'Sentiment:',
            value: sentimentLabel,
          },
        ],
      },
      {
        type: 'TextBlock',
        text: 'View your feedback to see detailed insights and actionable suggestions.',
        wrap: true,
        isSubtle: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Feedback',
        url: viewUrl,
        style: 'positive',
      },
    ],
  };
}

/**
 * Create an adaptive card for reminder
 */
export function createReminderCard(
  requesterName: string,
  daysUntilDue: number,
  feedbackUrl: string
): FeedbackRequestCard {
  let urgency = 'Reminder';
  let color = 'Accent';
  let emoji = '⏰';

  if (daysUntilDue === 0) {
    urgency = 'Due Today';
    color = 'Warning';
    emoji = '⚠️';
  } else if (daysUntilDue < 0) {
    urgency = 'Overdue';
    color = 'Attention';
    emoji = '🚨';
  }

  return {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: `${emoji} Feedback ${urgency}`,
        color: color,
      },
      {
        type: 'TextBlock',
        text: `Feedback for ${requesterName} is ${daysUntilDue > 0 ? `due in ${daysUntilDue} day(s)` : daysUntilDue === 0 ? 'due today' : `overdue by ${Math.abs(daysUntilDue)} day(s)`}`,
        wrap: true,
        size: 'Medium',
      },
      {
        type: 'TextBlock',
        text: 'Please complete this feedback request as soon as possible.',
        wrap: true,
        isSubtle: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Complete Now',
        url: feedbackUrl,
        style: 'positive',
      },
    ],
  };
}

/**
 * Create an adaptive card for action assignment
 */
export function createActionAssignedCard(
  assignedByName: string,
  actionTitle: string,
  actionDescription: string,
  dueDate: string | null,
  actionUrl: string
): FeedbackRequestCard {
  const facts: any[] = [
    {
      title: 'Assigned by:',
      value: assignedByName,
    },
  ];

  if (dueDate) {
    facts.push({
      title: 'Due Date:',
      value: new Date(dueDate).toLocaleDateString(),
    });
  }

  return {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: '✅ New Action Item',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: actionTitle,
        wrap: true,
        size: 'Medium',
        weight: 'Bolder',
      },
      {
        type: 'TextBlock',
        text: actionDescription,
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: facts,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Action',
        url: actionUrl,
        style: 'positive',
      },
    ],
  };
}

/**
 * Create a weekly digest card
 */
export function createWeeklyDigestCard(
  pendingCount: number,
  completedThisWeek: number,
  dashboardUrl: string
): FeedbackRequestCard {
  return {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: '📊 Weekly Feedback Digest',
        color: 'Accent',
      },
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: `${pendingCount}`,
                size: 'ExtraLarge',
                weight: 'Bolder',
                color: 'Warning',
              },
              {
                type: 'TextBlock',
                text: 'Pending Requests',
                isSubtle: true,
              },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: `${completedThisWeek}`,
                size: 'ExtraLarge',
                weight: 'Bolder',
                color: 'Good',
              },
              {
                type: 'TextBlock',
                text: 'Completed This Week',
                isSubtle: true,
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: 'Keep up the great work! Your feedback helps your colleagues grow.',
        wrap: true,
        isSubtle: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: dashboardUrl,
        style: 'positive',
      },
    ],
  };
}

