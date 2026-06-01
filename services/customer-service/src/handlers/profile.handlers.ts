import { getDb } from "@shared/db";
import { Errors, handle } from "@shared/errors";
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
  const { customer_id } = call.request as any;

  if (!customer_id) throw Errors.invalidArgument("customer_id is required");

  const customer = await findCustomerById(db, customer_id);
  if (!customer) throw Errors.notFound("Customer not found");

  callback(null, { customer: sanitizeCustomer(customer) });
});

export const updateProfile = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, first_name, last_name } = call.request as any;

  if (!customer_id) throw Errors.invalidArgument("customer_id is required");

  const existing = await findCustomerById(db, customer_id);
  if (!existing) throw Errors.notFound("Customer not found");

  const updated = await updateCustomerProfile(db, customer_id, {
    first_name,
    last_name,
  });

  callback(null, { customer: sanitizeCustomer(updated!) });
});
