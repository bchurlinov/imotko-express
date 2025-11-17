export interface PaginationMeta {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    total: number;
    hasMore: boolean;
}

export interface ApiResponse<Data> {
    message: string;
    data: Data;
    pagination?: PaginationMeta;
}
