import { PrismaService } from './prisma.service';

describe('PrismaService (Phase 1 Schema & DB Base)', () => {
  it('should instantiate PrismaService with all 3NF models exposed', () => {
    const prisma = new PrismaService();
    expect(prisma).toBeDefined();
    expect(prisma.role).toBeDefined();
    expect(prisma.user).toBeDefined();
    expect(prisma.authSession).toBeDefined();
    expect(prisma.socialAuthAccount).toBeDefined();
    expect(prisma.agency).toBeDefined();
    expect(prisma.client).toBeDefined();
    expect(prisma.schedule).toBeDefined();
    expect(prisma.scheduleItem).toBeDefined();
    expect(prisma.scheduleItemMedia).toBeDefined();
    expect(prisma.blockReview).toBeDefined();
    expect(prisma.blockComment).toBeDefined();
    expect(prisma.notification).toBeDefined();
    expect(prisma.auditLog).toBeDefined();
  });
});
