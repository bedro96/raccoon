# Deploy via Azure Container Registry, azd/Bicep, and GitHub Actions with OIDC

We considered GHCR vs. ACR for the container registry, and Terraform vs. Azure Developer CLI (`azd`)
for infrastructure-as-code, and chose ACR + `azd`. ACR keeps the registry in Azure so Azure Container
Apps can pull images via managed identity with no extra credentials to manage — GHCR would require a
PAT or service principal wired into Container Apps. `azd` wraps Bicep (still the underlying IaC
language) and provides first-class Container Apps + Next.js-compatible templates via a single
`azure.yaml` + `infra/` folder, avoiding the extra state-management overhead of a standalone Terraform
setup for a single-environment private project.

CI/CD is a GitHub Actions workflow triggered on push to `main`: build the Docker image (per the
multi-stage Dockerfile), push it to ACR, then `azd deploy` (or `az containerapp update`) to roll out
the new image as a Container Apps revision. GitHub Actions authenticates to Azure via OIDC federated
credentials scoped to the resource group — no long-lived secrets stored in the repo.

This is hard to reverse once the pipeline, registry, and IaC are built against this toolchain, and a
reasonable reader might expect Terraform (the more common IaC choice industry-wide) — hence recording
the rejection here.

Decided in [Choosing Azure Container Apps deployment pipeline](https://github.com/bedro96/raccoon/issues/5).
