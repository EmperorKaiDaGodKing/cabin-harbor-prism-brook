import { createFileRoute } from "@tanstack/react-router";

/**
 * Dynamic import keeps the xAI key and the chat handler out of the client bundle.
 * The handlers only run on the server.
 */
export const Route = createFileRoute("/api/frank")({
  server: {
    handlers: {
      GET: async () => {
        const { handleFrankStatus } = await import("@/lib/frank-api");
        return handleFrankStatus();
      },
      POST: async ({ request }) => {
        const { handleFrankChat } = await import("@/lib/frank-api");
        return handleFrankChat(request);
      },
    },
  },
});
