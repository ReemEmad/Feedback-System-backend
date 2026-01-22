export interface Employee {
  id: number;
  azure_id?: string;
  email: string;
  name: string;
  department?: string;
  role?: string;
  manager_id?: number;
  is_manager: number;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeDTO {
  azure_id?: string;
  email: string;
  name: string;
  department?: string;
  role?: string;
  manager_id?: number;
  is_manager?: number;
}

