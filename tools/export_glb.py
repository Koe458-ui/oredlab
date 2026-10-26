import os
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'website robo final.blend')
OUT = os.path.join(ROOT, 'assets', 'robot.glb')

if not bpy.data.filepath:
    bpy.ops.wm.open_mainfile(filepath=SRC)

for obj in bpy.data.objects:
    obj.hide_set(False)
    obj.select_set(not obj.name.startswith('HELP_'))

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='SCENE',
    export_frame_range=True,
    export_force_sampling=True,
    export_cameras=False,
    export_lights=False,
    export_apply=True,
)
print('Wrote', OUT)
