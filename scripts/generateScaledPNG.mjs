import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

// TODO: pass these in as CLI arguments
const BACKGROUND = "#0000";
const SCALING_KERNEL = undefined;
const SIZES_TO_GENERATE = [
  // each object must have a width or a height or both(contain)
  // can pass kernel property as well to control scaling algorithm
  { height: 24 },
];

async function scaleFlag(metaInfo, options) {
  const svgPath = path.join("svg", `${metaInfo.route}.svg`);

  if (!options.width && !options.height) {
    throw new Error("either width, height or both must be specified");
  }

  const result = await sharp(svgPath)
    .resize(options.width, options.height, {
      fit: "contain",
      background: BACKGROUND,
      kernel: options.kernel || SCALING_KERNEL,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const pngPath = path.join(
    "dist",
    "png",
    `${result.info.width}x${result.info.height}`,
    `${metaInfo.route}.png`
  );

  await fs.mkdir(path.dirname(pngPath), { recursive: true });
  await fs.writeFile(pngPath, result.data);
}

(async () => {
  const metaContents = await fs.readFile("dist/metadata.json", "utf-8");
  const metaData = JSON.parse(metaContents);

  // TODO: show progress message using cli-progress or spinner
  for (const size of SIZES_TO_GENERATE) {
    for (const info of metaData) {
      await scaleFlag(info, size);
    }
  }
})();
