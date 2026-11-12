import { Controller, Get, Patch, Post, Param, Body, Req, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { ToggleModuleDto, PurchaseModuleDto, ModulesResponseDto, UserModuleSettingDto } from './dto/module.dto';

function sessionUserId(req: { user?: { userId?: string; id?: string } }): string | null {
  const id = req.user?.userId ?? req.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

@Controller('api/v1/modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  private requireSession(req: { user?: { userId?: string; id?: string } }): string {
    const userId = sessionUserId(req);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }

  /**
   * GET /api/v1/modules
   * Get all modules with user settings
   */
  @Get()
  async getModules(@Req() req: any): Promise<ModulesResponseDto> {
    const userId = this.requireSession(req);
    return this.modulesService.getModules(userId);
  }

  /**
   * PATCH /api/v1/modules/:slug/toggle
   * Toggle module enabled/disabled
   */
  @Patch(':slug/toggle')
  async toggleModule(
    @Param('slug') slug: string,
    @Body() dto: ToggleModuleDto,
    @Req() req: any,
  ): Promise<UserModuleSettingDto> {
    const userId = this.requireSession(req);
    try {
      return await this.modulesService.toggleModule(userId, slug, dto.enabled);
    } catch (err: any) {
      if (err?.message === 'Module not found') {
        throw new NotFoundException('Module not found');
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/modules/:slug/purchase
   * Purchase module (initiates Stripe checkout)
   * TODO: Integrate with Stripe
   */
  @Post(':slug/purchase')
  async purchaseModule(
    @Param('slug') slug: string,
    @Body() dto: PurchaseModuleDto,
    @Req() req: any,
  ): Promise<{ success: boolean; checkoutUrl?: string }> {
    const userId = this.requireSession(req);

    // TODO: Create Stripe checkout session
    // For now, just return success (development mode)
    console.log(`[ModulesController] Purchase request for ${slug} by user ${userId}`);
    
    return {
      success: true,
      checkoutUrl: '/settings/billing', // Placeholder
    };
  }

  /**
   * GET /api/v1/modules/enabled
   * Get user's enabled modules (for quick checks)
   */
  @Get('enabled')
  async getEnabledModules(@Req() req: any): Promise<{ modules: string[] }> {
    const userId = this.requireSession(req);
    const modules = await this.modulesService.getEnabledModules(userId);
    return { modules };
  }

  /**
   * POST /api/v1/modules/:slug/subscribe
   * Subscribe user to module (called by webhook after payment).
   * The target user is the webhook body. This path never used the demo-user
   * fallback. It still needs its own auth review before it is treated as public.
   */
  @Post(':slug/subscribe')
  async subscribeModule(
    @Param('slug') slug: string,
    @Body() body: { userId: string; bundleId?: string },
  ): Promise<UserModuleSettingDto> {
    return this.modulesService.subscribeModule(body.userId, slug, body.bundleId);
  }
}
