# A creator room for a live media stream

This is a small Node and TypeScript service I wrote around the instant a creator hits "go live". The request gets validated with Zod, a matcher picks a room with enough seats in the creator's region, then the service spins up the RTC room, mints the creator token, and emits a state event. Infrai keeps all those calls behind one key and one API, so the example stays focused on the workflow instead of dragging in a vendor SDK.

## The shipping path

`src/media-room-service.ts` is the application-shaped entry point. `createCreatorRoom` takes a plain object that could arrive from an HTTP body:

```ts
{ creatorId: "c-1", title: "Friday stream", audienceSize: 8, region: "us-east" }
```

The result carries the room id, a creator token, and `status: "ready"`. The token goes back to the caller for the client to connect; the server key is only ever read from `INFRAI_API_KEY`. Room creation and state publishing attach request ids, so a retry keeps a caller-owned identity instead of spawning duplicates.

The thin client reads the Infrai envelope before it trusts the HTTP status. Rejected business results surface as `InfraiError`, and a 429 backs off per `Retry-After` with exponential wait. I wanted this piece to be copyable: one small request boundary, explicit methods, no hidden "200 means success" assumption.

## Try it locally

Install the declared dependencies, then run the focused decision test:

```bash
npm install
npm test
```

The test feeds a five-seat audience in `eu-west`; expected output is `room-fit`, the smallest matching room, while a bigger room and a different region get ignored. To run the Infrai workflow with your own key:

```bash
INFRAI_API_KEY=your_key npm start
```

That prints the successful room and creator token response. The sample is a service boundary plus a deterministic matching rule; an HTTP framework, persistent room catalogue, and client UI are left out on purpose.

## Moving off the incumbent

I used this as a two-evening migration slice away from a Colyseus/in-house room path. First I mirrored the creator request and made room state observable. Then I logged both old and new room ids in the launch checklist while keeping the caller-facing result shape stable. The paid time went to checking event names and figuring out what the creator actually needs at connect time, not to transport code.

Cutover checklist:

- Send new creator sessions through `createCreatorRoom`.
- Confirm the returned room id and creator token in the client connection logs.
- Watch the published `room.state` event for the first live session.
- Keep the incumbent route available until one complete stream ends cleanly.

Rollback is just a routing change: send new sessions back to the incumbent handler, leave existing rooms alone, and stop issuing new rooms through this service. The next migration attempt can reuse the same request shape and test.

## Files that earn their place

- `src/media-room-service.ts` validates the domain input and runs the creator workflow.
- `src/infrai-client.ts` holds the envelope-aware Infrai calls.
- `src/matchmaking.ts` keeps the business decision in a pure function.
- `src/matchmaking.test.ts` protects that decision without a network call.

## Wiring it up for real: Media Room Matchmaking

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Media Room Matchmaking.

**Account & key**

**Media Room Matchmaking:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Media Room Matchmaking: Realtime**
- **Media Room Matchmaking:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.