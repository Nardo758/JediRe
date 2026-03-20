import { IsString, IsEnum, IsOptional, IsInt, IsArray, IsDateString, MaxLength } from 'class-validator';
import { TaskCategory, TaskPriority, TaskStatus } from '../tasks.entity';

export class CreateTaskDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TaskCategory)
  category: TaskCategory;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsInt()
  dealId?: number;

  @IsOptional()
  @IsInt()
  propertyId?: number;

  @IsOptional()
  @IsString()
  emailId?: string;

  @IsOptional()
  @IsInt()
  assignedToId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
