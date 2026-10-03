#!/bin/sh
# autovibe-rator sandbox entrypoint.
# The harness mounts the prepared workspace at /workspace/run and the
# prompt file at /input/prompt.md; the agent runs inside the container.
#
# --trust: load the cloned repo's AGENTS.md guidance. Safe here: project
#   config can only execute inside this container.
# --auto-approve: nobody can answer approval prompts in a one-shot run;
#   the container sandbox IS the approval boundary.
set -e

exec vibe -p --trust --auto-approve --workdir /workspace/run < /input/prompt.md
