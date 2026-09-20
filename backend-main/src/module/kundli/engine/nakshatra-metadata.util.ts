export type NakshatraMetadata = {
  number: number;
  name: string;
  lord: string;
  deity: string;
};

const LORDS = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
] as const;

const NAKSHATRAS = [
  ['Ashwini', 'Ashwini Kumaras'],
  ['Bharani', 'Yama'],
  ['Krittika', 'Agni'],
  ['Rohini', 'Prajapati'],
  ['Mrigashirsha', 'Soma'],
  ['Ardra', 'Rudra'],
  ['Punarvasu', 'Aditi'],
  ['Pushya', 'Brihaspati'],
  ['Ashlesha', 'Nagas'],
  ['Magha', 'Pitris'],
  ['Purva Phalguni', 'Bhaga'],
  ['Uttara Phalguni', 'Aryaman'],
  ['Hasta', 'Savitar'],
  ['Chitra', 'Tvashtar'],
  ['Swati', 'Vayu'],
  ['Vishakha', 'Indra-Agni'],
  ['Anuradha', 'Mitra'],
  ['Jyeshtha', 'Indra'],
  ['Mula', 'Nirriti'],
  ['Purva Ashadha', 'Apas'],
  ['Uttara Ashadha', 'Vishvadevas'],
  ['Shravana', 'Vishnu'],
  ['Dhanishta', 'Vasus'],
  ['Shatabhisha', 'Varuna'],
  ['Purva Bhadrapada', 'Aja Ekapada'],
  ['Uttara Bhadrapada', 'Ahir Budhnya'],
  ['Revati', 'Pushan'],
] as const;

export function getNakshatraMetadata(
  nakshatraNumber: number,
): NakshatraMetadata {
  if (
    !Number.isInteger(nakshatraNumber) ||
    nakshatraNumber < 1 ||
    nakshatraNumber > 27
  ) {
    throw new Error('Nakshatra number must be an integer from 1 to 27.');
  }

  const [name, deity] = NAKSHATRAS[nakshatraNumber - 1];
  const lord = LORDS[(nakshatraNumber - 1) % LORDS.length];

  return {
    number: nakshatraNumber,
    name,
    lord,
    deity,
  };
}
