export interface FeedbackResponse {
  id: number;
  request_id: number;
  requester_id: number;
  provider_id: number;
  strengths?: string;
  areas_for_improvement?: string;
  specific_examples?: string;
  actionable_suggestions?: string;
  additional_context?: string;
  overall_rating?: number;
  collaboration_rating?: number;
  communication_rating?: number;
  technical_rating?: number;
  is_anonymous: number;
  submitted_at: string;
}

export interface CreateFeedbackResponseDTO {
  request_id: number;
  requester_id: number;
  provider_id: number;
  strengths: string;
  areas_for_improvement: string;
  specific_examples: string;
  actionable_suggestions: string;
  additional_context?: string;
  overall_rating: number;
  collaboration_rating?: number;
  communication_rating?: number;
  technical_rating?: number;
  is_anonymous?: boolean;
}

export interface FeedbackValidation {
  isValid: boolean;
  issues: string[];
}

