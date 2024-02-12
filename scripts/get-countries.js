import fs from "fs";
import { getNames, getCodes } from "country-list";

const countryNames = getNames();
const countryCodes = getCodes();

const unionTypeStringNames = countryNames.map(name => `"${name}"`).join('\n  | ');

const flagFormattedCodes = countryCodes.map(code => `":flag_${code}:"`);
const unionTypeStringFlags = flagFormattedCodes.join('\n  | ');


fs.writeFileSync('src/modules/news/countries.d.ts', `type CountryName =\n  | ${unionTypeStringNames};\n` + `type CountryFlag =\n | ${unionTypeStringFlags};\n\n export type { CountryName, CountryFlag };`);


