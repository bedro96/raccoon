output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "container_registry_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "container_registry_name" {
  value = azurerm_container_registry.main.name
}

output "container_app_environment_name" {
  value = azurerm_container_app_environment.main.name
}

output "container_app_name" {
  value = azurerm_container_app.main.name
}

output "container_app_url" {
  description = "The playable game URL once a real image is deployed."
  value       = "https://${azurerm_container_app.main.ingress[0].fqdn}"
}
