// @ts-check
import path from 'node:path';
import fs from 'node:fs';
import countriesData from './countries.json' assert { type: 'json' };

// BEWARE: this code was quickly hacked together.
// You could probably re-run it against any added files..
// but you'll probably also lose any recent changes to those files.
// You probably want to update this file to read in "metadata.json"
// and further update that file and then re-save
// probably...


async function createMetadataJSON() {
  const items = fs.readdirSync('svg', {
    withFileTypes: true,
  });

  const territories = new Map();

  const getTerritory = (code) => {
    let territory = territories.get(code);
    if (territory) return territory;
    const countryData = countriesData.find((d) => d.alpha2Code.toLowerCase() === code);
    if (!countryData) {
      console.log('NOT FOUND', code);
    }
    territory = {
      code,
      name: countryData?.name,
      regions: [],
    };
    territories.set(code, territory);
    return territory;
  }

  const getSVGMetadata = (filePath) => {
    const file = fs.readFileSync(filePath, 'utf-8');
    let width = '0';
    let height = '0';
    try {
      const widthResult = / width="(.*?)"/.exec(file);
      const heightResult = / height="(.*?)"/.exec(file);
      if (!widthResult || !heightResult) {
        const viewboxResult = / viewBox="(.*?)"/.exec(file);
        if (!viewboxResult) {
          console.log(filePath);
          console.log('give up, all hope is lost');
          process.exit();
        }
        const [, viewbox] = viewboxResult;
        [, , width, height] = viewbox.split(' ');
      } else {
        [, width] = widthResult;
        [, height] = heightResult;
      }
      width = parseInt(width);
      height = parseInt(height);
      if (isNaN(width) || isNaN(height)) {
        console.log('ERROR', filePath);
        process.exit();
      }
      return {
        width: Number(width),
        height: Number(height)
      }
    } catch (error) {
      console.log(filePath);
    }
  }

  items.forEach((item) => {
    if (item.isDirectory()) {
      const territory = getTerritory(item.name);
      const directoryName = path.join('svg', item.name);
      const regions = fs.readdirSync(directoryName, {
        withFileTypes: true,
      });

      const getRegion = (code) => {
        if (code === 'README') return;
        let region = territory.regions.find((c) => c.code === code);
        if (region) return region;
        region = {
          code,
          sub_regions: [],
        };
        territory.regions.push(region);
        return region;
      };
      regions.forEach((region) => {
        if (region.isDirectory()) {
          const regionItem = getRegion(region.name);
          const regiondDirectoryName = path.join(directoryName, region.name);
          const subRegions = fs.readdirSync(regiondDirectoryName, {
            withFileTypes: true,
          });

          subRegions.forEach((subRegion) => {
            if (subRegion.name === 'README') return;
            const filePath = path.join(regiondDirectoryName, subRegion.name);
            const svg = getSVGMetadata(filePath);
            regionItem.sub_regions.push({
              code: subRegion.name.split('.')[0],
              aspect_ratio: svg.width / svg.height
            });
          });
        } else {
          const r = getRegion(region.name.split('.')[0]);
          if (!r) return;
          const filePath = path.join('svg', item.name, region.name);
          const svg = getSVGMetadata(filePath);
          r.aspect_ratio = svg.width / svg.height;
        }
      });
    } else {
      // TODO: get aspect ratio of svg
      const territory = getTerritory(item.name.split('.')[0]);
      const filePath = path.join('svg', item.name);
      const svg = getSVGMetadata(filePath);
      territory.aspect_ratio = svg.width / svg.height;
    }
  });

  fs.writeFileSync('metadata.json', JSON.stringify([...territories.values()], null, 2), 'utf-8');
}

createMetadataJSON();
