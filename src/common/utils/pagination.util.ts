import { PaginationMetaDto, PaginationResponseDto } from '@common/dto';

export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginationResponseDto<T> {
  const totalPages = Math.ceil(total / limit);

  const meta: PaginationMetaDto = {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  return { data, meta };
}

export function getPaginationParams(page: number = 1, limit: number = 10) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
