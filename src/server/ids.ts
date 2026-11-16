import { LedgerError } from "./ledger";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route param as a UUID, or a 404 (never a database error). */
export async function idParam(params: Promise<{ id: string }>, what: string) {
  const { id } = await params;
  if (!UUID.test(id)) throw new LedgerError(`${what} not found`, 404);
  return id;
}
