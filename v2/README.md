# Creative OS V2 — ready-stack

This branch stops rebuilding commodity marketing-tool surfaces from scratch.

## Selected base
- OpenAdKit (MIT), pinned to commit 22786a9ca2f73bb07c0d4b2e7e4954049e0e6d02: primary V2 product shell, Brand Brain, 18 generators, 11 optimizers, provider abstraction, history, research and benchmarks.
- Sobe Tudo (MIT), pinned to commit 30ce40d148c7c00c017a37059a4ed14213ede8fb: Meta campaign-launch reference implementation.
- Existing Creative OS services remain the source for organization auth, credits, secure provider secrets and production storage.

## Why this base
OpenAdKit is closer to the product experience we want than the current custom dashboard, is much lighter than the Docker/Python alternatives, and is compatible with the current Next/Tailwind family. Sobe Tudo is intentionally small and gives us a proven Meta campaign-create flow without importing a separate auth/database stack.

## Materialize locally
Run:

```bash
bash scripts/v2/bootstrap.sh
```

This clones the exact audited upstream commits into `.v2/` and applies our white-label patch without modifying upstream license/notice files.

## Migration rule
Do not rewrite an OpenAdKit tool until there is a concrete product requirement it cannot satisfy. Integrate our Supabase/Meta services around the ready-made UI first, then replace isolated internals only where necessary.
