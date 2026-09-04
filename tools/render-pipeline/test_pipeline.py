"""Test PromptBuilder and Hyper3D mock mode — no Blender required."""

import sys
sys.path.insert(0, r"tools/render-pipeline")

from pipeline import DealParams, PromptBuilder, Hyper3DClient


def test_prompt_builder():
    params = DealParams(
        name="The Pascal",
        levels=5,
        units=40,
        total_sf=55000,
        facade="glass",
        style="luxury",
        context="downtown",
        time_of_day="dusk",
        camera_angle="aerial",
    )
    prompt = PromptBuilder.build(params)
    negative = PromptBuilder.build_negative(params)

    assert "5-story" in prompt
    assert "high-end residential" in prompt
    assert "glass curtain wall" in prompt
    assert "dense urban core" in prompt
    assert "twilight" in prompt
    assert "aerial drone" in prompt
    assert "55,000" in prompt
    assert "40" in prompt
    assert "cartoon" in negative
    print("PromptBuilder: PASSED")
    print(f"   Prompt length: {len(prompt)} chars")
    print(f"   First 150 chars: {prompt[:150]}...")


def test_hyper3d_mock():
    client = Hyper3DClient(api_key=None)
    assert client.mock_mode is True

    result = client.generate("test prompt")
    assert result["status"] == "completed_mock"
    assert result["format"] == "glb"
    print("Hyper3D Mock: PASSED")
    print(f"   Job ID: {result['job_id']}")
    print(f"   Note: {result['note']}")


def test_default_params():
    params = DealParams()
    prompt = PromptBuilder.build(params)
    assert "4-story" in prompt
    assert "brick" in prompt
    assert "urban" in prompt
    print("Default Params: PASSED")


if __name__ == "__main__":
    test_prompt_builder()
    test_hyper3d_mock()
    test_default_params()
    print("\nAll tests passed!")
