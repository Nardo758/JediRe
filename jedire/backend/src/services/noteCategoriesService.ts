/**
 * Note Categories Service
 * Manages user-defined and system categories for organizing notes
 */

import { PoolClient } from 'pg';
import { logger } from '../utils/logger';
import {
  NoteCategory,
  CreateNoteCategoryInput,
  UpdateNoteCategoryInput,
} from '../types/assetMapIntelligence.types';

class NoteCategoriesService {
  /**
   * Get all categories (system + user's custom)
   */
  async getCategories(client: PoolClient, userId: string): Promise<NoteCategory[]> {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          organization_id,
          name,
          color,
          icon,
          is_system_default,
          display_order,
          created_at
        FROM note_categories
        WHERE is_system_default = true 
           OR user_id = $1
           OR user_id IS NULL
        ORDER BY is_system_default DESC, display_order ASC, name ASC
      `;

      const result = await client.query(query, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        isSystemDefault: row.is_system_default,
        displayOrder: row.display_order,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      logger.error('Error fetching note categories:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Get a specific category by ID
   */
  async getCategoryById(client: PoolClient, categoryId: string): Promise<NoteCategory | null> {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          organization_id,
          name,
          color,
          icon,
          is_system_default,
          display_order,
          created_at
        FROM note_categories
        WHERE id = $1
      `;

      const result = await client.query(query, [categoryId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        isSystemDefault: row.is_system_default,
        displayOrder: row.display_order,
        createdAt: new Date(row.created_at),
      };
    } catch (error) {
      logger.error('Error fetching category by ID:', error);
      throw new Error('Failed to fetch category');
    }
  }

  /**
   * Create a custom category
   */
  async createCategory(
    client: PoolClient,
    input: CreateNoteCategoryInput
  ): Promise<NoteCategory> {
    try {
      // Validate input
      if (!input.name || input.name.trim().length === 0) {
        throw new Error('Category name is required');
      }

      if (input.name.length > 100) {
        throw new Error('Category name must be 100 characters or less');
      }

      // Check for duplicate name
      const duplicateCheck = await client.query(
        `
        SELECT id FROM note_categories
        WHERE user_id = $1 
          AND COALESCE(organization_id::text, '') = COALESCE($2, '')
          AND name = $3
      `,
        [input.userId, input.organizationId || null, input.name.trim()]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error('A category with this name already exists');
      }

      // Insert category
      const query = `
        INSERT INTO note_categories (
          user_id,
          organization_id,
          name,
          color,
          icon,
          is_system_default,
          display_order
        ) VALUES ($1, $2, $3, $4, $5, false, 999)
        RETURNING *
      `;

      const result = await client.query(query, [
        input.userId || null,
        input.organizationId || null,
        input.name.trim(),
        input.color || '#6B7280',
        input.icon || '📝',
      ]);

      const row = result.rows[0];

      logger.info(`Category created: ${row.id} - ${row.name}`);

      return {
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        isSystemDefault: row.is_system_default,
        displayOrder: row.display_order,
        createdAt: new Date(row.created_at),
      };
    } catch (error: any) {
      logger.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Update a category
   */
  async updateCategory(
    client: PoolClient,
    categoryId: string,
    userId: string,
    input: UpdateNoteCategoryInput
  ): Promise<NoteCategory> {
    try {
      // Check if category exists and user owns it
      const existing = await this.getCategoryById(client, categoryId);

      if (!existing) {
        throw new Error('Category not found');
      }

      if (existing.isSystemDefault) {
        throw new Error('Cannot modify system default categories');
      }

      if (existing.userId !== userId) {
        throw new Error('Not authorized to update this category');
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.name !== undefined) {
        if (input.name.trim().length === 0) {
          throw new Error('Category name cannot be empty');
        }
        if (input.name.length > 100) {
          throw new Error('Category name must be 100 characters or less');
        }
        updates.push(`name = $${paramIndex}`);
        params.push(input.name.trim());
        paramIndex++;
      }

      if (input.color !== undefined) {
        updates.push(`color = $${paramIndex}`);
        params.push(input.color);
        paramIndex++;
      }

      if (input.icon !== undefined) {
        updates.push(`icon = $${paramIndex}`);
        params.push(input.icon);
        paramIndex++;
      }

      if (input.displayOrder !== undefined) {
        updates.push(`display_order = $${paramIndex}`);
        params.push(input.displayOrder);
        paramIndex++;
      }

      if (updates.length === 0) {
        return existing; // No changes
      }

      params.push(categoryId);

      const query = `
        UPDATE note_categories
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, params);
      const row = result.rows[0];

      logger.info(`Category updated: ${categoryId}`);

      return {
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        isSystemDefault: row.is_system_default,
        displayOrder: row.display_order,
        createdAt: new Date(row.created_at),
      };
    } catch (error: any) {
      logger.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(client: PoolClient, categoryId: string, userId: string): Promise<void> {
    try {
      // Check if category exists and user owns it
      const existing = await this.getCategoryById(client, categoryId);

      if (!existing) {
        throw new Error('Category not found');
      }

      if (existing.isSystemDefault) {
        throw new Error('Cannot delete system default categories');
      }

      if (existing.userId !== userId) {
        throw new Error('Not authorized to delete this category');
      }

      // Check if category is in use
      const usageCheck = await client.query(
        `SELECT COUNT(*) as count FROM asset_notes WHERE category_id = $1`,
        [categoryId]
      );

      const notesUsingCategory = parseInt(usageCheck.rows[0].count);

      if (notesUsingCategory > 0) {
        throw new Error(
          `Cannot delete category: ${notesUsingCategory} note(s) are using this category`
        );
      }

      // Delete category
      await client.query(`DELETE FROM note_categories WHERE id = $1`, [categoryId]);

      logger.info(`Category deleted: ${categoryId}`);
    } catch (error: any) {
      logger.error('Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for categories
   */
  async getCategoryUsageStats(
    client: PoolClient,
    userId: string
  ): Promise<Array<{ categoryId: string; categoryName: string; noteCount: number }>> {
    try {
      const query = `
        SELECT 
          nc.id as category_id,
          nc.name as category_name,
          COUNT(an.id) as note_count
        FROM note_categories nc
        LEFT JOIN asset_notes an ON an.category_id = nc.id
        WHERE nc.is_system_default = true 
           OR nc.user_id = $1
           OR nc.user_id IS NULL
        GROUP BY nc.id, nc.name
        ORDER BY note_count DESC, nc.name ASC
      `;

      const result = await client.query(query, [userId]);

      return result.rows.map(row => ({
        categoryId: row.category_id,
        categoryName: row.category_name,
        noteCount: parseInt(row.note_count),
      }));
    } catch (error) {
      logger.error('Error fetching category usage stats:', error);
      throw new Error('Failed to fetch category usage statistics');
    }
  }
}

export const noteCategoriesService = new NoteCategoriesService();
