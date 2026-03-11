import { Controller, Get, Patch, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { ToggleModuleDto, PurchaseModuleDto, ModulesResponseDto, UserModuleSettingDto } from './dto/module.dto';

@Controller('api/v1/modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  /**
   * GET /api/v1/modules
   * Get all modules with user settings
   */
  @Get()
  async getModules(@Req() req: any): Promise<ModulesResponseDto> {
    const userId = req.user?.id || 'demo-user'; // TODO: Get from auth
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
    const userId = req.user?.id || 'demo-user'; // TODO: Get from auth
    return this.modulesService.toggleModule(userId, slug, dto.enabled);
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
    const userId = req.user?.id || 'demo-user'; // TODO: Get from auth
    
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
    const userId = req.user?.id || 'demo-user'; // TODO: Get from auth
    const modules = await this.modulesService.getEnabledModules(userId);
    return { modules };
  }

  /**
   * POST /api/v1/modules/:slug/subscribe
   * Subscribe user to module (called by webhook after payment)
   * Internal endpoint, should be protected
   */
  @Post(':slug/subscribe')
  async subscribeModule(
    @Param('slug') slug: string,
    @Body() body: { userId: string; bundleId?: string },
  ): Promise<UserModuleSettingDto> {
    return this.modulesService.subscribeModule(body.userId, slug, body.bundleId);
  }
}
