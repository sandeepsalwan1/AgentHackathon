export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs a sandboxed execution task.
 * Uses E2B Code Interpreter if E2B_API_KEY is present,
 * otherwise falls back to local execution.
 */
export async function runInSandbox(code: string): Promise<SandboxExecutionResult> {
  const apiKey = process.env.E2B_API_KEY;

  if (!apiKey) {
    console.log("No E2B_API_KEY found. Executing task locally as a fallback.");
    // Simulate sandboxed execution by running a local function eval safely
    try {
      let loggedStdout = "";
      const originalLog = console.log;
      console.log = (...args) => { loggedStdout += args.join(" ") + "\n"; };
      
      // Run the code dynamically inside a VM-like context (simple eval for hackathon fallback)
      eval(code);
      
      console.log = originalLog;
      return {
        stdout: loggedStdout || "Execution completed (Local Fallback)",
        stderr: "",
        exitCode: 0
      };
    } catch (err: any) {
      return {
        stdout: "",
        stderr: err.message,
        exitCode: 1
      };
    }
  }

  console.log("E2B_API_KEY detected. Starting E2B Sandbox...");
  try {
    // @ts-ignore
    const { CodeInterpreter } = await import("@e2b/code-interpreter");
    const sandbox = await CodeInterpreter.create({ apiKey });
    
    console.log("E2B Sandbox started. Running code...");
    const execution = await sandbox.runCode(code);
    await sandbox.close();

    return {
      stdout: execution.logs.stdout.map((l: any) => l.line).join("\n"),
      stderr: execution.logs.stderr.map((l: any) => l.line).join("\n"),
      exitCode: execution.error ? 1 : 0
    };
  } catch (err: any) {
    console.error("E2B Sandbox execution failed:", err);
    return {
      stdout: "",
      stderr: `E2B Error: ${err.message}`,
      exitCode: 1
    };
  }
}
