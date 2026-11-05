/**
 * Think nests transactionSync calls when it saves a reply. Cloudflare allows
 * that, but celld throws "cannot start a transaction within a transaction", so
 * every reply was lost on reload. An inner call joins the outer transaction, so
 * an error it lets escape still rolls the whole thing back.
 */
export function makeTransactionsReentrant(
  storage: Pick<DurableObjectStorage, "transactionSync">,
) {
  const run = storage.transactionSync.bind(storage);
  let active = false;
  storage.transactionSync = <T>(closure: () => T): T => {
    if (active) return closure();
    active = true;
    try {
      return run(closure);
    } finally {
      active = false;
    }
  };
}
