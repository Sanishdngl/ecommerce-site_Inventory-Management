import { getDb } from "@infrastructure/database/mysql";
import { handle, NotFoundError } from "@shared/errors";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  CustomerIdSchema,
  UpdateProfileSchema,
} from "@shared/validation/customer.schema";
import {
  findCustomerById,
  updateCustomerProfile,
} from "../db/customer.queries";

function sanitizeCustomer(customer: any) {
  const { password_hash, ...safe } = customer;
  return safe;
}

export const getProfile = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id } = validateGrpc(CustomerIdSchema, call.request);

  const customer = await findCustomerById(db, customer_id);
  if (!customer) throw new NotFoundError("Customer not found");

  callback(null, { customer: sanitizeCustomer(customer) });
});

export const updateProfile = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, first_name, last_name } = validateGrpc(
    UpdateProfileSchema,
    call.request
  );

  const existing = await findCustomerById(db, customer_id);
  if (!existing) throw new NotFoundError("Customer not found");

  const updated = await updateCustomerProfile(db, customer_id, {
    first_name,
    last_name,
  });

  callback(null, { customer: sanitizeCustomer(updated!) });
});
