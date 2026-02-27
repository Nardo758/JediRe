import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto, UpdateDealDto, DealQueryDto, LinkPropertyDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/v1/deals')
@UseGuards(AuthGuard)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  /**
   * POST /api/v1/deals
   * Create a new deal
   */
  @Post()
  async create(@Request() req, @Body() createDealDto: CreateDealDto) {
    return this.dealsService.create(req.user.userId, createDealDto);
  }

  /**
   * GET /api/v1/deals
   * Get all deals for current user
   */
  @Get()
  async findAll(@Request() req, @Query() query: DealQueryDto) {
    return this.dealsService.findAll(req.user.userId, query);
  }

  /**
   * GET /api/v1/deals/:id
   * Get a single deal
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.dealsService.findOne(id, req.user.userId);
  }

  /**
   * PATCH /api/v1/deals/:id
   * Update a deal
   */
  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDealDto: UpdateDealDto,
  ) {
    return this.dealsService.update(id, req.user.userId, updateDealDto);
  }

  /**
   * DELETE /api/v1/deals/:id
   * Archive a deal
   */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.dealsService.remove(id, req.user.userId);
  }

  /**
   * GET /api/v1/deals/:id/modules
   * Get enabled modules for a deal
   */
  @Get(':id/modules')
  async getModules(@Request() req, @Param('id') id: string) {
    return this.dealsService.getModules(id, req.user.userId);
  }

  /**
   * GET /api/v1/deals/:id/properties
   * Get properties within deal boundary
   */
  @Get(':id/properties')
  async getProperties(
    @Request() req,
    @Param('id') id: string,
    @Query() filters: any,
  ) {
    return this.dealsService.getProperties(id, req.user.userId, filters);
  }

  /**
   * POST /api/v1/deals/:id/properties/:propertyId
   * Link a property to a deal
   */
  @Post(':id/properties/:propertyId')
  async linkProperty(
    @Request() req,
    @Param('id') id: string,
    @Param('propertyId') propertyId: string,
    @Body() dto: LinkPropertyDto,
  ) {
    return this.dealsService.linkProperty(
      id,
      req.user.userId,
      propertyId,
      dto.relationship,
    );
  }

  /**
   * GET /api/v1/deals/:id/pipeline
   * Get pipeline status for a deal
   */
  @Get(':id/pipeline')
  async getPipeline(@Request() req, @Param('id') id: string) {
    return this.dealsService.getPipeline(id, req.user.userId);
  }

  /**
   * PATCH /api/v1/deals/:id/pipeline/stage
   * Update pipeline stage
   */
  @Patch(':id/pipeline/stage')
  async updatePipelineStage(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { stage: string },
  ) {
    return this.dealsService.updatePipelineStage(
      id,
      req.user.userId,
      body.stage,
    );
  }

  /**
   * GET /api/v1/deals/:id/analysis/latest
   * Get latest analysis for a deal
   */
  @Get(':id/analysis/latest')
  async getLatestAnalysis(@Request() req, @Param('id') id: string) {
    return this.dealsService.getLatestAnalysis(id, req.user.userId);
  }

  /**
   * POST /api/v1/deals/:id/analysis/trigger
   * Trigger new analysis
   */
  @Post(':id/analysis/trigger')
  async triggerAnalysis(@Request() req, @Param('id') id: string) {
    const result = await this.dealsService.triggerAnalysis(id, req.user.userId);
    return result;
  }

  /**
   * GET /api/v1/deals/:id/activity
   * Get activity feed for a deal
   */
  @Get(':id/activity')
  async getActivity(
    @Request() req,
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.dealsService.getActivity(id, req.user.userId, limit);
  }

  /**
   * GET /api/v1/deals/:id/timeline
   * Get timeline events for a deal
   */
  @Get(':id/timeline')
  async getTimeline(@Request() req, @Param('id') id: string) {
    return this.dealsService.getTimeline(id, req.user.userId);
  }

  /**
   * GET /api/v1/deals/:id/key-moments
   * Get key moments for a deal
   */
  @Get(':id/key-moments')
  async getKeyMoments(@Request() req, @Param('id') id: string) {
    return this.dealsService.getKeyMoments(id, req.user.userId);
  }

  /**
   * POST /api/v1/deals/:id/triage
   * Run auto-triage on a deal
   */
  @Post(':id/triage')
  async triageDeal(@Request() req, @Param('id') id: string) {
    return this.dealsService.triageDeal(id, req.user.userId);
  }

  /**
   * GET /api/v1/deals/:id/triage
   * Get triage result for a deal
   */
  @Get(':id/triage')
  async getTriageResult(@Request() req, @Param('id') id: string) {
    return this.dealsService.getTriageResult(id, req.user.userId);
  }

  /**
   * GET /api/v1/deals/:id/project-management/overview
   * Get unified project management overview (consolidates timeline + DD)
   */
  @Get(':id/project-management/overview')
  async getProjectManagementOverview(@Request() req, @Param('id') id: string) {
    return this.dealsService.getProjectManagementOverview(id, req.user.userId);
  }

  /**
   * GET /api/v1/deals/:id/investment-strategy/overview
   * Get unified investment strategy (consolidates strategy + exit)
   * Returns: strategy type, execution status, projected exit timeline
   */
  @Get(':id/investment-strategy/overview')
  async getInvestmentStrategyOverview(@Request() req, @Param('id') id: string) {
    return this.dealsService.getInvestmentStrategyOverview(id, req.user.userId);
  }
}
