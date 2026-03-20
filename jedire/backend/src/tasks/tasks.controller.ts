import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TaskStatus } from './tasks.entity';

@Controller('api/v1/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    return this.tasksService.create(createTaskDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('status') status?: TaskStatus,
    @Query('dealId') dealId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
  ) {
    const filters = {
      status,
      dealId: dealId ? parseInt(dealId) : undefined,
      assignedToId: assignedToId ? parseInt(assignedToId) : undefined,
      category,
      priority,
    };

    return this.tasksService.findAll(filters);
  }

  @Get('stats')
  getStats(@Request() req, @Query('userId') userId?: string) {
    const targetUserId = userId ? parseInt(userId) : req.user.userId;
    return this.tasksService.getStats(targetUserId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(+id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(+id);
  }
}
