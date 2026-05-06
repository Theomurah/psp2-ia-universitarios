export type DocumentFormat = 'pdf' | 'docx' | 'pptx' | 'md' | 'image';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  format: DocumentFormat;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

export interface JobRecord {
  id: string;
  user_id: string;
  document_id: string;
  status: JobStatus;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  semester: string;
  subjects: string[];
  drive_folder_id?: string;
  created_at: string;
}
