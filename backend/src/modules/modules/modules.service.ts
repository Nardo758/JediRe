import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ModuleDefinitionDto,
  UserModuleSettingDto,
  ModuleWithSettingsDto,
  ModuleCategoryDto,
  ModulesResponseDto,
} from './dto/module.dto';

@Injectable()
export class ModulesService {
  constructor(
    @nestjs/typeorm'@InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all module definitions with user settings
   */
  async getModules(userId: string): Promise<ModulesResponseDto> {
    // Get all module definitions
    const modulesQuery = `
      SELECT 
        slug,
        name,
        category,
        description,
        price_monthly,
        is_free,
        bundles,
        icon,
        enhances,
        sort_order
      FROM module_definitions
      ORDER BY category, sort_order
    `;
    
    const modules = await this.dataSource.query(modulesQuery);

    // Get user's module settings
    const settingsQuery = `
      SELECT 
        module_slug,
        enabled,
        subscribed,
        bundle_id,
        activated_at
      FROM user_module_settings
      WHERE user_id = $1
    `;
    
    const settings = await this.dataSource.query(settingsQuery, [userId]);
    
    // Create settings map
    const settingsMap = new Map<string, UserModuleSettingDto>();
    settings.forEach((s: any) => {
      settingsMap.set(s.module_slug, {
        moduleSlug: s.module_slug,
        enabled: s.enabled,
        subscribed: s.subscribed,
        bundleId: s.bundle_id,
        activatedAt: s.activated_at,
      });
    });

    // Get user's bundle (from first subscribed module)
    const userBundle = settings.find((s: any) => s.subscribed && s.bundle_id)?.bundle_id;

    // Group modules by category
    const categoriesMap = new Map<string, ModuleWithSettingsDto[]>();
    
    modules.forEach((m: any) => {
      const module: ModuleWithSettingsDto = {
        slug: m.slug,
        name: m.name,
        category: m.category,
        description: m.description,
        priceMonthly: m.price_monthly / 100, // Convert cents to dollars
        isFree: m.is_free,
        bundles: m.bundles,
        icon: m.icon,
        enhances: m.enhances,
        sortOrder: m.sort_order,
        userSettings: settingsMap.get(m.slug),
      };

      if (!categoriesMap.has(m.category)) {
        categoriesMap.set(m.category, []);
      }
      categoriesMap.get(m.category)!.push(module);
    });

    // Convert to array of categories
    const categories: ModuleCategoryDto[] = Array.from(categoriesMap.entries()).map(
      ([name, modules]) => ({
        name,
        modules,
      }),
    );

    return {
      categories,
      userBundle,
    };
  }

  /**
   * Toggle module enabled/disabled
   */
  async toggleModule(
    userId: string,
    moduleSlug: string,
    enabled: boolean,
  ): Promise<UserModuleSettingDto> {
    // Check if module exists
    const moduleExists = await this.dataSource.query(
      'SELECT slug FROM module_definitions WHERE slug = $1',
      [moduleSlug],
    );

    if (!moduleExists || moduleExists.length === 0) {
      throw new Error('Module not found');
    }

    // Upsert user module setting
    const query = `
      INSERT INTO user_module_settings (user_id, module_slug, enabled, activated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, module_slug)
      DO UPDATE SET
        enabled = $3,
        activated_at = CASE 
          WHEN $3 = true AND user_module_settings.activated_at IS NULL 
          THEN $4 
          ELSE user_module_settings.activated_at 
        END,
        updated_at = NOW()
      RETURNING module_slug, enabled, subscribed, bundle_id, activated_at
    `;

    const now = enabled ? new Date() : null;
    const result = await this.dataSource.query(query, [
      userId,
      moduleSlug,
      enabled,
      now,
    ]);

    const row = result[0];
    return {
      moduleSlug: row.module_slug,
      enabled: row.enabled,
      subscribed: row.subscribed,
      bundleId: row.bundle_id,
      activatedAt: row.activated_at,
    };
  }

  /**
   * Check if user has module enabled
   */
  async hasModule(userId: string, moduleSlug: string): Promise<boolean> {
    const query = `
      SELECT enabled
      FROM user_module_settings
      WHERE user_id = $1 AND module_slug = $2 AND enabled = true
    `;
    
    const result = await this.dataSource.query(query, [userId, moduleSlug]);
    return result.length > 0;
  }

  /**
   * Get user's enabled modules
   */
  async getEnabledModules(userId: string): Promise<string[]> {
    const query = `
      SELECT module_slug
      FROM user_module_settings
      WHERE user_id = $1 AND enabled = true
    `;
    
    const result = await this.dataSource.query(query, [userId]);
    return result.map((r: any) => r.module_slug);
  }

  /**
   * Subscribe user to module (called after successful payment)
   */
  async subscribeModule(
    userId: string,
    moduleSlug: string,
    bundleId?: string,
  ): Promise<UserModuleSettingDto> {
    const query = `
      INSERT INTO user_module_settings (user_id, module_slug, enabled, subscribed, bundle_id, activated_at)
      VALUES ($1, $2, true, true, $3, NOW())
      ON CONFLICT (user_id, module_slug)
      DO UPDATE SET
        subscribed = true,
        enabled = true,
        bundle_id = $3,
        activated_at = COALESCE(user_module_settings.activated_at, NOW()),
        updated_at = NOW()
      RETURNING module_slug, enabled, subscribed, bundle_id, activated_at
    `;

    const result = await this.dataSource.query(query, [userId, moduleSlug, bundleId]);
    const row = result[0];
    
    return {
      moduleSlug: row.module_slug,
      enabled: row.enabled,
      subscribed: row.subscribed,
      bundleId: row.bundle_id,
      activatedAt: row.activated_at,
    };
  }

  /**
   * Subscribe user to bundle (multiple modules at once)
   */
  async subscribeBundle(userId: string, bundleId: string): Promise<void> {
    // Get all modules in this bundle
    const modulesQuery = `
      SELECT slug
      FROM module_definitions
      WHERE $1 = ANY(bundles)
    `;
    
    const modules = await this.dataSource.query(modulesQuery, [bundleId]);

    // Subscribe to all modules in bundle
    const promises = modules.map((m: any) =>
      this.subscribeModule(userId, m.slug, bundleId),
    );

    await Promise.all(promises);
  }
}
