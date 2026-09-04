"""
Hyper3D + Blender Render Pipeline for JediRe
=============================================

Takes deal parameters (levels, units, SF, facade type) and produces
a photorealistic architectural render via Hyper3D → Blender Cycles.

Usage:
    python pipeline.py --levels 5 --units 32 --sf 45000 --facade brick \
                       --output renders/the_pascal.png

Requirements:
    - Python 3.10+
    - Blender installed (for rendering)
    - HYPER3D_API_KEY env var (for 3D generation)
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("render-pipeline")


# ═══════════════════════════════════════════════════════════════════
# 1. DEAL PARAMETERS → HYPER3D PROMPT
# ═══════════════════════════════════════════════════════════════════

@dataclass
class DealParams:
    """Real estate deal parameters that drive the render."""
    name: str = "The Pascal"
    levels: int = 4
    units: int = 32
    total_sf: int = 45000
    facade: str = "brick"  # brick, glass, concrete, wood_panel, stucco
    style: str = "modern"  # modern, traditional, industrial, luxury
    context: str = "urban"  # urban, suburban, downtown, waterfront
    time_of_day: str = "golden_hour"  # golden_hour, midday, dusk, overcast
    camera_angle: str = "street_level"  # street_level, aerial, corner, courtyard


class PromptBuilder:
    """Converts real estate deal parameters into optimal Hyper3D prompts."""

    FACADE_DESCRIPTORS = {
        "brick": "red brick facade with limestone accents, traditional masonry detailing",
        "glass": "floor-to-ceiling glass curtain wall with reflective low-e coating, steel mullions",
        "concrete": "board-formed concrete exterior with vertical ribbing, raw industrial aesthetic",
        "wood_panel": "warm cedar wood paneling with horizontal rain-screen detailing",
        "stucco": "smooth white stucco finish with clean geometric lines",
        "mixed": "mixed material facade combining brick base with glass and metal upper levels",
    }

    STYLE_DESCRIPTORS = {
        "modern": "contemporary architecture with clean lines and minimal ornamentation",
        "traditional": "classic architectural proportions with decorative cornices and window surrounds",
        "industrial": "loft-style architecture with exposed structure and large window openings",
        "luxury": "high-end residential architecture with generous balconies and premium finishes",
        "transitional": "blend of traditional and contemporary elements, timeless design",
    }

    CONTEXT_DESCRIPTORS = {
        "urban": "on a city street with sidewalks, street trees, and parked cars",
        "suburban": "in a residential neighborhood with mature trees and landscaping",
        "downtown": "in a dense urban core with surrounding buildings and street life",
        "waterfront": "along a river or lake with boardwalk and water views",
    }

    TIME_DESCRIPTORS = {
        "golden_hour": "warm golden hour lighting, long shadows, amber sky",
        "midday": "bright midday sun, clear blue sky, crisp shadows",
        "dusk": "twilight atmosphere, building interior lights visible, deep blue sky",
        "overcast": "soft diffused overcast lighting, even exposure, moody atmosphere",
    }

    CAMERA_DESCRIPTORS = {
        "street_level": "street-level perspective showing the building in its urban context",
        "aerial": "aerial drone perspective showing the full building massing and roof",
        "corner": "three-quarter corner view highlighting both street frontages",
        "courtyard": "interior courtyard view showing amenity spaces and landscaping",
    }

    @classmethod
    def build(cls, params: DealParams) -> str:
        """Build a detailed, photorealistic prompt for Hyper3D Rodin."""
        facade = cls.FACADE_DESCRIPTORS.get(params.facade, params.facade)
        style = cls.STYLE_DESCRIPTORS.get(params.style, params.style)
        context = cls.CONTEXT_DESCRIPTORS.get(params.context, params.context)
        time_desc = cls.TIME_DESCRIPTORS.get(params.time_of_day, params.time_of_day)
        camera = cls.CAMERA_DESCRIPTORS.get(params.camera_angle, params.camera_angle)

        # Calculate approximate dimensions
        avg_floor_sf = params.total_sf / params.levels
        height_per_level = 12  # feet
        total_height = params.levels * height_per_level

        prompt = (
            f"Photorealistic architectural rendering of a {params.levels}-story "
            f"{style} mixed-use apartment building, {params.total_sf:,} square feet, "
            f"{params.units} residential units. "
            f"Exterior features {facade}. "
            f"Ground floor has commercial storefront with large glass windows. "
            f"Upper floors have residential windows with balconies. "
            f"Building is approximately {total_height} feet tall. "
            f"Scene shows the building {context}. "
            f"{camera}. "
            f"{time_desc}. "
            f"Professional architectural visualization, 8K quality, "
            f"photorealistic materials, accurate proportions, detailed landscaping, "
            f"pedestrians for scale, photorealistic sky with clouds."
        )

        return prompt

    @classmethod
    def build_negative(cls, params: DealParams) -> str:
        """Build negative prompt to avoid common AI generation artifacts."""
        return (
            "cartoon, illustration, sketch, blurry, low quality, deformed, "
            "disfigured, bad anatomy, watermark, text, signature, "
            "oversaturated, unrealistic proportions, floating elements"
        )


# ═══════════════════════════════════════════════════════════════════
# 2. HYPER3D API CLIENT
# ═══════════════════════════════════════════════════════════════════

class Hyper3DClient:
    """Client for Hyper3D Rodin API — generates 3D models from prompts."""

    # Hyper3D API configuration — update these if endpoints change
    DEFAULT_API_URL = "https://api.hyper3d.ai/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("HYPER3D_API_KEY")
        self.api_url = os.environ.get("HYPER3D_API_URL", self.DEFAULT_API_URL)
        self.mock_mode = not self.api_key

        if self.mock_mode:
            logger.warning("HYPER3D_API_KEY not set — running in MOCK mode")
            logger.warning("Set HYPER3D_API_KEY to enable real 3D generation")

    def generate(self, prompt: str, negative_prompt: str = "", effort: str = "high") -> dict:
        """
        Generate a 3D model from a text prompt via Hyper3D Rodin.

        Args:
            prompt: Detailed description of the building
            negative_prompt: What to avoid in generation
            effort: Generation quality level (low, medium, high, extreme)

        Returns:
            dict with {'status', 'job_id', 'model_url', 'format'}
        """
        if self.mock_mode:
            return self._mock_generate(prompt)

        # Real API call — requires requests library
        try:
            import requests
        except ImportError:
            logger.error("requests library not installed. Run: pip install requests")
            raise

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "effort": effort,
            "format": "glb",  # Blender-compatible format
        }

        logger.info(f"Submitting Hyper3D job with {effort} effort...")
        resp = requests.post(
            f"{self.api_url}/rodin/generate",
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()

        job_id = result.get("job_id")
        logger.info(f"Job submitted: {job_id}")

        # Poll for completion
        model_url = self._poll_job(job_id)

        return {
            "status": "completed",
            "job_id": job_id,
            "model_url": model_url,
            "format": "glb",
        }

    def _poll_job(self, job_id: str, max_wait: int = 300) -> str:
        """Poll Hyper3D until generation completes."""
        import requests

        headers = {"Authorization": f"Bearer {self.api_key}"}
        start = time.time()

        while time.time() - start < max_wait:
            resp = requests.get(
                f"{self.api_url}/rodin/jobs/{job_id}",
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            status = data.get("status")
            if status == "completed":
                return data["model_url"]
            if status == "failed":
                raise RuntimeError(f"Hyper3D generation failed: {data}")

            logger.info(f"Job {job_id} status: {status}... waiting")
            time.sleep(10)

        raise TimeoutError(f"Job {job_id} did not complete within {max_wait}s")

    def _mock_generate(self, prompt: str) -> dict:
        """Mock generation for testing without API key."""
        logger.info("MOCK: Simulating Hyper3D generation...")
        logger.info(f"MOCK: Prompt would be: {prompt[:120]}...")
        time.sleep(2)  # Simulate processing

        # Return a mock result — user must provide a GLB file
        mock_glb = Path("tools/render-pipeline/mock_building.glb")
        if not mock_glb.exists():
            logger.warning(f"MOCK: No mock GLB found at {mock_glb}")
            logger.warning("MOCK: Create a simple cube in Blender and export as mock_building.glb")

        return {
            "status": "completed_mock",
            "job_id": "mock-123",
            "model_url": str(mock_glb) if mock_glb.exists() else None,
            "format": "glb",
            "note": "Set HYPER3D_API_KEY for real generation",
        }


# ═══════════════════════════════════════════════════════════════════
# 3. BLENDER RENDER SCRIPT (runs inside Blender)
# ═══════════════════════════════════════════════════════════════════

BLENDER_SCRIPT = '''
import bpy
import sys
import os

# Parse arguments passed from pipeline
argv = sys.argv
argv = argv[argv.index("--") + 1:]  # Get args after "--"

model_path = argv[0] if len(argv) > 0 else ""
output_path = argv[1] if len(argv) > 1 else "/tmp/render.png"
width = int(argv[2]) if len(argv) > 2 else 1920
height = int(argv[3]) if len(argv) > 3 else 1080
samples = int(argv[4]) if len(argv) > 4 else 128

print(f"[Blender] Rendering: {model_path}")
print(f"[Blender] Output: {output_path}")

# Clear default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import the GLB model
if model_path and os.path.exists(model_path):
    bpy.ops.import_scene.gltf(filepath=model_path)
    print(f"[Blender] Imported: {model_path}")
else:
    # Create a simple building proxy if no model
    print("[Blender] No model found — creating proxy geometry")
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
    building = bpy.context.active_object
    building.scale = (4, 3, 8)

# Center camera on imported objects
if bpy.data.objects:
    # Calculate bounding box center
    min_x = min_y = min_z = float('inf')
    max_x = max_y = max_z = float('-inf')
    
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for corner in obj.bound_box:
                world_corner = obj.matrix_world @ Vector(corner)
                min_x, max_x = min(min_x, world_corner.x), max(max_x, world_corner.x)
                min_y, max_y = min(min_y, world_corner.y), max(max_y, world_corner.y)
                min_z, max_z = min(min_z, world_corner.z), max(max_z, world_corner.z)
    
    center = Vector(((min_x + max_x) / 2, (min_y + max_y) / 2, (min_z + max_z) / 2))
    height = max_z - min_z
    distance = max(max_x - min_x, max_y - min_y) * 2.5
else:
    center = Vector((0, 0, 4))
    height = 8
    distance = 25

# Setup camera
cam_data = bpy.data.cameras.new(name="RenderCam")
cam_obj = bpy.data.objects.new(name="RenderCam", object_data=cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Position camera for street-level three-quarter view
cam_obj.location = (distance * 0.7, -distance * 0.7, height * 0.6)
cam_obj.rotation_euler = (1.1, 0, 0.785)

# Point camera at building center
direction = center - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

# Setup lighting — Sun + HDRI
# Sun light
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.location = (10, -10, 15)
sun_obj.rotation_euler = (0.9, 0, 0.5)
sun_data.energy = 4.0
sun_data.color = (1.0, 0.95, 0.85)  # Warm golden hour

# Fill light
fill_data = bpy.data.lights.new(name="Fill", type='AREA')
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.location = (-8, 5, 6)
fill_obj.rotation_euler = (1.2, 0, -0.5)
fill_data.energy = 1.5
fill_data.color = (0.85, 0.9, 1.0)  # Cool fill

# Ground plane
bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 0, 0))
ground = bpy.context.active_object

# Ground material — asphalt/concrete
ground_mat = bpy.data.materials.new(name="Ground")
ground_mat.use_nodes = True
nodes = ground_mat.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
bsdf.inputs['Base Color'].default_value = (0.15, 0.15, 0.16, 1.0)
bsdf.inputs['Roughness'].default_value = 0.9
ground.data.materials.append(ground_mat)

# Render settings
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'
scene.cycles.samples = samples
scene.render.resolution_x = width
scene.render.resolution_y = height
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = output_path
scene.render.film_transparent = False

# Enable denoising
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPTIX' if scene.cycles.device == 'GPU' else 'OPENIMAGEDENOISE'

# Render
print("[Blender] Starting render...")
bpy.ops.render.render(write_still=True)
print(f"[Blender] Render saved: {output_path}")
'''


class BlenderRenderer:
    """Automates Blender Cycles rendering via command-line bpy."""

    def __init__(self, blender_path: Optional[str] = None):
        self.blender_path = blender_path or self._find_blender()

    def _find_blender(self) -> str:
        """Auto-detect Blender installation."""
        candidates = [
            # macOS
            "/Applications/Blender.app/Contents/MacOS/Blender",
            # Linux
            "/usr/bin/blender",
            "/usr/local/bin/blender",
            # Windows
            "C:\\Program Files\\Blender Foundation\\Blender\\blender.exe",
            "blender",  # PATH
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
            try:
                result = subprocess.run(
                    [path, "--version"], capture_output=True, timeout=5
                )
                if result.returncode == 0:
                    return path
            except FileNotFoundError:
                continue
        raise RuntimeError(
            "Blender not found. Install from https://www.blender.org/download/ "
            "or set BLENDER_PATH env var."
        )

    def render(
        self,
        model_path: str,
        output_path: str,
        width: int = 1920,
        height: int = 1080,
        samples: int = 128,
    ) -> str:
        """
        Render a 3D model with Blender Cycles.

        Args:
            model_path: Path to .glb/.obj/.fbx model file
            output_path: Where to save the rendered PNG
            width: Render width in pixels
            height: Render height in pixels
            samples: Cycles sample count (higher = better quality, slower)

        Returns:
            Path to the rendered image
        """
        # Write the Blender script to a temp file
        script_path = Path("/tmp/jedire_blender_render.py")
        script_path.write_text(BLENDER_SCRIPT)

        cmd = [
            self.blender_path,
            "--background",
            "--python", str(script_path),
            "--",
            model_path,
            output_path,
            str(width),
            str(height),
            str(samples),
        ]

        logger.info(f"Starting Blender render: {width}x{height} @ {samples} samples")
        logger.info(f"Command: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 min max
        )

        if result.returncode != 0:
            logger.error(f"Blender stderr:\n{result.stderr}")
            raise RuntimeError(f"Blender render failed: {result.returncode}")

        logger.info(f"Render complete: {output_path}")
        return output_path


# ═══════════════════════════════════════════════════════════════════
# 4. MAIN PIPELINE ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════

class RenderPipeline:
    """End-to-end pipeline: Deal params → Hyper3D → Blender → Render."""

    def __init__(self):
        self.hyper3d = Hyper3DClient()
        self.blender = BlenderRenderer()

    def run(self, params: DealParams, output_path: str, samples: int = 128) -> str:
        """
        Execute the full render pipeline.

        Returns:
            Path to the final rendered image
        """
        logger.info("═" * 60)
        logger.info(f"Render Pipeline: {params.name}")
        logger.info("═" * 60)

        # Step 1: Build prompt
        prompt = PromptBuilder.build(params)
        negative = PromptBuilder.build_negative(params)
        logger.info(f"Prompt: {prompt[:200]}...")

        # Step 2: Generate 3D model via Hyper3D
        result = self.hyper3d.generate(prompt, negative)
        model_url = result.get("model_url")

        if not model_url:
            raise RuntimeError("Hyper3D did not return a model URL")

        # Download model if it's a URL
        if model_url.startswith("http"):
            import requests
            model_path = "/tmp/hyper3d_model.glb"
            logger.info(f"Downloading model from {model_url[:60]}...")
            r = requests.get(model_url, timeout=60)
            r.raise_for_status()
            Path(model_path).write_bytes(r.content)
        else:
            model_path = model_url

        logger.info(f"Model ready: {model_path}")

        # Step 3: Render with Blender
        rendered = self.blender.render(
            model_path=model_path,
            output_path=output_path,
            samples=samples,
        )

        logger.info(f"✅ Pipeline complete: {rendered}")
        return rendered


# ═══════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="JediRe Hyper3D + Blender Render Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic render
  python pipeline.py --levels 5 --units 32 --sf 45000 --facade brick

  # Luxury glass tower at dusk
  python pipeline.py --levels 12 --units 200 --sf 180000 \\
    --facade glass --style luxury --time dusk --samples 256

  # Suburban wood panel with aerial view
  python pipeline.py --levels 3 --units 24 --sf 36000 \\
    --facade wood_panel --context suburban --camera aerial

Environment:
  HYPER3D_API_KEY    Required for real 3D generation
  BLENDER_PATH       Optional: path to Blender executable
        """,
    )

    # Deal parameters
    parser.add_argument("--name", default="The Pascal", help="Deal/building name")
    parser.add_argument("--levels", type=int, default=4, help="Number of stories")
    parser.add_argument("--units", type=int, default=32, help="Number of units")
    parser.add_argument("--sf", type=int, default=45000, help="Total square footage")
    parser.add_argument(
        "--facade",
        choices=["brick", "glass", "concrete", "wood_panel", "stucco", "mixed"],
        default="brick",
        help="Primary facade material",
    )
    parser.add_argument(
        "--style",
        choices=["modern", "traditional", "industrial", "luxury", "transitional"],
        default="modern",
        help="Architectural style",
    )
    parser.add_argument(
        "--context",
        choices=["urban", "suburban", "downtown", "waterfront"],
        default="urban",
        help="Site context",
    )
    parser.add_argument(
        "--time",
        dest="time_of_day",
        choices=["golden_hour", "midday", "dusk", "overcast"],
        default="golden_hour",
        help="Lighting condition",
    )
    parser.add_argument(
        "--camera",
        dest="camera_angle",
        choices=["street_level", "aerial", "corner", "courtyard"],
        default="street_level",
        help="Camera perspective",
    )

    # Render settings
    parser.add_argument("--output", default="renders/output.png", help="Output image path")
    parser.add_argument("--samples", type=int, default=128, help="Cycles samples (128-512)")
    parser.add_argument("--width", type=int, default=1920, help="Render width")
    parser.add_argument("--height", type=int, default=1080, help="Render height")
    parser.add_argument("--mock", action="store_true", help="Force mock mode (no API calls)")

    args = parser.parse_args()

    # Build deal params
    params = DealParams(
        name=args.name,
        levels=args.levels,
        units=args.units,
        total_sf=args.sf,
        facade=args.facade,
        style=args.style,
        context=args.context,
        time_of_day=args.time_of_day,
        camera_angle=args.camera_angle,
    )

    # Ensure output directory exists
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    # Run pipeline
    pipeline = RenderPipeline()

    if args.mock:
        pipeline.hyper3d.mock_mode = True

    try:
        result = pipeline.run(
            params=params,
            output_path=args.output,
            samples=args.samples,
        )
        print(f"\n✅ Render saved: {result}")
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
