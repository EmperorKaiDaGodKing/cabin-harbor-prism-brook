import { createFileRoute } from "@tanstack/react-router";

/** Dynamic import keeps the speech handler and the xAI key out of the client bundle. */
export const Route = createFileRoute("/api/frank/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleFrankSpeak } = await import("@/lib/frank-speech");
        return handleFrankSpeak(request);
      },
    },
  },
});
