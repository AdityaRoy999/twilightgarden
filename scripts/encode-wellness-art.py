"""Format/size conversion only; original generated artwork remains unchanged."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path.home() / '.codex/generated_images/01a173be-9b82-7843-a61a-4cba1153645a'
files = {
    'morning-energy': 'exec-713180da-1713-4c04-95ee-7c67e726605e.png',
    'gentle-stretch': 'exec-14358e7d-3acb-4872-a2c3-5ab2d0e1a182.png',
    'herbal-hydration': 'exec-a6c5dd18-1d57-4b1b-806e-093d16be2d0f.png',
    'rest-recovery': 'exec-1d67e92e-b957-40b8-9264-8cf4d90f9e70.png',
    'peaceful-sleep': 'exec-933007fc-cf0a-4864-b170-e6039eedbfd1.png',
    'self-comfort': 'exec-6cd79067-5c96-44cb-bd57-250158560388.png',
    'supportive-couple': 'exec-e40ca20f-a932-40dc-908e-c798ad370649.png',
}
for name, filename in files.items():
    image = Image.open(source / filename).convert('RGBA')
    image.thumbnail((720, 720), Image.Resampling.LANCZOS)
    target = root / 'public/art/wellness' / f'{name}.cartoon.webp'
    image.save(target, 'WEBP', quality=87, method=6)
    print(name, image.size, target.stat().st_size)
