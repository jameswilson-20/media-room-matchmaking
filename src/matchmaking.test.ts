import test from "node:test";
import assert from "node:assert/strict";
import { chooseRoom } from "./matchmaking.ts";

test("chooses the smallest room that fits the creator's regional audience", () => {
  const room = chooseRoom(
    { creatorId: "c-1", audienceSize: 5, region: "eu-west" },
    [
      { room: "room-large", region: "eu-west", seats: 20 },
      { room: "room-fit", region: "eu-west", seats: 5 },
      { room: "room-other-region", region: "us-east", seats: 5 }
    ]
  );
  assert.deepEqual(room, { room: "room-fit", region: "eu-west", seats: 5 });
});
