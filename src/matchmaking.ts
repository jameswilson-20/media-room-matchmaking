export type MatchRequest = { creatorId: string; audienceSize: number; region: string };

export function chooseRoom(request: MatchRequest, available: Array<{ room: string; region: string; seats: number }>) {
  return available
    .filter((room) => room.region === request.region && room.seats >= request.audienceSize)
    .sort((left, right) => left.seats - right.seats)[0] ?? null;
}
