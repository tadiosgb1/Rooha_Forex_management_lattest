const regionCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW `.trim().split(' ')
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })

const demonyms = {
  AF: 'Afghan', AL: 'Albanian', DZ: 'Algerian', AR: 'Argentine', AM: 'Armenian', AU: 'Australian',
  AT: 'Austrian', AZ: 'Azerbaijani', BD: 'Bangladeshi', BE: 'Belgian', BO: 'Bolivian',
  BR: 'Brazilian', BG: 'Bulgarian', KH: 'Cambodian', CM: 'Cameroonian', CA: 'Canadian',
  CL: 'Chilean', CN: 'Chinese', CO: 'Colombian', CR: 'Costa Rican', HR: 'Croatian',
  CU: 'Cuban', CY: 'Cypriot', CZ: 'Czech', DK: 'Danish', DO: 'Dominican', EC: 'Ecuadorian',
  EG: 'Egyptian', EE: 'Estonian', ET: 'Ethiopian', FI: 'Finnish', FR: 'French', GE: 'Georgian',
  DE: 'German', GH: 'Ghanaian', GR: 'Greek', GT: 'Guatemalan', HT: 'Haitian', HN: 'Honduran',
  HU: 'Hungarian', IS: 'Icelandic', IN: 'Indian', ID: 'Indonesian', IR: 'Iranian', IQ: 'Iraqi',
  IE: 'Irish', IL: 'Israeli', IT: 'Italian', JM: 'Jamaican', JP: 'Japanese', JO: 'Jordanian',
  KZ: 'Kazakhstani', KE: 'Kenyan', KR: 'South Korean', KW: 'Kuwaiti', LB: 'Lebanese',
  LY: 'Libyan', LT: 'Lithuanian', MY: 'Malaysian', MX: 'Mexican', MA: 'Moroccan',
  NP: 'Nepalese', NL: 'Dutch', NZ: 'New Zealander', NG: 'Nigerian', NO: 'Norwegian',
  PK: 'Pakistani', PA: 'Panamanian', PE: 'Peruvian', PH: 'Filipino', PL: 'Polish',
  PT: 'Portuguese', QA: 'Qatari', RO: 'Romanian', RU: 'Russian', RW: 'Rwandan',
  SA: 'Saudi Arabian', SN: 'Senegalese', RS: 'Serbian', SG: 'Singaporean', SO: 'Somali',
  ZA: 'South African', ES: 'Spanish', LK: 'Sri Lankan', SD: 'Sudanese', SE: 'Swedish',
  CH: 'Swiss', SY: 'Syrian', TW: 'Taiwanese', TZ: 'Tanzanian', TH: 'Thai', TN: 'Tunisian',
  TR: 'Turkish', UG: 'Ugandan', UA: 'Ukrainian', AE: 'Emirati', GB: 'British',
  US: 'American', UY: 'Uruguayan', UZ: 'Uzbek', VE: 'Venezuelan', VN: 'Vietnamese',
  YE: 'Yemeni', ZM: 'Zambian', ZW: 'Zimbabwean', CD: 'Congolese', CG: 'Congolese',
  CI: 'Ivorian', KR: 'South Korean', KP: 'North Korean', MK: 'Macedonian', MM: 'Burmese',
  BO: 'Bolivian', BA: 'Bosnian', BY: 'Belarusian', FJ: 'Fijian', JM: 'Jamaican',
}

export const countryOptions = regionCodes
  .map(code => ({ code, name: displayNames.of(code) || code }))
  .filter(country => country.name && country.name !== country.code)
  .sort((a, b) => a.name.localeCompare(b.name))

export const nationalityOptions = countryOptions
  .map(country => ({
    value: demonyms[country.code] || country.name,
    label: demonyms[country.code] || country.name,
  }))
  .filter((nationality, index, all) => all.findIndex(item => item.value === nationality.value) === index)
  .sort((a, b) => a.label.localeCompare(b.label))
