output "medusa_url" {
  value = aws_ecs_service.medusa_service.network_configuration[0].assign_public_ip
}