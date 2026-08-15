"""Rebuild standalone hero components from their procedural source."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "blender" / "create_hero_neighbourhood.py"
spec = importlib.util.spec_from_file_location("hero_assets", SOURCE)
hero = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hero)

hero.reset()
root = hero.empty("Standalone quality components")
tree = hero.build_tree(root, 0, 0, 1.0)
van = hero.build_van(root)
house = hero.build_house(root)
engineer = hero.build_engineer(root)
hero.export_component(tree, str(ROOT / "assets" / "raintree-v2.glb"), (0, 0, 0))
hero.export_component(van, str(ROOT / "assets" / "service-van-v2.glb"), (3.35, 2.25, 0))
hero.export_component(house, str(ROOT / "assets" / "landed-v2.glb"), (-1.55, -1.65, 0))
hero.export_component(engineer, str(ROOT / "assets" / "engineer-v2.glb"), (1.0, 1.05, 0))
print("REBUILT_HERO_COMPONENTS raintree-v2 service-van-v2 landed-v2 engineer-v2")
