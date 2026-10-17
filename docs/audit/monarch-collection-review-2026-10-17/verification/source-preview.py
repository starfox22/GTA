"""Render the unchanged SDC source GLB in a neutral Blender studio; never exports it.

blender -b --threads 4 -P source-preview.py -- SOURCE.glb OUTPUT
"""
import hashlib
import json
import math
import platform
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector

source, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
destination.mkdir(parents=True, exist_ok=True)
source_bytes = source.read_bytes()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
scene = bpy.context.scene
source_meshes = [obj for obj in scene.objects if obj.type == 'MESH']
points = [obj.matrix_world @ Vector(corner) for obj in source_meshes for corner in obj.bound_box]
lo = Vector([min(point[i] for point in points) for i in range(3)])
hi = Vector([max(point[i] for point in points) for i in range(3)])
center = (lo + hi) * 0.5
size = max(hi - lo)
proof = {
    'source': str(source), 'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
    'sourceBytes': len(source_bytes),
    'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'blender': bpy.app.version_string, 'platform': platform.platform(),
    'engine': 'CYCLES', 'device': 'CPU', 'samples': 32, 'denoising': False,
    'resolution': [640, 400], 'originalBlenderBounds': [list(lo), list(hi)],
    'sourceMeshObjects': len(source_meshes),
    'sourceTriangles': sum(len(obj.data.polygons) for obj in source_meshes),
    'sourceMaterials': len(bpy.data.materials),
    'sourceModified': False, 'doors': 'closed as authored',
    'description': 'Independent Blender render of original downloaded source. Studio camera, lights and floor added; source meshes, transforms and materials unchanged. Not a gameplay screenshot.',
    'captures': [],
}
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = 640
scene.render.resolution_y = 400
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.world = bpy.data.worlds.new('PreviewWorld')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.42, 0.46, 0.50, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.5
try:
    scene.view_settings.view_transform = 'AgX'
except TypeError:
    scene.view_settings.view_transform = 'Filmic'
proof['viewTransform'] = scene.view_settings.view_transform
bpy.ops.mesh.primitive_plane_add(size=size * 200, location=(center.x, center.y, lo.z - 0.005))
floor = bpy.context.object
floor.name = 'PreviewFloor'
material = bpy.data.materials.new('PreviewFloor')
material.use_nodes = True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.105, 0.12, 0.14, 1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.85
floor.data.materials.append(material)
for index, (offset, power, width) in enumerate([
    ((0.3, -1, 1.5), 1700, 1), ((-1, 1, 1.0), 1100, 1.5), ((1, 1, 1.3), 1500, 0.8)
]):
    light = bpy.data.lights.new('PreviewArea' + str(index), 'AREA')
    light.energy = power * size * size / 20
    light.size = width * size
    obj = bpy.data.objects.new(light.name, light)
    bpy.context.collection.objects.link(obj)
    obj.location = center + Vector(offset) * size
    obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera_data = bpy.data.cameras.new('PreviewCamera')
camera = bpy.data.objects.new('PreviewCamera', camera_data)
bpy.context.collection.objects.link(camera)
camera_data.clip_end = max(1000, size * 100)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = size * 1.28
scene.camera = camera

# glTF +Z front imports as Blender -Y; Blender +Z remains up.
for name, offset in [('source-front-three-quarter', (-0.95, -1.20, 0.60))]:
    camera.location = center + Vector(offset) * size
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    path = destination / (name + '.png')
    scene.render.filepath = str(path)
    start = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    proof['captures'].append({
        'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'bytes': path.stat().st_size, 'seconds': round(time.perf_counter() - start, 3),
        'cameraPosition': list(camera.location), 'cameraEuler': list(camera.rotation_euler),
        'orthoScale': camera_data.ortho_scale,
    })
    (destination / 'source-preview-receipt.json').write_text(json.dumps(proof, indent=2))
    print('SOURCE_PREVIEW_CAPTURED', path, flush=True)
if hashlib.sha256(source.read_bytes()).hexdigest() != proof['sourceSha256']:
    raise RuntimeError('Source bytes changed')
print('SOURCE_PREVIEW_COMPLETE', destination, flush=True)
