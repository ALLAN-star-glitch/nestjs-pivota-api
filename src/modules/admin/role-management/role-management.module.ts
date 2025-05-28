import { Module } from '@nestjs/common';
import { RoleManagementService } from './role-management.service';
import { RoleManagementController } from './role-management.controller';

@Module({
  providers: [RoleManagementService],
  controllers: [RoleManagementController]
})
export class RoleManagementModule {}
