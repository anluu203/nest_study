export class PageResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;

  get hasPreviousPage(): boolean {
    return this.pageNumber > 1;
  }

  get hasNextPage(): boolean {
    return this.pageNumber < this.totalPages;
  }

  static create<T>(
    items: T[],
    totalCount: number,
    pageNumber: number,
    pageSize: number,
  ): PageResult<T> {
    const result = new PageResult<T>();
    result.items = items;
    result.totalCount = totalCount;
    result.pageNumber = pageNumber;
    result.pageSize = pageSize;
    result.totalPages = Math.ceil(totalCount / pageSize);
    return result;
  }
}
