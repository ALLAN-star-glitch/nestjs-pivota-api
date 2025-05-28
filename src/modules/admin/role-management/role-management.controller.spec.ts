import { Test, TestingModule } from '@nestjs/testing';
import { RoleManagementController } from './role-management.controller';

describe('RoleManagementController', () => {
  let controller: RoleManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleManagementController],
    }).compile();

    controller = module.get<RoleManagementController>(RoleManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
