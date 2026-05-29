import * as grpc from "@grpc/grpc-js";
import { getAdminPackage } from "@shared/proto-loader";
import {
  loginAdmin,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminStatus,
  listAdminUsersHandler,
} from "../handlers/admin.handlers";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getAdminPackage();
  const Service = pkg["AdminService"] as any;

  server.addService(Service.service, {
    LoginAdmin: loginAdmin,
    CreateAdminUser: createAdminUser,
    UpdateAdminUser: updateAdminUser,
    DeleteAdminUser: deleteAdminUser,
    ToggleAdminStatus: toggleAdminStatus,
    ListAdminUsers: listAdminUsersHandler,
  });

  return server;
}
