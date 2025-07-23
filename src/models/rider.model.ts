export interface Rider {
  id: number;
  name: string;
  email: string;
  phone: string;
  password?: string; // Optional because we don't want to return it in every query
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  created_at: Date;
  updated_at: Date;
  distance?: number; // Added for proximity search results
} 