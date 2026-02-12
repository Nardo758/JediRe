import { IsString, IsOptional, IsNumber, IsObject, IsEnum } from 'class-validator';

export enum DealStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  CLOSED = 'closed',
}

export class UpdateDealDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  boundary?: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  @IsString()
  @IsOptional()
  projectIntent?: string;

  @IsNumber()
  @IsOptional()
  budget?: number;

  @IsEnum(DealStatus)
  @IsOptional()
  status?: DealStatus;
}
