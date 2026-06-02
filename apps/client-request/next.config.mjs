import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@central-vet/db", "@central-vet/request-form", "@central-vet/request-intake"],
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
