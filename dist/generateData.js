"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var country_state_city_1 = require("country-state-city");
var fs = require("fs"); // <- use this instead of `import fs from "fs"`
function generateLocationData() {
    var countries = country_state_city_1.Country.getAllCountries();
    var data = {};
    for (var _i = 0, countries_1 = countries; _i < countries_1.length; _i++) {
        var country = countries_1[_i];
        var states = country_state_city_1.State.getStatesOfCountry(country.isoCode);
        data[country.isoCode] = {
            name: country.name,
            emoji: country.flag,
            states: states.map(function (s) { return ({ name: s.name, iso2: s.isoCode }); }),
        };
    }
    fs.writeFileSync("countries.json", JSON.stringify(data, null, 2));
    console.log("✅ countries.json created");
}
generateLocationData();
