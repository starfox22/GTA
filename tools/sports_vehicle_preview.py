"""Blender-only native C8 source preview; never exports or edits source assets.

blender -b --threads 1 -P tools/sports_vehicle_preview.py -- SOURCE/scene.gltf OUTPUT
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

source, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
points = [obj.matrix_world @ Vector(point) for obj in meshes for point in obj.bound_box]
lo = Vector([min(point[i] for point in points) for i in range(3)])
hi = Vector([max(point[i] for point in points) for i in range(3)])
center = (lo + hi) * .5
size = max(hi - lo)
proof = {'source': str(source), 'originalBounds': [list(lo), list(hi)], 'doors': {}}
for name in ['Left Door', 'Right Door']:
    door = bpy.data.objects.get(name)
    if not door:
        raise RuntimeError('Missing authored door parent: ' + name)
    children = [obj for obj in door.children_recursive if obj.type == 'MESH']
    def door_center():
        return sum((obj.matrix_world @ Vector(corner) for obj in children for corner in obj.bound_box), Vector()) / (len(children) * 8)
    before = door_center()
    before_matrix = [list(row) for row in door.matrix_world]
    door.rotation_mode = 'QUATERNION'
    original = door.rotation_quaternion.copy()
    angle = .95
    door.rotation_quaternion = original @ Quaternion((0, 0, 1), angle)
    bpy.context.view_layer.update()
    if abs(door_center().x) < abs(before.x):
        angle *= -1
        door.rotation_quaternion = original @ Quaternion((0, 0, 1), angle)
        bpy.context.view_layer.update()
    after = door_center()
    if abs(after.x) < abs(before.x) + .1:
        raise RuntimeError('Door did not open outwards about its author pivot')
    proof['doors'][name] = {'angleRadians': angle, 'matrixBefore': before_matrix, 'matrixAfter': [list(row) for row in door.matrix_world], 'centreBefore': list(before), 'centreAfter': list(after)}
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 32; scene.cycles.use_denoising = False
scene.render.resolution_x = 1200; scene.render.resolution_y = 850; scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('ReviewWorld'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.42, .46, .5, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
scene.view_settings.view_transform = 'AgX'
bpy.ops.mesh.primitive_plane_add(size=size * 200, location=(center.x, center.y, lo.z - .005))
floor = bpy.context.object; floor.name = 'ReviewFloor'
material = bpy.data.materials.new('ReviewFloor'); material.use_nodes = True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.12, .14, .17, 1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
floor.data.materials.append(material)
for index, (offset, power, width) in enumerate([((.3, -1, 1.5), 1500, 1), ((-1, 1, 1), 1000, 1.5), ((1, 1, 1.3), 1300, .8)]):
    light = bpy.data.lights.new('ReviewArea' + str(index), 'AREA'); light.energy = power * size * size / 20; light.size = width * size
    obj = bpy.data.objects.new(light.name, light); bpy.context.collection.objects.link(obj)
    obj.location = center + Vector(offset) * size; obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera_data = bpy.data.cameras.new('ReviewCamera'); camera = bpy.data.objects.new('ReviewCamera', camera_data); bpy.context.collection.objects.link(camera)
camera.location = center + Vector((-.93, 1.12, .58)) * size
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'; camera_data.ortho_scale = size * 1.5; scene.camera = camera
scene.render.filepath = str(destination / 'native-open-doors.png')
(destination / 'native-open-door-proof.json').write_text(json.dumps(proof, indent=2))
bpy.ops.render.render(write_still=True)
print('NATIVE_OPEN_DOOR_PREVIEW_COMPLETE', destination, flush=True)
