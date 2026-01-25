export type ApiResponse<T> = {
    success: boolean;
    status: number;
    code?: string;
    message: string;
    data?: T | null;
    meta?: Record<string, unknown>;
};