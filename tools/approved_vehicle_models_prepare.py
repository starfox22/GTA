#!/usr/bin/env python3
"""Blender-only faithful M1 assembly and conservative part decimation.

Run through approved_vehicle_models.py; source files stay outside the repository.
The M1 prefab supplies placement, matching its source engine's raw FBX importer.
Decimation never clusters/snaps close geometry and does not discard mesh parts.
"""
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix


def assemble_m1(source, output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    model = source / 'motorcycles/vgframework'
    prefab = ET.parse(model / 'prefab.xml').getroot()
    materials = {}
    for path in model.glob('*.mat'):
        root = ET.parse(path).getroot()
        properties = {x.attrib.get('name'): x for x in root.iter('Property')}
        material = bpy.data.materials.new(path.stem)
        material.use_nodes = True
        p = material.node_tree.nodes.get('Principled BSDF')
        color = properties['m_albedoColor']
        factor = tuple(float(color.attrib[k]) for k in ('x', 'y', 'z', 'w'))
        p.inputs['Base Color'].default_value = factor
        p.inputs['Roughness'].default_value = float(properties['m_roughness'].attrib['value'])
        p.inputs['Metallic'].default_value = float(properties['m_metalness'].attrib['value'])
        map_property = properties.get('m_albedoMap')
        map_path = map_property.find('.//Property[@name="m_resourcePath"]') if map_property is not None else None
        if map_path is not None and 'motorbike_albedo' in map_path.attrib.get('value', ''):
            texture = material.node_tree.nodes.new('ShaderNodeTexImage')
            texture.image = bpy.data.images.load(str(model / 'data--Textures--Cars--Motorbike--motorbike_albedo.png'), check_existing=True)
            material.node_tree.links.new(texture.outputs['Color'], p.inputs['Base Color'])
        materials[path.name.replace('data--Materials--Cars--', '').replace('--', '/')] = material
    for node in prefab.iter('Object'):
        if node.attrib.get('class') != 'GameObject':
            continue
        name = node.find('Property[@name="m_name"]').attrib['value']
        components = node.find('Property[@name="m_components"]')
        paths = [x.attrib.get('value', '') for x in components.iter('Property') if x.attrib.get('name') == 'm_resourcePath'] if components is not None else []
        files = [x for x in paths if x.endswith('.fbx')]
        if not files:
            continue
        d = node.find('Property[@name="m_local"]').attrib
        matrix = Matrix([[float(d['I' + i]), float(d['J' + i]), float(d['K' + i]), float(d['T' + i])] for i in ('x', 'y', 'z', 'w')])
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.fbx(filepath=str(model / files[0].replace('/', '--')))
        imported = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
        assigned = [x for x in paths if x.endswith('.mat')]
        for o in imported:
            o.name = name
            o.parent = None
            o.matrix_world = matrix
            for i, m in enumerate(assigned):
                o.data.materials[i] = materials[m.replace('data/Materials/Cars/', '')]
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    print('M1_ASSEMBLED', output, flush=True)


def simplify(source, output, manifest):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arrays = np.load(source)
    descriptions = json.loads(Path(manifest).read_text())
    result = {}
    rows = []
    for name, description in descriptions.items():
        vertices = arrays[name + '.p']
        triangles = arrays[name + '.i']
        uv = arrays[name + '.uv']
        normals = arrays[name + '.n']
        material = arrays[name + '.m']
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices.tolist(), [], triangles.tolist())
        mesh.update()
        # Material boundaries carry source PBR factors and must survive collapse.
        for i in range(int(material.max()) + 1):
            mesh.materials.append(bpy.data.materials.new(name + ':' + str(i)))
        for polygon, mi in zip(mesh.polygons, material):
            polygon.material_index = int(mi)
            polygon.use_smooth = True
        layer = mesh.uv_layers.new(name='UVMap')
        loop_vertices = np.array([loop.vertex_index for loop in mesh.loops], dtype=np.int32)
        layer.data.foreach_set('uv', uv[loop_vertices].reshape(-1))
        mesh.normals_split_custom_set(normals[loop_vertices].tolist())
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        # glTF primitive chunks may duplicate identical vertices. Weld only exact
        # positions; corner UVs and split normals remain attached to mesh loops.
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.0000001)
        bpy.ops.object.mode_set(mode='OBJECT')
        modifier = obj.modifiers.new('Conservative source edge collapse', 'DECIMATE')
        modifier.decimate_type = 'COLLAPSE'
        modifier.ratio = float(description['ratio'])
        modifier.use_collapse_triangulate = True
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        final = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=bpy.context.evaluated_depsgraph_get())
        final.calc_loop_triangles()
        # Corner attributes retained; pack writer deduplicates only identical
        # position, normal, UV and material combinations.
        indices = np.array([t.loops for t in final.loop_triangles], dtype=np.int32)
        corners = np.array([l.vertex_index for l in final.loops], dtype=np.int32)
        points = np.array([v.co for v in final.vertices], dtype=np.float32)
        final_uv = np.array([u.uv for u in final.uv_layers[0].data], dtype=np.float32)
        final_n = np.array([n.vector for n in final.corner_normals], dtype=np.float32)
        final_m = np.array([t.material_index for t in final.loop_triangles], dtype=np.uint16)
        result[name + '.p'] = points[corners]
        result[name + '.n'] = final_n
        result[name + '.uv'] = final_uv
        result[name + '.i'] = indices
        result[name + '.m'] = final_m
        rows.append({'part': name, 'before': len(triangles), 'after': len(indices), 'ratio': description['ratio']})
        evaluated.to_mesh_clear()
        bpy.data.objects.remove(obj, do_unlink=True)
        print('SIMPLIFIED', name, len(triangles), len(indices), flush=True)
    np.savez(output, **result)
    Path(str(output) + '.json').write_text(json.dumps(rows, indent=2))


args = sys.argv[sys.argv.index('--') + 1:]
if args[0] == 'assemble-m1':
    assemble_m1(Path(args[1]), Path(args[2]))
elif args[0] == 'simplify':
    simplify(*args[1:])
else:
    raise SystemExit('unknown preparation command')
