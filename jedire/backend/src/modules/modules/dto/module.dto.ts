export interface ModuleDefinitionDto {
  slug: string;
  name: string;
  category: string;
  description: string;
  priceMonthly: number; // dollars (converted from cents)
  isFree: boolean;
  bundles: string[];
  icon: string;
  enhances: string[];
  sortOrder: number;
}

export interface UserModuleSettingDto {
  moduleSlug: string;
  enabled: boolean;
  subscribed: boolean;
  bundleId?: string;
  activatedAt?: Date;
}

export interface ModuleWithSettingsDto extends ModuleDefinitionDto {
  userSettings?: UserModuleSettingDto;
}

export interface ModuleCategoryDto {
  name: string;
  modules: ModuleWithSettingsDto[];
}

export interface ModulesResponseDto {
  categories: ModuleCategoryDto[];
  userBundle?: string;
}

export interface ToggleModuleDto {
  enabled: boolean;
}

export interface PurchaseModuleDto {
  paymentMethodId?: string;
}
