import type { IOperationResult } from "@microsoft/power-apps/data";
import type { IGetAllOptions } from "../generated/models/CommonModels";
export class OperationalError extends Error {}
export function unwrap<T>(
  result: IOperationResult<T>,
  operation = "Data operation",
): T {
  if (!result.success) {
    console.error(operation, result.error);
    throw new OperationalError(
      `${operation} could not be completed. Please retry.`,
    );
  }
  return result.data;
}
export async function allPages<T>(
  get: (options: IGetAllOptions) => Promise<IOperationResult<T[]>>,
  options: IGetAllOptions = {},
  signal?: AbortSignal,
  onProgress?: (loaded: number) => void,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let skipToken: string | undefined;
  do {
    signal?.throwIfAborted();
    const page = await get({
      ...options,
      top: undefined,
      maxPageSize: 5000,
      skipToken,
    });
    const data = unwrap(page, "Loading records");
    if (!Array.isArray(data))
      throw new OperationalError(
        "Records could not be loaded completely. Please retry.",
      );
    rows.push(...data);
    signal?.throwIfAborted();
    onProgress?.(rows.length);
    skipToken = page.skipToken;
    if (skipToken && seen.has(skipToken))
      throw new OperationalError(
        "Records could not be loaded completely. Please retry.",
      );
    if (skipToken) seen.add(skipToken);
  } while (skipToken);
  signal?.throwIfAborted();
  return rows;
}
export const escapeOData = (value: string) => value.replace(/'/g, "''");
