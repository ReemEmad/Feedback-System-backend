export interface FeedbackCycle {
  id: string;
  name: string;
  type: 'peer' | '360' | 'pulse' | 'custom';
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'archived';
  config?: any;
  created_by?: number;
  created_at: string;
}

export interface CreateFeedbackCycleDTO {
  name: string;
  type?: 'peer' | '360' | 'pulse' | 'custom';
  start_date: string;
  end_date: string;
  config?: {
    peers_per_employee?: number;
    include_manager?: boolean;
    include_reports?: boolean;
    auto_assign?: boolean;
  };
  created_by?: number;
}

