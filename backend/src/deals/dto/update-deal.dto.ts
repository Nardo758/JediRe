import { IsString, IsOptional, IsNumber, IsObject, IsEnum } from 'class-validator';

export enum DealStatus {
  PROSPECT = 'PROSPECT',
  UNDERWRITING = 'UNDERWRITING',
  UNDER_CONTRACT = 'UNDER_CONTRACT',
  CLOSED_OWNED = 'CLOSED_OWNED',
  MONITORING = 'MONITORING',
  DISPOSITION = 'DISPOSITION',
  SOLD = 'SOLD',
  HISTORICAL_RECORD = 'HISTORICAL_RECORD',
  PASSED = 'PASSED',
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
  projectType?: string;

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
