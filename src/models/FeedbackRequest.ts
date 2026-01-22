export interface FeedbackRequest {
  id: number;
  requester_id: number;
  provider_id: number;
  cycle_id: string;
  request_type: 'peer' | 'manager' | 'upward' | 'self';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assigned_at: string;
  due_date: string;
  completed_at?: string;
  reminder_count: number;
  last_reminder_at?: string;
}

export interface CreateFeedbackRequestDTO {
  requester_id: number;
  provider_id: number;
  cycle_id: string;
  request_type?: 'peer' | 'manager' | 'upward' | 'self';
  due_date: string;
}

