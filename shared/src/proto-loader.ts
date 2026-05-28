import * as path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO_DIR = path.resolve(__dirname, "../../proto");

const LOADER_OPTIONS: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_DIR],
};

const PROTO_FILES = {
  common: path.join(PROTO_DIR, "common.proto"),
  admin: path.join(PROTO_DIR, "admin.proto"),
  inventory: path.join(PROTO_DIR, "inventory.proto"),
  customer: path.join(PROTO_DIR, "customer.proto"),
} as const;

type ProtoName = keyof typeof PROTO_FILES;

const cache = new Map<ProtoName, grpc.GrpcObject>();

function loadProto(name: ProtoName): grpc.GrpcObject {
  const cached = cache.get(name);
  if (cached) return cached;

  const packageDefinition = protoLoader.loadSync(
    PROTO_FILES[name],
    LOADER_OPTIONS
  );
  const loaded = grpc.loadPackageDefinition(packageDefinition);
  cache.set(name, loaded);
  return loaded;
}

export function getAdminPackage(): grpc.GrpcObject {
  const loaded = loadProto("admin");
  return loaded["admin"] as grpc.GrpcObject;
}

export function getInventoryPackage(): grpc.GrpcObject {
  const loaded = loadProto("inventory");
  return loaded["inventory"] as grpc.GrpcObject;
}

export function getCustomerPackage(): grpc.GrpcObject {
  const loaded = loadProto("customer");
  return loaded["customer"] as grpc.GrpcObject;
}

export function getCommonPackage(): grpc.GrpcObject {
  const loaded = loadProto("common");
  return loaded["common"] as grpc.GrpcObject;
}
