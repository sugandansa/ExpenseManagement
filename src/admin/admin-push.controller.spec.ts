import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { AdminPushController } from './admin-push.controller';

describe('AdminPushController', () => {
  const user = { id: 1, name: 'Admin', role: 'admin', department: null, phone: '9876543210', sessionId: 1 };
  const subscription = {
    endpoint: 'https://push.example.com/subscription',
    keys: { p256dh: 'public', auth: 'secret' },
  };

  it('saves an authenticated user subscription', async () => {
    const prisma = {
      pushSubscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 4 }),
      },
    };
    const controller = new AdminPushController(prisma as never, {} as never);
    await expect(controller.save(subscription, user)).resolves.toMatchObject({
      data: { subscriptionId: 4, status: 'ACTIVE' },
    });
    expect(prisma.pushSubscription.create).toHaveBeenCalledWith({
      data: { userId: 1, endpoint: subscription.endpoint, p256dh: 'public', auth: 'secret' },
    });
  });

  it('does not allow another user to claim or delete a subscription', async () => {
    const prisma = {
      pushSubscription: { findUnique: jest.fn().mockResolvedValue({ id: 4, userId: 2 }), deleteMany: jest.fn() },
    };
    const controller = new AdminPushController(prisma as never, {} as never);
    await expect(controller.save(subscription, user)).rejects.toBeInstanceOf(ConflictException);
    await controller.remove({ endpoint: subscription.endpoint }, user);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, endpoint: subscription.endpoint },
    });
  });

  it('fails clearly when no public key is configured', () => {
    const controller = new AdminPushController({} as never, { get: () => undefined } as never);
    expect(() => controller.publicKey()).toThrow(ServiceUnavailableException);
  });
});
