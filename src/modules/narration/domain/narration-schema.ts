import { z } from "zod";

export const narrationOutputSchema = z.object({
  headline: z.string().min(1).max(80),
  body: z.string().min(1).max(600),
  bullets: z.array(z.string().min(1).max(120)).max(3),
}).strict();
