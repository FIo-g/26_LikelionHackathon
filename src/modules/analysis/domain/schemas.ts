import { z } from "zod";

import { versionedPayloadSchema } from "@/shared/validation/versioned-json";
import type { ConfidenceLevel, Evidence } from "@/shared/domain/contracts";
import type { AnalysisResult, DataBasis, ReadinessComponent } from "./types";

const confidenceLevelSchema = z.enum([
  "insufficient",
  "low",
  "medium",
  "high",
] as const) satisfies z.ZodType<ConfidenceLevel>;

const evidenceCodeSchema = z.enum([
  "baseline-too-few-samples",
  "baseline-confidence-insufficient",
  "sleep-regularity-missing-days",
  "readiness-missing-sleep-duration",
  "readiness-missing-regularity",
  "readiness-missing-caffeine",
  "readiness-missing-phone",
  "readiness-missing-meal-exercise",
  "confidence-low-sample",
  "confidence-incomplete-direct-data",
  "sleep-impact-insufficient-data",
  "sleep-impact-positive-association",
  "sleep-impact-negative-association",
  "sleep-impact-neutral-association",
] as const);

export const evidenceSchema = z.object({
  code: evidenceCodeSchema,
  label: z.string().min(1),
  direction: z.union([
    z.literal("positive"),
    z.literal("negative"),
    z.literal("neutral"),
  ]),
  value: z.union([z.number().finite(), z.string(), z.null()]),
  count: z.number().int().min(0).nullable(),
}).strict() satisfies z.ZodType<Omit<Evidence, "count"> & { count: Evidence["count"] }>;

const orderedUniqueStrings = (schema: z.ZodType<string>) => z
  .array(schema)
  .superRefine((items, context) => {
    const uniqueCount = new Set(items).size;
    if (uniqueCount !== items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "missingFields must be unique",
      });
    }

    for (let index = 1; index < items.length; index += 1) {
      if (items[index - 1] > items[index]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "missingFields must be sorted",
        });
      }
    }
  });

const boundedMetricSchema = z.number().finite().min(0).max(100);
const boundedPercentOrNull = boundedMetricSchema.nullable();

export const dataBasisSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sampleCount: z.number().int().min(0),
  excludedCount: z.number().int().min(0),
  missingFields: orderedUniqueStrings(z.enum([
    "sleep",
    "phone",
    "meal",
    "exercise",
    "caffeine",
    "alcohol",
    "wellness",
  ] as const)),
  completenessByCategory: z.object({
    sleep: z.number().finite().min(0).max(1),
    phone: z.number().finite().min(0).max(1),
    meal: z.number().finite().min(0).max(1),
    exercise: z.number().finite().min(0).max(1),
    caffeine: z.number().finite().min(0).max(1),
    alcohol: z.number().finite().min(0).max(1),
    wellness: z.number().finite().min(0).max(1),
  }).strict(),
  sourceDistribution: z.object({
    manual: z.number().finite().min(0).max(1),
  }).strict(),
  computedAt: z.string(),
  algorithmVersion: z.literal("provisional-v1"),
  confidence: confidenceLevelSchema,
}).strict() satisfies z.ZodType<DataBasis>;

export const analysisResultSchema = z.object({
  readiness: boundedPercentOrNull,
  confidence: confidenceLevelSchema,
  metrics: z.object({
    sleepRhythmStability: boundedPercentOrNull,
    phoneWindDown: boundedPercentOrNull,
    caffeineSignal: boundedPercentOrNull,
    sleepGoalAttainment: boundedPercentOrNull,
  }).strict(),
  dataBasis: dataBasisSchema,
  evidence: z.array(evidenceSchema),
  missingFields: orderedUniqueStrings(z.enum([
    "sleepDuration",
    "regularity",
    "caffeine",
    "phone",
    "mealExercise",
  ] as const)),
}).strict() satisfies z.ZodType<AnalysisResult>;

export const analysisResultSchemaEnvelope = versionedPayloadSchema({
  analysisResult: analysisResultSchema,
}) as unknown as z.ZodType<Readonly<{
  schemaVersion: 1;
  analysisResult: AnalysisResult;
}>>;

export const isConfidenceLevel = (value: string): value is "insufficient" | "low" | "medium" | "high" => (
  value === "insufficient" || value === "low" || value === "medium" || value === "high"
);
