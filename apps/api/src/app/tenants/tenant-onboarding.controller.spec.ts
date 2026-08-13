import { Test, TestingModule } from '@nestjs/testing';
import { TenantOnboardingController } from './tenant-onboarding.controller';
import { TenantOnboardingService } from './tenant-onboarding.service';

describe('TenantOnboardingController', () => {
  let controller: TenantOnboardingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantOnboardingController],
      providers: [
        {
          provide: TenantOnboardingService,
          useValue: { register: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<TenantOnboardingController>(
      TenantOnboardingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
