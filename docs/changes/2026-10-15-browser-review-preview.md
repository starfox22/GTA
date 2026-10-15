# Automatic browser preview of the Codex review

Add a GitHub Pages workflow scoped to `codex-reviews`, so future review pushes can
update one browser link without another ZIP download. Build the existing split
game as an Actions artifact, deploy through a dedicated review environment and
verify every publicly served file's SHA-256. Keep generated files out of Git,
main unchanged and ZIP releases available. Document the one-time administrator
Pages setting and use the deployment's actual URL/status before claiming it live.
