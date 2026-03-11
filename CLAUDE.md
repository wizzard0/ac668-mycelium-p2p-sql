# this is a P2P sql replicator used in mycelium, flower and other projects

## workflow

- DISCUSS before implementing: confirm key design decisions AND algorithms with user before writing code
- Don't rush into implementation - step back, discuss approach, data structures, and algorithms first
- For non-trivial changes: present options, discuss trade-offs, get confirmation
- Ensure there is a clear trace "request/need" > "scenario" > "requirement" > "spec + test" > code at all times.
- **Test-first**: write tests before implementation; missing tests are more critical than missing features
- NEVER push to remote. User will push manually when ready.

## code style

- Files should be small (under 100 LOC)
- Prefer small functions (under 50 LOC)
- Prefer pure functions, instead of instance methods.
- NO default parameters, NO optional parameters, NO optional parameters as interface fields. Instead, use explicit overloads or separate functions
- Prefer unique function names so grep finds them unambiguously (e.g. `writeArchive()` not `class Archive { write() }`)
- Check invariants defensively - validate inputs, sizes, ranges at boundaries
- Fail-fast: throw early on invalid state rather than propagating corruption
- Prefer testable functions over the stateful objects
- Prefer idempotent mutations where applicable
- Future-proof data structures that get persisted
- Always use synchronous IO for file operations - async streams add complexity and subtle bugs (flush timing, "write after end" errors). Use `appendFileSync`/`readSync` for append-only storage.
- Use `uv` and PEP723 inline dependencies for all python scripts
- Use `bun` for TypeScript
- Track 'why' each feature or test exists in REQUIREMENTS.md
- Always record what is done in STATUS.md
- Scenario IDs use proquint format (e.g., EU-bafom, NO-kidux) - pronounceable, not sequential

## concurrency

- NEVER read mutable state after an await point - state may have changed
- NEVER use mutable class variables for concurrent operations
- Either serialize with a mutex OR capture all needed state before the first await
- Pass state through closures/parameters, not mutable instance variables
- If concurrent writes are needed, use a queue or mutex to serialize access

## tests

- Create tests for each requirement (test files can reach 500 LOC)
- When writing tests, follow the "why, given, when, then" pattern.
- Integration tests: shell scripts in tests/, use tests/(testname)/ for output
- Run `bunx tsc --noEmit` after tests to check types
- Run `bash scripts/find-large-functions.sh` to find functions over 50 LOC. There are more debug utilities in this folder.


## debugging

- Keep debug logging in production code, but hide behind `MYCELIUM_DEBUG=1` env var
- Debug logging is useful for post-mortem analysis of production issues
- Pattern: `const DEBUG = process.env.MYCELIUM_DEBUG === "1";` then `if (DEBUG) console.log(...)`

