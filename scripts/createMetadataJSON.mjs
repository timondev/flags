// @ts-check
import path, { parse } from 'node:path';
import fs from 'node:fs';
import countriesData from './countries.json' assert { type: 'json' };
import jsdom from 'jsdom';

const { JSDOM } = jsdom;

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

  const getXMLDimensions = (filePath, file) => {
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

  const getAndUpdateSVGMetadata = (filePath, info) => {
    console.log(filePath);
    const file = fs.readFileSync(filePath, 'utf-8');
    const dimensions = getXMLDimensions(filePath, file);
    const dom = new JSDOM(file);
    const svg = dom.window.document.querySelector('svg');
    svg?.setAttribute('xmlns:cgf', 'https://coding.garden/flags');
    const metadataElement = dom.window.document.createElement('metadata');
    metadataElement.id = "cgf-metadata";
    metadataElement.innerHTML = `

<cgf:flag>
  <cgf:name>${info.name || ''}</cgf:name>
  <cgf:route>${info.path || info.code}</cgf:route>
  <cgf:aspect-ratio>${dimensions.width / dimensions.height}</cgf:aspect-ratio>
</cgf:flag>

`;
    svg?.prepend(metadataElement);
    fs.writeFileSync(filePath, svg?.outerHTML, 'utf-8');
    console.log('Updated:', filePath);
    return dimensions;
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
            const subRegionCode = subRegion.name.split('.')[0];
            const friendlyName = subRegionCode.split('_').map((word) => word[0].toUpperCase() + word.substring(1)).join(' ');
            const svg = getAndUpdateSVGMetadata(filePath, {
              name: friendlyName,
              code: subRegionCode,
              path: `${territory.code}/${region.name}/${subRegionCode}`,
            });
            regionItem.sub_regions.push({
              code: subRegionCode,
              aspect_ratio: svg.width / svg.height
            });
          });
        } else {
          const r = getRegion(region.name.split('.')[0]);
          if (!r) return;
          const filePath = path.join('svg', item.name, region.name);
          const svg = getAndUpdateSVGMetadata(filePath, {
            name: "",
            code: r.code,
            path: `${item.name}/${r.code}`,
          });
          r.aspect_ratio = svg.width / svg.height;
        }
      });
    } else {
      // TODO: get aspect ratio of svg
      const territoryCode = item.name.split('.')[0];
      const territory = getTerritory(territoryCode);
      const filePath = path.join('svg', item.name);
      const svg = getAndUpdateSVGMetadata(filePath, {
        name: territory.name,
        code: territoryCode,
        path: territoryCode,
      });
      territory.aspect_ratio = svg.width / svg.height;
    }
  });

  fs.writeFileSync('metadata.json', JSON.stringify([...territories.values()], null, 2), 'utf-8');
}

createMetadataJSON();
