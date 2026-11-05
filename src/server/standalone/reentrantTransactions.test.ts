import { expect, it } from "vitest";
import { makeTransactionsReentrant } from "./reentrantTransactions";

function storageLikeCelld() {
  let open = false;
  return {
    transactionSync<T>(closure: () => T): T {
      if (open) throw new Error("cannot start a transaction");
      open = true;
      try {
        return closure();
      } finally {
        open = false;
      }
    },
  };
}

it("runs a nested transaction inside the outer one", () => {
  const storage = storageLikeCelld();
  makeTransactionsReentrant(storage);
  expect(
    storage.transactionSync(() => storage.transactionSync(() => "saved")),
  ).toBe("saved");
});

it("starts a fresh transaction after one throws", () => {
  const storage = storageLikeCelld();
  makeTransactionsReentrant(storage);
  expect(() =>
    storage.transactionSync(() => {
      throw new Error("boom");
    }),
  ).toThrow("boom");
  expect(storage.transactionSync(() => "saved")).toBe("saved");
});
