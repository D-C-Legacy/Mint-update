import { Injectable, OnModuleInit } from '@nestjs/common';
import { TemplateRegistry } from '../../../notifications/application/template-registry.service';
import { SellerTeamRole } from '../../domain/entities/seller-team.entity';
import { RenderedEmailContent } from '../../../notifications/domain/entities/notification-template.entity';

const TEAM_INVITATION_TEMPLATE_KEY = 'seller.team.invitation';

interface InvitationEmailData {
  sellerName: string;
  inviterName: string;
  role: SellerTeamRole;
  roleLabel: string;
  acceptUrl: string;
  expiresAt: string;
}

@Injectable()
export class TeamInvitationTemplateRegistrar implements OnModuleInit {
  constructor(private readonly templates: TemplateRegistry) {}

  onModuleInit(): void {
    this.templates.register({
      key: TEAM_INVITATION_TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data: Record<string, unknown>): RenderedEmailContent => {
        const d = data as unknown as InvitationEmailData;
        return {
          subject: `You're invited to join ${d.sellerName} as ${d.roleLabel}`,
          body: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h1 style="color: #111; font-size: 24px; margin-bottom: 16px;">You're invited to join a seller team</h1>
              <p style="color: #333; font-size: 16px; line-height: 1.5;">
                <strong>${d.inviterName}</strong> invited you to join <strong>${d.sellerName}</strong> as a <strong>${d.roleLabel}</strong>.
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.5;">
                Click the button below to accept the invitation and access the seller portal.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${d.acceptUrl}" style="display: inline-block; background-color: #0066CC; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #666; font-size: 14px; line-height: 1.5;">
                This invitation expires on ${d.expiresAt}. If you didn't expect this invitation, you can ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">
                This email was sent from Swish. If you have questions, contact support.
              </p>
            </div>
          `,
        };
      },
    });
  }
}
