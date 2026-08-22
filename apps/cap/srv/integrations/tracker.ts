import cds from "@sap/cds";
import { integrationConfig } from "./config.js";
import { IntegrationError } from "./http-client.js";
import type {
  IntegrationMessageRow,
  OutboundResult,
} from "./types.js";

export const MESSAGE_TYPES = {
  SEND_PURCHASE_ORDER_SUPPLIER: "SEND_PURCHASE_ORDER_SUPPLIER",
  SEND_PURCHASE_ORDER_ERP: "SEND_PURCHASE_ORDER_ERP",
  CONFIRM_PURCHASE_ORDER_SUPPLIER: "CONFIRM_PURCHASE_ORDER_SUPPLIER",
  RECEIVE_GOODS_ERP: "RECEIVE_GOODS_ERP",
  SEND_INVOICE_ACCOUNTING: "SEND_INVOICE_ACCOUNTING",
} as const;

const ENTITY = "epp.IntegrationMessages";

function nextNumber(prefix: string, lastNumber?: string): string {
  const lastSequence = lastNumber?.startsWith(prefix)
    ? Number(lastNumber.slice(prefix.length))
    : 0;
  const sequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

async function nextMessageId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INT-${year}-`;
  const last = (await SELECT.one
    .from(ENTITY)
    .columns("messageId")
    .where({ messageId: { like: `${prefix}%` } })
    .orderBy("messageId desc")) as { messageId?: string } | null;

  return nextNumber(prefix, last?.messageId);
}

export function parseJson<T>(value?: string | null): T | undefined {
  if (!value) return;
  try {
    return JSON.parse(value) as T;
  } catch {
    return;
  }
}

export async function getIntegrationMessage(
  ID: string,
): Promise<IntegrationMessageRow | null> {
  return (await SELECT.one.from(ENTITY).where({ ID })) as
    | IntegrationMessageRow
    | null;
}

export async function findSuccessMessage(
  businessEntityId: string,
  messageType: string,
): Promise<IntegrationMessageRow | null> {
  return (await SELECT.one
    .from(ENTITY)
    .where({
      businessEntityId,
      messageType,
      status: "SUCCESS",
    })
    .orderBy("processedAt desc")) as IntegrationMessageRow | null;
}

export async function runOutbound<T>(input: {
  existing?: IntegrationMessageRow | null;
  messageType: string;
  destinationSystem: string;
  businessEntityType: string;
  businessEntityId: string;
  payload: unknown;
  send: () => Promise<T>;
}): Promise<OutboundResult<T>> {
  let messageId: string;
  let attempts: number;

  if (input.existing) {
    messageId = input.existing.messageId;
    attempts = Number(input.existing.attempts || 0) + 1;
    await UPDATE(ENTITY)
      .set({
        status: "RETRYING",
        attempts,
        errorMessage: null,
      })
      .where({ ID: input.existing.ID });
  } else {
    messageId = await nextMessageId();
    attempts = 1;
    await INSERT.into(ENTITY).entries({
      messageId,
      messageType: input.messageType,
      sourceSystem: "CAP",
      destinationSystem: input.destinationSystem,
      businessEntityType: input.businessEntityType,
      businessEntityId: input.businessEntityId,
      status: "PROCESSING",
      attempts,
      payload: JSON.stringify(input.payload),
    });
  }

  try {
    const result = await input.send();
    const responsePayload = JSON.stringify(result);
    const processedAt = new Date().toISOString();

    await UPDATE(ENTITY)
      .set({
        status: "SUCCESS",
        responsePayload,
        errorMessage: null,
        processedAt,
      })
      .where({ messageId });

    return {
      messageId,
      status: "SUCCESS",
      attempts,
      result,
      responsePayload,
    };
  } catch (err) {
    const errorMessage =
      err instanceof IntegrationError
        ? err.message
        : err instanceof Error
          ? `NETWORK: ${err.message}`
          : "Unknown integration error";
    const processedAt = new Date().toISOString();

    await UPDATE(ENTITY)
      .set({
        status: "FAILED",
        errorMessage,
        processedAt,
      })
      .where({ messageId });

    return {
      messageId,
      status: "FAILED",
      attempts,
      errorMessage,
    };
  }
}

export function maxAttemptsReached(attempts: number): boolean {
  return Number(attempts || 0) >= integrationConfig().maxAttempts;
}