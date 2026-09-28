import { MicrosoftDataverseService } from "../generated/services/MicrosoftDataverseService";
import type { IGetAllOptions } from "../generated/models/CommonModels";
import type { IOperationResult } from "@microsoft/power-apps/data";
import { OperationalError } from "./data";
import { entitySet } from "../config/schema";

/**
 * Target Dataverse Organization URL.
 * When the Code App is deployed to a home environment (e.g. https://org998df960.crm4.dynamics.com/),
 * all Dataverse CRUD operations target this Dataverse environment using MicrosoftDataverseService withOrganization calls.
 */
export const TARGET_DATAVERSE_ORG_URL = (
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_DATAVERSE_ORG_URL ||
  "https://aemara.crm4.dynamics.com"
).replace(/\/+$/, "");

function resolveEntitySet(name: string): string {
  try {
    return entitySet(name) || name;
  } catch {
    return name;
  }
}

/**
 * List records from a specific Dataverse organization.
 */
export async function listRecordsOrg<T>(
  entityName: string,
  options: IGetAllOptions = {},
  orgUrl = TARGET_DATAVERSE_ORG_URL,
): Promise<IOperationResult<T[]>> {
  const eset = resolveEntitySet(entityName);
  const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
    orgUrl,
    eset,
    undefined,
    "application/json",
    undefined,
    undefined,
    options.select?.join(","),
    options.filter,
    options.orderBy?.join(","),
    undefined,
    undefined,
    options.top,
    options.skipToken,
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    } as IOperationResult<T[]>;
  }

  const raw = result.data as unknown;
  let items: T[] = [];
  let nextLink: string | undefined;

  if (Array.isArray(raw)) {
    items = raw as T[];
  } else if (
    raw &&
    typeof raw === "object" &&
    "value" in raw &&
    Array.isArray((raw as { value: unknown }).value)
  ) {
    items = (raw as { value: T[] }).value;
    if (typeof (raw as Record<string, unknown>)["@odata.nextLink"] === "string") {
      nextLink = (raw as Record<string, unknown>)["@odata.nextLink"] as string;
    }
  }

  let skipToken: string | undefined;
  if (nextLink) {
    try {
      const u = new URL(nextLink);
      skipToken = u.searchParams.get("$skiptoken") || undefined;
    } catch {
      // ignore parsing error
    }
  }

  return {
    success: true,
    data: items,
    skipToken,
  } as IOperationResult<T[]>;
}

/**
 * Get a single record by ID from a specific Dataverse organization.
 */
export async function getItemOrg<T>(
  entityName: string,
  recordId: string,
  options: { select?: string[] } = {},
  orgUrl = TARGET_DATAVERSE_ORG_URL,
): Promise<IOperationResult<T>> {
  const eset = resolveEntitySet(entityName);
  const result = await MicrosoftDataverseService.GetItemWithOrganization(
    "return=representation",
    "application/json",
    orgUrl,
    eset,
    recordId,
    undefined,
    undefined,
    options.select?.join(","),
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    } as IOperationResult<T>;
  }

  return {
    success: true,
    data: result.data as T,
  } as IOperationResult<T>;
}

/**
 * Create a record in a specific Dataverse organization.
 */
export async function createRecordOrg<T = void>(
  entityName: string,
  item: Record<string, unknown>,
  orgUrl = TARGET_DATAVERSE_ORG_URL,
): Promise<IOperationResult<T>> {
  const eset = resolveEntitySet(entityName);
  const result = await MicrosoftDataverseService.CreateRecordWithOrganization(
    "return=representation",
    "application/json",
    orgUrl,
    eset,
    item,
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    } as IOperationResult<T>;
  }

  return {
    success: true,
    data: result.data as unknown as T,
  } as IOperationResult<T>;
}

/**
 * Update a record in a specific Dataverse organization.
 */
export async function updateRecordOrg<T = void>(
  entityName: string,
  recordId: string,
  item: Record<string, unknown>,
  orgUrl = TARGET_DATAVERSE_ORG_URL,
): Promise<IOperationResult<T>> {
  const eset = resolveEntitySet(entityName);
  const result = await MicrosoftDataverseService.UpdateRecordWithOrganization(
    "return=representation",
    "application/json",
    orgUrl,
    eset,
    recordId,
    item,
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    } as IOperationResult<T>;
  }

  return {
    success: true,
    data: result.data as unknown as T,
  } as IOperationResult<T>;
}

/**
 * Upload a file/attachment content to a record in a specific Dataverse organization.
 */
export async function uploadFileOrg(
  entityName: string,
  recordId: string,
  fieldName: string,
  file: File,
  orgUrl = TARGET_DATAVERSE_ORG_URL,
): Promise<IOperationResult<void>> {
  const eset = resolveEntitySet(entityName);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return MicrosoftDataverseService.UpdateEntityFileImageFieldContentWithOrganization(
    file.type || "application/octet-stream",
    orgUrl,
    eset,
    recordId,
    fieldName,
    base64,
    file.name,
  );
}

/**
 * Download a file/attachment content from a record in a specific Dataverse organization.
 */
export async function downloadFileOrg(
  entityName: string,
  recordId: string,
  fieldName: string,
  orgUrl = TARGET_DATAVERSE_ORG_URL,
): Promise<{ data: string; fileName?: string }> {
  const eset = resolveEntitySet(entityName);
  const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
    "bytes=0-",
    orgUrl,
    eset,
    recordId,
    fieldName,
  );

  if (!result.success) {
    throw new OperationalError(
      `Downloading attachment failed: ${result.error?.message || "Unknown error"}`,
    );
  }

  return {
    data: result.data || "",
    fileName: "attachment",
  };
}
