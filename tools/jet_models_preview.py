"""Blender CPU inspection of fitted native sources and decoded near/far packs.

blender -b --threads 1 -P tools/jet_models_preview.py -- SOURCE_DIR OUTPUT_DIR \
  --assets assets --model jet --mode source
Modes: source / near / far. Poses: neutral / controls / gearup.
These are source/pack inspection renders, never in-game screenshots.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--assets', type=Path, required=True)
parser.add_argument('--model', choices=['jet', 'airliner'], default='jet')
parser.add_argument('--mode', choices=['source', 'near', 'far'], default='source')
parser.add_argument('--pose', choices=['neutral', 'controls', 'gearup'], default='neutral')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output.mkdir(parents=True, exist_ok=True)
raw = (args.assets / 'jet-models.bin').read_bytes()
length = struct.unpack_from('<I', raw, 8)[0]
header = json.loads(raw[12:12 + length]); base = 12 + length
model = header['models'][args.model]
bpy.ops.wm.read_factory_settings(use_empty=True)


def to_blender(values):
    return np.asarray(values)[..., [0, 2, 1]] * [1, -1, 1]


def array(name, width):
    kind, offset, count = header['arrays'][args.model + '.' + name]
    dtype = {'i2': '<i2', 'u2': '<u2', 'i1': 'i1', 'u1': 'u1', 'u4': '<u4', 'f4': '<f4'}[kind]
    return np.frombuffer(raw, dtype=dtype, count=count, offset=base + offset).reshape(-1, width)


if args.mode == 'source':
    source = args.source / ('citation2.glb' if args.model == 'jet' else 'southwest737/scene.gltf')
    bpy.ops.import_scene.gltf(filepath=str(source))
    angle = np.pi if args.model == 'jet' else np.pi / 2
    transform = Matrix.Translation(Vector(to_blender(model['sourceToGameShift']).tolist())) @ Matrix.Rotation(float(angle), 4, 'Z') @ Matrix.Scale(model['uniformScale'], 4)
    for obj in list(bpy.context.scene.objects):
        if obj.parent is None:
            obj.matrix_world = transform @ obj.matrix_world
else:
    for name, info in model['parts'].items():
        if name.endswith('Far') != (args.mode == 'far'):
            continue
        P = (array(name + '.p', 3).astype(float) + 32767) / 65534 * model['quant'][3:] + model['quant'][:3]
        N = array(name + '.n', 3).astype(float) / 32767
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
        UV = array(name + '.uv', 2).astype(float)
        if header['arrays'][args.model + '.' + name + '.uv'][0] != 'f4':
            UV /= 65535
        I = array(name + '.i', 3)
        origin = np.array(info.get('origin', [0, 0, 0]))
        geometry = bpy.data.meshes.new(name)
        geometry.from_pydata(to_blender(P - origin).tolist(), [], I.tolist())
        geometry.polygons.foreach_set('use_smooth', [True] * len(I))
        geometry.normals_split_custom_set_from_vertices(to_blender(N).tolist())
        object = bpy.data.objects.new(name, geometry); bpy.context.collection.objects.link(object)
        object.location = Vector(to_blender(origin).tolist())
        uv_layer = geometry.uv_layers.new(name='sourceUV')
        loop_uv = UV[I.reshape(-1)].copy()
        loop_uv[:, 1] = 1 - loop_uv[:, 1]  # glTF image coordinates to Blender UVs
        uv_layer.data.foreach_set('uv', loop_uv.reshape(-1).tolist())
        material = bpy.data.materials.new(name); material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = .46
        if args.model == 'jet':
            image = bpy.data.images.load(str(args.assets / 'jet-skin.webp'))
            node = material.node_tree.nodes.new('ShaderNodeTexImage'); node.image = image
            material.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
        else:
            C = array(name + '.c', 3) / 255
            C = np.where(C <= .04045, C / 12.92, ((C + .055) / 1.055) ** 2.4)
            color = geometry.color_attributes.new(name='sourceColor', type='FLOAT_COLOR', domain='POINT')
            color.data.foreach_set('color', np.column_stack([C, np.ones(len(C))]).reshape(-1).tolist())
            node = material.node_tree.nodes.new('ShaderNodeVertexColor'); node.layer_name = color.name
            material.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
        geometry.materials.append(material)
        part = name.removesuffix('Far')
        if args.pose == 'gearup' and part in model.get('gears', {}):
            object.hide_render = True
        if args.pose == 'controls' and part in model.get('hinges', {}):
            hinge = model['hinges'][part]
            axis = Vector(to_blender(np.array(hinge['b']) - hinge['a']).tolist()).normalized()
            angle = .4 if part.startswith('flap') else -.3 if part.startswith('elevator') else .3
            object.rotation_mode = 'QUATERNION'; object.rotation_quaternion = Quaternion(axis, angle)

scene = bpy.context.scene
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(point) for obj in meshes for point in obj.bound_box]
lo = Vector([min(p[i] for p in points) for i in range(3)])
hi = Vector([max(p[i] for p in points) for i in range(3)])
center = (lo + hi) * .5; size = max(hi - lo)
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 16; scene.cycles.use_denoising = False
scene.render.resolution_x = 1100; scene.render.resolution_y = 780; scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Source review'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.42, .46, .5, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
scene.view_settings.view_transform = 'AgX'
bpy.ops.mesh.primitive_plane_add(size=size * 100, location=(center.x, center.y, lo.z - .005))
floor = bpy.context.object
material = bpy.data.materials.new('Review floor'); material.diffuse_color = (.12, .14, .17, 1); floor.data.materials.append(material)
for index, (offset, power) in enumerate([((1, -1, 1.6), 1500), ((-1, 1, 1), 1000), ((1, 1, .7), 900)]):
    light = bpy.data.lights.new('Review area ' + str(index), 'AREA'); light.energy = power * size * size / 20; light.size = size
    obj = bpy.data.objects.new(light.name, light); bpy.context.collection.objects.link(obj)
    obj.location = center + Vector(offset) * size; obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera_data = bpy.data.cameras.new('Review camera'); camera = bpy.data.objects.new(camera_data.name, camera_data); bpy.context.collection.objects.link(camera)
camera.location = center + Vector((1.0, -1.1, .62)) * size
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'; camera_data.ortho_scale = size * 1.3; camera_data.clip_end = size * 100; scene.camera = camera
stem = args.model + '-' + args.mode + '-' + args.pose
scene.render.filepath = str(args.output / (stem + '.png'))
(args.output / (stem + '.json')).write_text(json.dumps({'inspectionOnly': True, 'inGame': False, 'model': args.model,
    'mode': args.mode, 'pose': args.pose, 'packSha256': hashlib.sha256(raw).hexdigest(),
    'boundsBlender': [list(lo), list(hi)], 'render': 'Blender CPU Cycles, 16 samples; original source normals, coordinate/size fit only for source mode'}, indent=2))
bpy.ops.render.render(write_still=True)
