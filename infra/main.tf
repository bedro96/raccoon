locals {
  name_prefix = "${var.project_name}-${var.environment}"
  # ACR names must be globally unique, alphanumeric only, 5-50 chars.
  acr_name = replace("${var.project_name}${var.environment}acr", "-", "")
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location

  tags = {
    project     = var.project_name
    environment = var.environment
    purpose     = "wayfinder-harness-test"
  }
}

resource "azurerm_container_registry" "main" {
  name                = local.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true # simplest auth path for a single-tester test app; CI/CD ticket may switch to OIDC/managed identity

  tags = azurerm_resource_group.main.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = azurerm_resource_group.main.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.name_prefix}"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = azurerm_resource_group.main.tags
}

resource "azurerm_container_app" "main" {
  name                         = "ca-${local.name_prefix}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }

  template {
    # Scale-to-zero: idle cost is ~free between test sessions (map's Notes decision).
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "ponpoko"
      image  = var.container_image
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.container_port

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = azurerm_resource_group.main.tags
}
