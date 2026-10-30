import { z } from "zod";
import { InfraiClient } from "./infrai-client.ts";

const requestBody = z.object({
  creatorId: z.string().min(1),
  title: z.string().min(1),
  audienceSize: z.number().int().positive(),
  region: z.string().min(1)
});

export async function createCreatorRoom(input: unknown) {
  const request = requestBody.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the service.");
  const infrai = new InfraiClient(key);
  const room = await infrai.createRoom({ name: request.title, max_participants: request.audienceSize, empty_timeout_s: 300, region: request.region });
  const token = await infrai.issueRoomToken({ room: room.room, identity: request.creatorId, display_name: request.creatorId, ttl_s: 3600, can_publish: true, can_subscribe: true });
  await infrai.publishRoomState(`creator:${request.creatorId}`, { room: room.room, title: request.title, status: "ready" });
  return { room: room.room, creatorToken: token.token, status: "ready" };
}

if (process.argv[1]?.endsWith("media-room-service.ts")) {
  createCreatorRoom({ creatorId: "creator-demo", title: "Friday stream", audienceSize: 8, region: "us-east" })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
