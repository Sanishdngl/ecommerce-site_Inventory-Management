import * as grpc from "@grpc/grpc-js";

export function callGrpc<Req, Res>(
  client: any,
  method: string,
  request: Req,
  meta?: grpc.Metadata
): Promise<Res> {
  return new Promise((resolve, reject) => {
    client[method](
      request,
      meta ?? new grpc.Metadata(),
      (err: grpc.ServiceError | null, response: Res) => {
        if (err) reject(err);
        else resolve(response);
      }
    );
  });
}

export function streamToGrpc<Res>(
  client: any,
  method: string,
  messages: any[],
  meta?: grpc.Metadata
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const call = client[method](
      meta ?? new grpc.Metadata(),
      (err: grpc.ServiceError | null, response: Res) => {
        if (err) reject(err);
        else resolve(response);
      }
    );

    for (const message of messages) {
      call.write(message);
    }

    call.end();
  });
}

export function buildMeta(adminId?: string, ip?: string): grpc.Metadata {
  const meta = new grpc.Metadata();
  if (adminId) meta.set("admin_id", adminId);
  if (ip) meta.set("ip_address", ip);
  return meta;
}
