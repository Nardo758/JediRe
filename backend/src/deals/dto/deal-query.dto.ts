import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DealQueryDto {
  @IsOptional()
  @IsString()
  status?: string = 'active'; // 'active', 'archived', 'closed', 'all'

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
