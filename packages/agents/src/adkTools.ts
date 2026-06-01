import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { mockClinicData } from "./mockData";
import { createToolRuntime, executeTool, tools, type ToolName, type ToolRuntime } from "./tools";

export function createAdkFunctionTools(runtime: ToolRuntime) {
  return Object.entries(tools).map(([name, definition]) => {
    const tool = definition as {
      description: string;
      parameters: z.ZodObject<z.ZodRawShape>;
    };
    return new FunctionTool({
    name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (args) => executeTool(name as ToolName, args, runtime)
    });
  });
}

const defaultRuntime = createToolRuntime({}, "unknown", {
  clinicData: mockClinicData,
  now: new Date("2026-05-31T12:00:00.000Z")
});

export const adkFunctionTools = createAdkFunctionTools(defaultRuntime);
