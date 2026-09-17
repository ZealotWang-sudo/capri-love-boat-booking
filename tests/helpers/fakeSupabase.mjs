/**
 * Minimal in-memory stand-in for the supabase-js client.
 *
 * It deliberately enforces the same constraints as
 * supabase/booking-payment-reliability.sql, because the reliability guarantees
 * under test are the constraints. A fake that accepts everything would prove
 * nothing.
 */

const ACTIVE_BOOKING_STATUSES = new Set([
  "requested",
  "checking_with_captain",
  "payment_pending",
  "confirmed",
  "available",
]);
const NON_BLOCKING_PAYMENT_STATUSES = new Set(["failed", "released"]);

function uniqueViolation(detail) {
  return {
    code: "23505",
    details: detail,
    message: `duplicate key value violates unique constraint (${detail})`,
  };
}

function exclusionViolation(detail) {
  return {
    code: "23P01",
    details: detail,
    message: `conflicting key value violates exclusion constraint (${detail})`,
  };
}

function rangesOverlap(first, second) {
  return (
    first.tour_start_minutes < second.tour_end_minutes &&
    second.tour_start_minutes < first.tour_end_minutes
  );
}

function bookingBlocksSlot(booking) {
  return (
    ACTIVE_BOOKING_STATUSES.has(booking.booking_status) &&
    !NON_BLOCKING_PAYMENT_STATUSES.has(booking.payment_status ?? "unpaid") &&
    Number.isInteger(booking.tour_start_minutes) &&
    Number.isInteger(booking.tour_end_minutes)
  );
}

const CONSTRAINTS = {
  booking_checkout_attempts(row, rows) {
    if (rows.some((existing) => existing.id === row.id)) {
      return uniqueViolation("booking_checkout_attempts_pkey");
    }

    if (
      row.stripe_checkout_session_id &&
      rows.some(
        (existing) =>
          existing.stripe_checkout_session_id === row.stripe_checkout_session_id,
      )
    ) {
      return uniqueViolation("booking_checkout_attempts_session_unique");
    }

    if (row.status === "pending") {
      const conflict = rows.some(
        (existing) =>
          existing.status === "pending" &&
          existing.requested_date === row.requested_date &&
          rangesOverlap(existing, row),
      );

      if (conflict) {
        return exclusionViolation("booking_checkout_attempts_no_overlap");
      }
    }

    return null;
  },
  booking_email_events(row, rows) {
    if (row.status !== "sent") {
      return null;
    }

    const duplicate = rows.some(
      (existing) =>
        existing.status === "sent" &&
        existing.booking_id === row.booking_id &&
        existing.event_type === row.event_type,
    );

    return duplicate
      ? uniqueViolation("booking_email_events_sent_unique")
      : null;
  },
  bookings(row, rows) {
    if (rows.some((existing) => existing.id === row.id)) {
      return uniqueViolation("bookings_pkey");
    }

    if (
      row.stripe_checkout_session_id &&
      rows.some(
        (existing) =>
          existing.stripe_checkout_session_id === row.stripe_checkout_session_id,
      )
    ) {
      return uniqueViolation("bookings_stripe_checkout_session_unique");
    }

    if (
      row.stripe_payment_intent_id &&
      rows.some(
        (existing) =>
          existing.stripe_payment_intent_id === row.stripe_payment_intent_id,
      )
    ) {
      return uniqueViolation("bookings_stripe_payment_intent_unique");
    }

    if (bookingBlocksSlot(row)) {
      const conflict = rows.some(
        (existing) =>
          bookingBlocksSlot(existing) &&
          existing.requested_date === row.requested_date &&
          rangesOverlap(existing, row),
      );

      if (conflict) {
        return exclusionViolation("bookings_no_active_overlap");
      }
    }

    return null;
  },
  whatsapp_messages(row, rows) {
    if (
      row.meta_message_id &&
      rows.some((existing) => existing.meta_message_id === row.meta_message_id)
    ) {
      return uniqueViolation("whatsapp_messages_meta_message_id_key");
    }

    return null;
  },
};

const FILTERS = {
  eq: (value, target) => value === target,
  gte: (value, target) => value >= target,
  in: (value, target) => target.includes(value),
  isNotNull: (value) => value !== null && value !== undefined,
  lt: (value, target) => value < target,
  lte: (value, target) => value <= target,
  neq: (value, target) => value !== target,
};

class FakeQuery {
  constructor({ db, operation, payload, table }) {
    this.db = db;
    this.operation = operation;
    this.payload = payload;
    this.table = table;
    this.filters = [];
    this.single = false;
    this.limitValue = null;
    this.orderBy = null;
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, kind: "eq", value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, kind: "neq", value });
    return this;
  }

  in(column, value) {
    this.filters.push({ column, kind: "in", value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ column, kind: "lt", value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ column, kind: "gte", value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ column, kind: "lte", value });
    return this;
  }

  not(column, operator, value) {
    if (operator === "is" && value === null) {
      this.filters.push({ column, kind: "isNotNull" });
    }

    return this;
  }

  order(column, options) {
    this.orderBy = { ascending: options?.ascending !== false, column };
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  matches(row) {
    return this.filters.every((filter) =>
      FILTERS[filter.kind](row[filter.column], filter.value),
    );
  }

  run() {
    const injected = this.db.takeFailure(this.table, this.operation);

    if (injected) {
      return { data: null, error: injected };
    }

    const rows = this.db.tableRows(this.table);

    if (this.operation === "insert") {
      return this.runInsert(rows);
    }

    let selected = rows.filter((row) => this.matches(row));

    if (this.orderBy) {
      const { ascending, column } = this.orderBy;
      selected = [...selected].sort((first, second) => {
        if (first[column] === second[column]) {
          return 0;
        }

        return (first[column] > second[column] ? 1 : -1) * (ascending ? 1 : -1);
      });
    }

    if (this.operation === "update") {
      selected.forEach((row) => Object.assign(row, this.payload));
    }

    if (this.operation === "delete") {
      this.db.setTableRows(
        this.table,
        rows.filter((row) => !selected.includes(row)),
      );
    }

    if (typeof this.limitValue === "number") {
      selected = selected.slice(0, this.limitValue);
    }

    const data = selected.map((row) => ({ ...row }));

    return this.single
      ? { data: data[0] ?? null, error: null }
      : { data, error: null };
  }

  runInsert(rows) {
    const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted = [];

    for (const row of incoming) {
      const candidate = { ...row };
      const violation = CONSTRAINTS[this.table]?.(candidate, rows);

      if (violation) {
        return { data: null, error: violation };
      }

      rows.push(candidate);
      inserted.push({ ...candidate });
    }

    return this.single
      ? { data: inserted[0] ?? null, error: null }
      : { data: inserted, error: null };
  }

  then(onFulfilled, onRejected) {
    try {
      return Promise.resolve(this.run()).then(onFulfilled, onRejected);
    } catch (error) {
      return Promise.reject(error).then(onFulfilled, onRejected);
    }
  }
}

export class FakeSupabase {
  constructor(initialTables = {}) {
    this.tables = new Map(
      Object.entries(initialTables).map(([table, rows]) => [
        table,
        rows.map((row) => ({ ...row })),
      ]),
    );
    this.failures = [];
    this.rpcHandlers = new Map();
  }

  tableRows(table) {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }

    return this.tables.get(table);
  }

  setTableRows(table, rows) {
    this.tables.set(table, rows);
  }

  rows(table) {
    return this.tableRows(table).map((row) => ({ ...row }));
  }

  /** Makes the next matching operation fail, simulating a Supabase outage. */
  failNext(table, operation, error = { code: "08006", message: "connection failure" }) {
    this.failures.push({ error, operation, table });
  }

  takeFailure(table, operation) {
    const index = this.failures.findIndex(
      (failure) => failure.table === table && failure.operation === operation,
    );

    if (index === -1) {
      return null;
    }

    const [failure] = this.failures.splice(index, 1);

    return failure.error;
  }

  onRpc(name, handler) {
    this.rpcHandlers.set(name, handler);
  }

  async rpc(name, args) {
    const handler = this.rpcHandlers.get(name);

    if (!handler) {
      return { data: null, error: { message: `Unknown rpc ${name}` } };
    }

    return { data: await handler(args), error: null };
  }

  from(table) {
    return {
      delete: () => new FakeQuery({ db: this, operation: "delete", table }),
      insert: (payload) =>
        new FakeQuery({ db: this, operation: "insert", payload, table }),
      select: () => new FakeQuery({ db: this, operation: "select", table }),
      update: (payload) =>
        new FakeQuery({ db: this, operation: "update", payload, table }),
    };
  }
}

export function createFakeSupabase(initialTables) {
  return new FakeSupabase(initialTables);
}
