/**
 * AI Rendering Service - Convert 3D massing to photorealistic renderings
 * Uses Replicate API with ControlNet + SDXL
 */

import Replicate from 'replicate';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import path from 'path';
import { randomUUID } from 'crypto';

interface RenderingRequest {
  imageBase64: string; // Screenshot from Three.js
  depthMapBase64?: string; // Optional depth map for better control
  style: 'modern-glass' | 'brick-traditional' | 'mixed-use-urban' | 'industrial-loft' | 'luxury-highrise';
  context?: string; // Geographic context (e.g., "Atlanta urban", "Miami beachfront")
  timeOfDay?: 'golden-hour' | 'midday' | 'dusk' | 'night';
  weather?: 'sunny' | 'overcast' | 'rainy';
}

interface RenderingResponse {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  error?: string;
  processingTime?: number;
}

export class AIRenderingService {
  private replicate: Replicate;
  private outputDir: string;

  constructor() {
    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      throw new Error('REPLICATE_API_TOKEN environment variable is required');
    }
    
    this.replicate = new Replicate({ auth: apiKey });
    this.outputDir = process.env.RENDERING_OUTPUT_DIR || '/tmp/jedire-renderings';
  }

  /**
   * Generate photorealistic rendering from massing screenshot
   */
  async generateRendering(request: RenderingRequest): Promise<RenderingResponse> {
    const startTime = Date.now();

    try {
      // Build architectural prompt based on style
      const prompt = this.buildPrompt(request);
      
      console.log('[AI Rendering] Starting generation with prompt:', prompt);

      // Use ControlNet SDXL model for structural fidelity
      const output = await this.replicate.run(
        'jagilley/controlnet-scribble:435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117',
        {
          input: {
            image: request.imageBase64,
            prompt: prompt,
            negative_prompt: this.getNegativePrompt(),
            num_outputs: 1,
            guidance_scale: 7.5, // Balance between creativity and control
            prompt_strength: 0.7, // How much to transform (0.7 = preserve structure, add details)
            num_inference_steps: 30,
            scheduler: 'DPMSolverMultistep',
          }
        }
      ) as string[];

      if (!output || output.length === 0) {
        throw new Error('No output generated from AI model');
      }

      const imageUrl = output[0];
      
      // Download and save locally
      const localPath = await this.downloadImage(imageUrl);

      const processingTime = Date.now() - startTime;
      console.log(`[AI Rendering] Generated in ${processingTime}ms`);

      return {
        success: true,
        imageUrl,
        localPath,
        processingTime,
      };
    } catch (error) {
      console.error('[AI Rendering] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build architectural prompt based on style and context
   */
  private buildPrompt(request: RenderingRequest): string {
    const styleDescriptions = {
      'modern-glass': 'modern luxury apartment building, floor-to-ceiling glass windows, sleek metal panels, minimalist design, contemporary architecture',
      'brick-traditional': 'traditional multifamily building, red brick facade, classic masonry, arched windows, timeless design, residential neighborhood',
      'mixed-use-urban': 'mixed-use urban building, ground floor retail, modern residential upper floors, pedestrian-friendly street activation, vibrant city context',
      'industrial-loft': 'industrial loft building, exposed steel beams, large factory windows, converted warehouse aesthetic, urban adaptive reuse',
      'luxury-highrise': 'luxury high-rise tower, premium materials, elegant balconies, sophisticated design, upscale residential development',
    };

    const timeOfDayDescriptions = {
      'golden-hour': 'golden hour lighting, warm sunset glow, dramatic shadows',
      'midday': 'bright midday sunlight, clear skies, crisp lighting',
      'dusk': 'dusk lighting, blue hour, architectural lighting illuminated',
      'night': 'nighttime, interior lights glowing, atmospheric evening scene',
    };

    const weatherDescriptions = {
      'sunny': 'sunny weather, clear blue sky',
      'overcast': 'overcast sky, soft diffused lighting',
      'rainy': 'rainy weather, wet pavement reflections',
    };

    const parts = [
      'photorealistic architectural rendering',
      styleDescriptions[request.style],
      request.context || 'urban context',
      timeOfDayDescriptions[request.timeOfDay || 'golden-hour'],
      weatherDescriptions[request.weather || 'sunny'],
      'professional photography, high detail, 8K quality, architectural digest style',
      'landscaping with trees and greenery, pedestrians, cars',
    ];

    return parts.join(', ');
  }

  /**
   * Negative prompt to avoid common AI artifacts
   */
  private getNegativePrompt(): string {
    return [
      'low quality',
      'blurry',
      'distorted',
      'deformed',
      'cartoon',
      'sketch',
      'unrealistic',
      'oversaturated',
      'poorly drawn',
      'bad architecture',
      'floating objects',
      'incorrect perspective',
    ].join(', ');
  }

  /**
   * Download generated image and save locally
   */
  private async downloadImage(url: string): Promise<string> {
    const filename = `render-${randomUUID()}.png`;
    const outputPath = path.join(this.outputDir, filename);

    // Ensure output directory exists
    const fs = await import('fs/promises');
    await fs.mkdir(this.outputDir, { recursive: true });

    // Download image
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    await pipeline(response.body, createWriteStream(outputPath));

    return outputPath;
  }

  /**
   * Generate depth map from Three.js scene (helper for future enhancement)
   * This would be called from the frontend and sent alongside the screenshot
   */
  static generateDepthMapInstructions(): string {
    return `
    // In your Three.js scene:
    import { DepthTexture } from 'three';
    
    const depthMaterial = new THREE.MeshDepthMaterial();
    const depthRenderTarget = new THREE.WebGLRenderTarget(width, height);
    depthRenderTarget.depthTexture = new DepthTexture(width, height);
    
    // Render depth pass
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(depthRenderTarget);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    
    // Read depth texture as image
    const depthCanvas = document.createElement('canvas');
    const depthCtx = depthCanvas.getContext('2d');
    depthCanvas.width = width;
    depthCanvas.height = height;
    
    const depthPixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(depthRenderTarget, 0, 0, width, height, depthPixels);
    
    const depthImageData = depthCtx.createImageData(width, height);
    depthImageData.data.set(depthPixels);
    depthCtx.putImageData(depthImageData, 0, 0);
    
    const depthBase64 = depthCanvas.toDataURL('image/png');
    `;
  }
}

export const aiRenderingService = new AIRenderingService();
