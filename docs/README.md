# Jenkins vs GitHub Actions for Zuri Market

## Decision

We chose **GitHub Actions** as the CI/CD platform for Zuri Market.

## Context

Zuri Market is a three-developer team. The code already lives on GitHub, there is no dedicated platform or operations staff, and the budget is tight. The previous failure (everyone pushing to `main`, a bad release, a six-hour outage) came from a missing review and test gate, so whatever we choose must make that gate hard to bypass and cheap to maintain.

Our pipeline has two workflows:

- `ci.yml` runs on every pull request: lint, tests, `npm audit`, a SonarQube quality gate, and a Trivy scan of the built image.
- `cd.yml` runs on merge to `main`: it rescans the image and publishes it to GHCR only if the scan passes.

## Comparison

| Criterion | Jenkins | GitHub Actions | Better for Zuri |
|---|---|---|---|
| Who runs it | We install, patch and back up the controller and agents | GitHub runs it | **Actions.** No platform team to own a server |
| Time to first pipeline | Install, plugins, credentials, webhooks | One YAML file in the repo works on the first push | **Actions** |
| Git integration | Through plugins and webhooks | Native: PR checks, required status checks, branch rulesets | **Actions** |
| Pipeline as code | `Jenkinsfile`, plus some UI and plugin configuration | YAML in the repo only | **Actions**, slightly |
| Secrets | Credentials plugin on our own server | Repository secrets, short-lived `GITHUB_TOKEN` per job | **Actions** |
| Ecosystem | Very large plugin ecosystem; each plugin is something to secure and update | Marketplace of actions; supply-chain risk (see below) | Tie |
| Cost | Server cost plus maintenance time | Free minutes for public repositories; per-minute pricing beyond the free tier for private ones | **Actions** at three developers |
| Ceiling | Very strong for complex, on-premises or highly customised needs | Enough for most teams; self-hosted runners exist | Revisit if needs grow |

## Reasons, in order of weight

1. **No server to run.** Jenkins is a service we would have to host, patch, secure and back up. With three developers and no operations staff, that is ongoing work with no product value, and a neglected Jenkins server is itself a security risk.
2. **It enforces the gate that was missing.** The branch ruleset on `main` requires the CI checks to pass before a merge. Because the checks are native GitHub status checks, "merged to main" means "the security checks passed". With Jenkins this works through webhooks and plugins, which is another thing that can silently break.
3. **Fast to build and easy to review.** Our pipeline is YAML in the same repository, changed through the same pull request process as the code. We went from nothing to a working pipeline in one repository, with no separate system to configure.
4. **Least-privilege by default.** Workflows run with a read-only token, and only the publish job is granted `packages: write`. Images go to GHCR with the built-in `GITHUB_TOKEN`, so no long-lived registry credentials exist to leak.
5. **Cost.** Our repository is public, so runner minutes are free. Jenkins would add a server bill and maintenance time.

## What we saw in practice

- **The pipeline can fail, and did.** The first run failed at the SonarQube step on an organization-key mistake, and the next run failed at Trivy on real findings (10 HIGH in the backend image, 3 HIGH in the frontend image). Both were visible directly on the pull request, and nothing was published.
- **Matrix builds** let one job definition cover both the backend and the frontend.
- **Caching** of npm packages and Docker layers was a one-line setting.

## Trade-offs we accepted

- **Marketplace supply-chain risk.** Third-party actions run with access to the job. In March 2026 the Trivy action was compromised when attackers rewrote its version tags, so workflows pinned to a tag ran malicious code. We mitigate this by pinning third-party actions to **full commit SHAs**, using only a few actions, and enabling Dependabot to propose reviewed updates. We still need to verify that our pinned Trivy commit belongs to a clean release.
- **Vendor lock-in.** Workflows are written for GitHub, so moving platforms later means rewriting them. Because the steps are plain commands (`npm`, `docker`, `trivy`), the rewrite would be modest.
- **Less customisation than Jenkins.** We do not need what Jenkins does best: heavy bespoke pipelines, on-premises builds, or custom agent fleets.

## When we would revisit this decision

- Builds need to run on-premises or inside a private network that GitHub-hosted runners cannot reach (a self-hosted runner may solve this first).
- The team grows, or private-repository minutes become a significant cost.
- We need highly customised pipelines or a central CI platform shared by many teams.
- We leave GitHub as our source host.

## Conclusion

Zuri is a three-developer team on GitHub with no dedicated operations staff. The managed, in-repository, pull-request-integrated model of GitHub Actions removes a server we cannot afford to maintain, enforces the review-and-scan gate that the old process lacked, and was the fastest way to a working, secure pipeline. Jenkins becomes attractive only if Zuri later needs heavy customisation or on-premises builds. Until then, GitHub Actions is the right tool.