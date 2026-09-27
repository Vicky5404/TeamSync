type WsData = string | Buffer | ArrayBuffer | Buffer[];

function toText(data: WsData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

/**
 * Maps the web client's `{ type, ...fields }` messages onto Nest's
 * `{ event, data }` handler routing. Anything that isn't a JSON object with a
 * string `type` is ignored.
 */
export function parseClientMessage(
  data: WsData,
): { event: string; data: Record<string, unknown> } | void {
  let message: unknown;
  try {
    message = JSON.parse(toText(data));
  } catch {
    return;
  }
  if (typeof message !== 'object' || message === null || Array.isArray(message)) return;
  const type = (message as { type?: unknown }).type;
  if (typeof type !== 'string' || type.length > 32) return;
  return { event: type, data: message as Record<string, unknown> };
}
