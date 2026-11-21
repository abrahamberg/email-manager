import type { AppData, StreamItem } from "../domain/types";

// The server turns this feedback into a nudge on the matching interest; the
// panel only records it and hides what the user rejected.
export function giveFeedback(data: AppData, streamId: string, itemId: string, feedback: StreamItem["feedback"]): AppData {
  const streams = data.streams.map((stream) =>
    stream.id !== streamId ? stream : { ...stream, picks: stream.picks.map((item) => (item.id === itemId ? { ...item, feedback } : item)) },
  );
  return { ...data, streams };
}
