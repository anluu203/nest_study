export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export interface IUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}
