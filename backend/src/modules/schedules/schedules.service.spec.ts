import { BadRequestException } from '@nestjs/common';
import {
  ApprovalDecision,
  RoleCode,
  VideoWorkflowStatus,
} from '@prisma/client';
import { SchedulesService } from './schedules.service';

describe('SchedulesService (Phase 5 Weekly Schedules & Client Approval Workflow)', () => {
  const mockPrisma: any = {
    approval: {
      create: jest.fn(),
    },
    video: {
      update: jest.fn(),
    },
    videoComment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };

  const mockClients: any = { assertClientAccess: jest.fn() };
  const mockVideos: any = { findOneWithAccess: jest.fn() };
  const mockNotifications: any = { notifyUser: jest.fn() };
  const mockAudit: any = { log: jest.fn() };

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SchedulesService(
      mockPrisma,
      mockClients,
      mockVideos,
      mockNotifications,
      mockAudit,
    );
  });

  it('should require feedbackNotes when client requests changes or rejects a video', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'v-1',
      title: 'Video Demo',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      uploadedByUserId: 'agency-user-1',
    });

    await expect(
      service.reviewVideo(
        'v-1',
        { decision: ApprovalDecision.CHANGES_REQUESTED, feedbackNotes: '' },
        {
          sub: 'client-user-1',
          email: 'cliente@kafecito.com',
          role: RoleCode.CLIENTE,
          clientId: 'c-1',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should transition video workflowStatus to APPROVED and notify the agency uploader', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'v-1',
      title: 'Receta Cold Brew',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      uploadedByUserId: 'agency-user-1',
    });
    mockPrisma.approval.create.mockResolvedValueOnce({
      id: 'app-1',
      decision: ApprovalDecision.APPROVED,
    });
    mockPrisma.video.update.mockResolvedValueOnce({
      id: 'v-1',
      workflowStatus: VideoWorkflowStatus.APPROVED,
    });

    const result = await service.reviewVideo(
      'v-1',
      {
        decision: ApprovalDecision.APPROVED,
        feedbackNotes: '¡Aprobado para las tres plataformas!',
      },
      {
        sub: 'client-user-1',
        email: 'cliente@kafecito.com',
        role: RoleCode.CLIENTE,
        clientId: 'c-1',
      },
    );

    expect(result.workflowStatus).toBe(VideoWorkflowStatus.APPROVED);
    expect(mockNotifications.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'agency-user-1',
      }),
    );
  });
});
