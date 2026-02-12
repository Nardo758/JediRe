import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, IsDateString, IsEnum, IsIn } from 'class-validator';

export enum ProjectType {
  MULTIFAMILY = 'multifamily',
  MIXED_USE = 'mixed_use',
  OFFICE = 'office',
  RETAIL = 'retail',
  INDUSTRIAL = 'industrial',
  LAND = 'land',
}

export enum DealCategory {
  PORTFOLIO = 'portfolio',
  PIPELINE = 'pipeline',
}

export enum DevelopmentType {
  NEW = 'new',
  EXISTING = 'existing',
}

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  boundary: {
    type: 'Polygon' | 'Point';
    coordinates: number[][][] | number[];
  };

  @IsEnum(ProjectType)
  @IsOptional()
  projectType?: ProjectType;

  @IsString()
  @IsOptional()
  projectIntent?: string;

  @IsNumber()
  @IsOptional()
  targetUnits?: number;

  @IsNumber()
  @IsOptional()
  budget?: number;

  @IsDateString()
  @IsOptional()
  timelineStart?: string;

  @IsDateString()
  @IsOptional()
  timelineEnd?: string;

  // New fields
  @IsEnum(DealCategory)
  @IsNotEmpty()
  deal_category: DealCategory;

  @IsEnum(DevelopmentType)
  @IsNotEmpty()
  development_type: DevelopmentType;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['basic', 'pro', 'enterprise'])
  @IsOptional()
  tier?: string;
}
