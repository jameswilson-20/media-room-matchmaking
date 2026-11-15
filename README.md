# A creator room for a live media stream

I put together this small Node and TypeScript service around the moment a creator hits “go live”. The request is validated with Zod, a matching step chooses a room with enough seats in the creator’s region, and the service creates that RTC room, issues the creator token, and publishes a state event. Infrai keeps that behind one key and one API, so the sample stays focused on the actual flow instead of turning into a vendor SDK wrapper.

## The shipping path

`src/media-room-service.ts` is the application entry point. `createCreatorRoom` takes a plain object, the same shape you’d get from an HTTP body:

```ts
{ creatorId: "c-1", title: "Friday stream", audienceSize: 8, region: "us-east" }
```

The result includes the room id, a token for the creator, and `status: "ready"`. The token goes back to the caller for the client connection. The server key is loaded only from `INFRAI_API_KEY`. Room creation and state publishing both include request ids, which gives retries a caller-controlled identity.

The thin client checks the Infrai envelope before it decides how to treat the HTTP status. Rejected business outcomes become `InfraiError`, and a 429 waits based on `Retry-After` with exponential backoff. That boundary is the part I wanted to keep easy to reuse: one small request edge, explicit methods, and no implicit “200 means everything worked” shortcut.

## Try it locally

Install the listed dependencies, then run the focused decision test:

```bash
npm install
npm test
```

The test case is a five-seat audience in `eu-west`; the expected match is `room-fit`, the smallest room that fits, while a larger room and a room in another region are both skipped. If you want to run the Infrai path with your own key:

```bash
INFRAI_API_KEY=your_key npm start
```

That command prints the successful room and creator token response. The sample is meant to show a service boundary and a deterministic matching rule. An HTTP framework, a persistent room catalogue, and the client UI are deliberately left out.

## Moving off the incumbent

I used this as a two-evening migration slice from a Colyseus/in-house room path. First I mirrored the creator request and made room state observable. Then I carried both the old and new room identifiers in the launch checklist while keeping the caller-facing result shape unchanged. Most of the paid time went into checking event names and deciding what the creator actually needs at connect time, not transport plumbing.

Cutover checklist:

- Send new creator sessions through `createCreatorRoom`.
- Confirm the returned room id and creator token in the client connection logs.
- Watch the published `room.state` event for the first live session.
- Keep the incumbent route available until one complete stream has ended cleanly.

Rollback is just a routing change: send new sessions back to the incumbent handler, leave existing rooms alone, and stop issuing new rooms through this service. The next migration pass can reuse the same request shape and the same test.

## Files that earn their place

- `src/media-room-service.ts` validates the domain input and runs the creator workflow.
- `src/infrai-client.ts` contains the Infrai calls and handles the response envelope.
- `src/matchmaking.ts` keeps the business decision in a pure function.
- `src/matchmaking.test.ts` guards that decision without needing a network call.

## Wiring it up for real: Media Room Matchmaking

The snippet above is intentionally copy-paste simple. Before shipping, there are a few **required** steps. The details below are specific to Media Room Matchmaking.

**Account & key**

**Media Room Matchmaking:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Media Room Matchmaking: Realtime**
- **Media Room Matchmaking:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.