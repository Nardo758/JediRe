import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum PropertyRelationship {
  COMPARABLE = 'comparable',
  TARGET = 'target',
  COMPETITOR = 'competitor',
  OTHER = 'other',
}

export class LinkPropertyDto {
  @IsEnum(PropertyRelationship)
  @IsOptional()
  relationship?: PropertyRelationship = PropertyRelationship.COMPARABLE;

  @IsString()
  @IsOptional()
  notes?: string;
}
