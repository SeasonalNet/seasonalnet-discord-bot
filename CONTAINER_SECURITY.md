# Container security and launch contract

The Dockerfile defaults to a non-root service user. Application code, runtime
libraries, and executables are owned by root; only designated state/cache
paths are service-owned. Configuration and secrets must be supplied at runtime.

The checked-in Compose definition applies a read-only root filesystem, drops
all Linux capabilities, enables `no-new-privileges`, and supplies a writable
`/tmp` with `noexec,nosuid,nodev`. It retains Docker's default seccomp profile
and network namespace. Do not launch with privileged mode, host namespaces,
unconfined security profiles, or a Docker socket mount.

These runtime restrictions are applied when creating the container; building
or running the image alone does not enforce them. Writable data and readable
credentials remain accessible to the service if it is compromised. `noexec`
on temporary storage does not prevent an interpreter from reading scripts.
CPU, memory, and process limits are deployment policies and are intentionally
not specified here; they do not establish the application's authority boundary.

Apply the definition during the separately authorized deployment. Existing
containers are not changed by editing these files. Preserve existing site-local
configuration, credentials, proxy integration, and persistent data when adopting
it. An existing volume or bind mount must already be writable by the documented
service UID/GID; rebuilding does not change existing volume ownership.

## Service configuration

Copy `config.yaml.example` to a site-local `config.yaml` (or set
`CONFIG_FILE`) and supply the existing runtime variables in `.env`. UID/GID is
`10001:10001`; persist SQLite state at `/var/lib/seasonalnet/discord-bot`.
No ports are published; outbound Discord and configured backend access remains
available. Use `docker compose up --build -d` for the hardened launch.

## Minimal production runtime

Production images contain no shell, package manager, compiler, or download CLI.
Startup and healthchecks use executable/argument arrays. Builder and operator
stages may contain tools; those stages are not the production runtime. The
read-only filesystem, dropped capabilities, and privilege restrictions in
Compose remain required. Interpreter APIs, accessible credentials, shared
libraries, and allowed network connections remain part of the attack surface.
No outbound network restriction is implied by this image change.

After building the production image, check its actual exported filesystem:

```sh
python3 tools/container/check-image.py IMAGE
```

The checker runs outside the application image. It rejects shell-based
healthchecks, root execution, common utility binaries, unexpected executable
ELF payloads, non-root-owned application files, and selected non-service files.
It prints the image ID and executable/library inventory for review. It does not
claim that retained libraries are vulnerability-free or that every reachable
interpreter operation is safe.

The production base is digest-pinned distroless Node 22. The previous Debian
Node image remains a build/assembly input. Native addons and TLS behavior must
be tested in the final runtime after base updates.

Unit-test the inventory gate with `python3 -m unittest discover -s
tools/container -p 'test_*.py'`. The native runtime repositories include
additional dependency-discovery and runtime-exclusion tests.

## Validation (2026-10-21)

`pnpm check` and `pnpm build` passed. The repository has no existing Node
unit suite; an offline `node:test` case in the final image initialized the real
Database class, applied migrations, wrote a command audit record, closed the
database, reopened it, and verified the count. No Discord login was performed.

The final production filesystem passed the exported-image security gate. Its
negative unit tests passed (8 tests, plus 5 assembler tests for native images).
Node/Python runtime probes verified non-root execution, a read-only root,
zero effective capabilities, NoNewPrivs=1, seccomp filtering, and writable
temporary storage. State tests used disposable mounts, not production volumes.
No image build or test constitutes a deployment. No deployment was performed.

Local unpacked image size: 339.9 MiB before minimization,
233.9 MiB after. Size reduction is descriptive; the security
properties are the retained authority and executable contents.

## Functional image validation (2026-10-21)

Run `python3 tools/container/functional-check.py IMAGE`. The final image passed
actual ask-command registration/serialization and execution, deferred/edit reply
handling and Discord embed serialization, real Agent HTTP requests to a local
fixture, session metadata, SQLite command audit writes, and close/reopen.
Discord interaction objects were simulated. No gateway login, real Discord API
operation, or complete moderation workflow was exercised.

These checks use non-root containers, a read-only root filesystem, all
capabilities dropped, `no-new-privileges`, and disposable writable temporary
storage. No shell or test framework was installed into a production image.
Passing these paths is evidence of runtime compatibility, not exhaustive
workflow or production acceptance. No deployment was performed.
