# Azure OIDC setup for GitHub Actions

This repository deploys to Azure Container Apps with GitHub Actions using OIDC federation (no client
secret in the repo).

## 1) Create an Entra app registration

Create (or reuse) an app registration and capture:

- Application (client) ID
- Directory (tenant) ID
- Subscription ID

## 2) Add federated credentials for this repository

In the app registration, add federated credentials for GitHub Actions with:

- **Issuer**: `https://token.actions.githubusercontent.com`
- **Subject**: `repo:bedro96/raccoon:ref:refs/heads/main`
- **Audience**: `api://AzureADTokenExchange`

## 3) Grant role assignments

Assign the app registration principal these roles on the target resource group used by `azd`:

- `Contributor`
- `User Access Administrator` (required so `azd provision` can create the ACR Pull role assignment for
  the Container App managed identity)

## 4) Configure GitHub repository variables

Set these repository variables in GitHub Actions settings:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_ENV_NAME` (for example `prod`)
- `AZURE_LOCATION` (for example `eastus`)

## 5) First deployment

Push to `main` to trigger `.github/workflows/azure-containerapps.yml`.

The workflow will:

1. initialize/select the `azd` environment (bootstrapping infra once only if needed to create ACR),
2. build and push the Docker image to ACR,
3. set `containerImage` in the `azd` environment and run `azd provision` to deploy that image.

After success, fetch the production URL from the Container App:

```bash
az containerapp show \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

The application is available at `https://<fqdn>`.
