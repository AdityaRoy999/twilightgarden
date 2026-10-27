"""Format/size conversion only; original generated artwork remains unchanged."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path.home() / '.codex/generated_images/01a173be-9b82-7843-a61a-4cba1153645a'
files = {
    'morning-energy': 'exec-b05e27a9-d9c9-469c-ba19-f948a4d2d16c.png',
    'gentle-stretch': 'exec-79d2e49f-c452-4c64-a306-8b5d4ea7fc8f.png',
    'herbal-hydration': 'exec-89c743e9-0c75-49a1-900f-1066cfbd6c5d.png',
    'rest-recovery': 'exec-5784b5c3-a872-4e83-8998-014d0d5b3784.png',
    'peaceful-sleep': 'exec-7632bee1-2ab0-4d8a-9d14-7fadcdc7f07e.png',
    'self-comfort': 'exec-b6b20b15-96ea-4429-9056-265a9eea1bf1.png',
    'supportive-couple': 'exec-fee3637a-4155-46c4-9708-aa92d905f59d.png',
}
for name, filename in files.items():
    image = Image.open(source / filename).convert('RGBA')
    image.thumbnail((720, 720), Image.Resampling.LANCZOS)
    target = root / 'public/art/wellness' / f'{name}.webp'
    image.save(target, 'WEBP', quality=87, method=6)
    print(name, image.size, target.stat().st_size)
