import { settingsForPlan } from './tenant-onboarding.service';

describe('TenantOnboardingService', () => {
  it('maps the public plans to the metering model', () => {
    expect(settingsForPlan('free')).toMatchObject({
      planMode: 'prepaid',
      maxParticipants: 10,
    });
    expect(settingsForPlan('pro')).toMatchObject({
      planMode: 'unlimited',
      maxParticipants: 300,
    });
    expect(settingsForPlan('usage')).toMatchObject({
      planMode: 'pay_as_you_go',
      maxParticipants: null,
    });
  });
});
