import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, IsDateString, IsEnum } from 'class-validator';

export enum ProjectType {
  MULTIFAMILY = 'multifamily',
  MIXED_USE = 'mixed_use',
  OFFICE = 'office',
  RETAIL = 'retail',
  INDUSTRIAL = 'industrial',
  LAND = 'land',
}

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  boundary: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  @IsEnum(ProjectType)
  projectType: ProjectType;

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
}
