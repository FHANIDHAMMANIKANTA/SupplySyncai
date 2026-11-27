import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const runAgent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      agent: z.enum(["risk", "supplier", "sop"]),
      context: z.string().max(30000),
      upstreamContext: z.string().max(30000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { runAgentServer } = await import("./agents.server");
    return runAgentServer(data.agent, data.context, data.upstreamContext);
  });

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getAiStatusServer } = await import("./agents.server");
  return getAiStatusServer();
});
