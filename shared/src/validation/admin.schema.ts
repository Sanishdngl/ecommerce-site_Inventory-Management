import { z } from "zod";

// Used to validate grpc requests
export const AdminRoleEnum = z.enum(["SUPER_ADMIN", "MAINTAINER", "REPORTER"]);
// ADMIN_ROLE_UNSPECIFIED (0) excluded — invalid client value

// Used for gateway route validation.
export const AdminRoleAppEnum = z.enum([
  "super_admin",
  "maintainer",
  "reporter",
]);

export const LoginAdminSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  device_id: z.string().min(1),
  device_pixel_ratio: z.number().positive(),
});

export const CreateAdminSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.email(),
  password: z.string().min(8),
  role: AdminRoleAppEnum,
});

export const UpdateAdminSchema = z.object({
  id: z.uuid(),
  username: z.string().min(3).max(50).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  role: AdminRoleAppEnum.optional(),
});

// gRPC-layer variants — validate call.request AFTER the gateway controller's
export const CreateAdminGrpcSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.email(),
  password: z.string().min(8),
  role: AdminRoleEnum,
});

export const UpdateAdminGrpcSchema = z.object({
  id: z.uuid(),
  username: z.string().min(3).max(50).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  role: AdminRoleEnum.optional(),
});

export const DeleteAdminSchema = z.object({
  id: z.uuid(),
});

export const GetAdminSchema = z.object({
  id: z.uuid(),
});

export const ToggleStatusSchema = z.object({
  id: z.uuid(),
});

export const ListAdminSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// gRPC-layer variant — ListAdminRequest nests pagination (`pagination: {
// page, limit }`), unlike the gateway's flat query-string shape above.
export const ListAdminGrpcSchema = z.object({
  pagination: z
    .object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .optional(),
});
