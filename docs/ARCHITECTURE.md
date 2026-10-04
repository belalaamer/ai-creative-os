# Architecture v0.1

## Core principle
The product exposes user intentions (create ad, create image, create campaign), not model names.

## Request path
User -> Web App -> API Gateway -> Auth/Org/Permission -> Credit reservation -> Workflow Engine -> Model Router -> Provider -> Asset Storage -> Cost ledger -> Project workspace.

## Security boundary
Provider keys never reach the browser. Every generation is scoped by organization and validated server-side before provider invocation.

## Cost model
Each generation records provider/model, raw usage, estimated USD cost, credits reserved, credits finalized, and margin metadata. Credits are ledger-based; wallet balance is derived/maintained transactionally.

## Async jobs
Video/image workflows are represented as jobs and workflow steps. Long-running provider jobs use polling/webhooks and idempotency keys.
