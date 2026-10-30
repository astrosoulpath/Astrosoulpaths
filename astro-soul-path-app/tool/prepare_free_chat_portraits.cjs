// Asset optimization only. Source images are original fictional imagegen portraits.
const sharp = require('../../website/node_modules/sharp');
const path = require('node:path');
const jobs = [["C:/Users/iamha/.codex/generated_images/01a12e21-8b61-7503-9741-815692044ebf/exec-fa7ce909-f4a4-4efa-879f-53f11e7b2ef1.png","royal"],["C:/Users/iamha/.codex/generated_images/01a12e21-8b61-7503-9741-815692044ebf/exec-77403eef-53b2-4a90-a323-7826e9878d28.png","ivory"],["C:/Users/iamha/.codex/generated_images/01a12e21-8b61-7503-9741-815692044ebf/exec-e296d94b-5a38-46cd-9e0f-234bac24d674.png","rose"],["C:/Users/iamha/.codex/generated_images/01a12e21-8b61-7503-9741-815692044ebf/exec-c8a7c685-8bcd-4ce1-9025-0330f22bd391.png","vedic"],["C:/Users/iamha/.codex/generated_images/01a12e21-8b61-7503-9741-815692044ebf/exec-23f674a7-a4a3-4d42-a298-5f519c33c29f.png","namaste"],["C:/Users/iamha/.codex/generated_images/01a12e21-8b61-7503-9741-815692044ebf/exec-adb65a06-a810-4b43-a9e8-7d43bda9b4ee.png","modern"]];
Promise.all(jobs.map(async ([source, id]) => {
  await sharp(source).resize(480, 720, { fit: 'cover' }).webp({ quality: 84 })
    .toFile(path.join(__dirname, '../assets/images/free_chat_stickers', `premium_${id}.webp`));
})).then(() => console.log('Saved 6 optimized fictional promotional portraits'))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
