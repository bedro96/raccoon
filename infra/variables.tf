variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "eastus"
}

variable "project_name" {
  description = "Short name used to build resource names for this test effort."
  type        = string
  default     = "ponpoko"
}

variable "environment" {
  description = "Environment tag, e.g. test."
  type        = string
  default     = "test"
}

variable "container_image" {
  description = <<-EOT
    Full container image reference to deploy to the Container App (e.g.
    <registry>.azurecr.io/ponpoko:latest). Defaults to a public placeholder
    image so the Container App can be created before the real game image
    exists yet -- the CI/CD ticket updates this to the real built image.
  EOT
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "container_port" {
  description = "Port the container listens on (matches the containerize ticket's Dockerfile)."
  type        = number
  default     = 80
}
