export interface PaginationParams {
  page: number;
  perPage: number;
  total?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

export interface RegionStat {
  name: string;
  total: number;
  open: number;
  upcoming: number;
  closed: number;
}

export interface CronResult {
  success: boolean;
  message: string;
  count?: number;
  errors?: string[];
}
