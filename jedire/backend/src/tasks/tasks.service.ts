import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './tasks.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async create(createTaskDto: CreateTaskDto, userId: number): Promise<Task> {
    const task = this.tasksRepository.create({
      ...createTaskDto,
      createdById: userId,
      assignedToId: createTaskDto.assignedToId || userId, // Default to creator if not assigned
    });

    return await this.tasksRepository.save(task);
  }

  async findAll(filters?: {
    status?: TaskStatus;
    dealId?: number;
    assignedToId?: number;
    category?: string;
    priority?: string;
  }): Promise<Task[]> {
    const query = this.tasksRepository.createQueryBuilder('task')
      .leftJoinAndSelect('task.deal', 'deal')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy');

    if (filters?.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.dealId) {
      query.andWhere('task.dealId = :dealId', { dealId: filters.dealId });
    }

    if (filters?.assignedToId) {
      query.andWhere('task.assignedToId = :assignedToId', { assignedToId: filters.assignedToId });
    }

    if (filters?.category) {
      query.andWhere('task.category = :category', { category: filters.category });
    }

    if (filters?.priority) {
      query.andWhere('task.priority = :priority', { priority: filters.priority });
    }

    query.orderBy('task.dueDate', 'ASC', 'NULLS LAST')
      .addOrderBy('task.priority', 'DESC')
      .addOrderBy('task.createdAt', 'DESC');

    return await query.getMany();
  }

  async findOne(id: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['deal', 'assignedTo', 'createdBy'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: number, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    // Auto-set completedAt when moving to done
    if (updateTaskDto.status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      updateTaskDto['completedAt'] = new Date();
    }

    Object.assign(task, updateTaskDto);
    return await this.tasksRepository.save(task);
  }

  async remove(id: number): Promise<void> {
    const task = await this.findOne(id);
    await this.tasksRepository.remove(task);
  }

  async findByDeal(dealId: number): Promise<Task[]> {
    return await this.findAll({ dealId });
  }

  async findByAssignee(assignedToId: number): Promise<Task[]> {
    return await this.findAll({ assignedToId });
  }

  async getStats(userId?: number): Promise<{
    total: number;
    byStatus: Record<string, number>;
    overdue: number;
    dueToday: number;
    dueSoon: number;
  }> {
    const query = this.tasksRepository.createQueryBuilder('task');

    if (userId) {
      query.where('task.assignedToId = :userId', { userId });
    }

    const tasks = await query.getMany();
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const byStatus = {
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
      cancelled: 0,
    };

    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0;

    for (const task of tasks) {
      byStatus[task.status]++;

      if (task.dueDate && task.status !== TaskStatus.DONE) {
        const dueDate = new Date(task.dueDate);
        if (dueDate < today) {
          overdue++;
        } else if (dueDate < tomorrow) {
          dueToday++;
        } else if (dueDate < nextWeek) {
          dueSoon++;
        }
      }
    }

    return {
      total: tasks.length,
      byStatus,
      overdue,
      dueToday,
      dueSoon,
    };
  }
}
